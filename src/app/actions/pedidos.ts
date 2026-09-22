"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, StatusPedido } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirClinica, exigirInterno, registrarAuditoria } from "@/lib/sessao";
import { equipamentoLivre, parametros, temBloqueio, travarRecursos, verificarAlocacao } from "@/lib/alocacao";
import { calcularRepasse } from "@/lib/repasse";
import { podeTransicionar, STATUS_ATIVOS } from "@/lib/pedido";
import { competenciaDe, dataDeISO, instanteDoAtendimento, isoDeData } from "@/lib/data";
import { enfileirarMensagem } from "@/lib/integracoes/whatsapp";
import { sincronizarEvento } from "@/lib/integracoes/google-agenda";
import { marcarNegocioGanho } from "@/lib/integracoes/pipedrive";
import { condicaoValida } from "@/lib/pagamento";
import { perfilPermite } from "@/lib/papeis";

export type Resultado = { ok: boolean; erro?: string; avisos?: string[] };

function atualizarTelas() {
  revalidatePath("/painel");
  revalidatePath("/painel/pedidos");
  revalidatePath("/painel/agenda");
  revalidatePath("/painel/financeiro");
  revalidatePath("/portal");
  revalidatePath("/profissional");
}

/**
 * Numeração sequencial do pedido.
 *
 * Sai de dentro da mesma transação que cria o pedido: dois atendentes
 * marcando ao mesmo tempo — rotina com 5 pessoas na operação — não podem
 * receber o mesmo número, e `numero` é único no banco justamente para que
 * uma corrida vire erro visível em vez de dois pedidos com a mesma
 * identidade.
 */
async function proximoNumero(tx: Prisma.TransactionClient): Promise<number> {
  const config = await tx.parametros.update({
    where: { id: "hemoderi" },
    data: { proximoNumeroPedido: { increment: 1 } },
    select: { proximoNumeroPedido: true },
  });
  return config.proximoNumeroPedido - 1;
}

/** Preço do serviço para a clínica: o negociado, quando existe; senão a tabela. */
async function valorDoServico(clinicaId: string, servicoId: string): Promise<number> {
  const [negociado, servico] = await Promise.all([
    prisma.precoClinica.findUnique({
      where: { clinicaId_servicoId: { clinicaId, servicoId } },
      select: { valorCentavos: true },
    }),
    prisma.servico.findUnique({ where: { id: servicoId }, select: { valorPadraoCentavos: true } }),
  ]);
  return negociado?.valorCentavos ?? servico?.valorPadraoCentavos ?? 0;
}

async function repasseDoPedido(profissionalId: string, servicoId: string, valorServicoCentavos: number) {
  const [regra, servico, profissional, config] = await Promise.all([
    prisma.regraRepasse.findUnique({
      where: { profissionalId_servicoId: { profissionalId, servicoId } },
      select: { percent: true, fixoCentavos: true },
    }),
    prisma.servico.findUnique({
      where: { id: servicoId },
      select: { repassePercent: true, repasseFixoCentavos: true },
    }),
    prisma.profissional.findUnique({
      where: { id: profissionalId },
      select: { repassePercentPadrao: true },
    }),
    parametros(),
  ]);

  return calcularRepasse({
    valorServicoCentavos,
    regra,
    servico,
    profissional,
    percentPadrao: config.repassePercentPadrao,
  });
}

// ─── Criação ────────────────────────────────────────────────────────────────

/**
 * Pedido aberto pela equipe interna. Pode já nascer alocado quando o
 * atendente sabe quem vai atender — é o caminho mais comum hoje, e obrigar a
 * passar por duas telas só transformaria um telefonema em dois cliques a mais.
 */
export async function criarPedido(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await exigirInterno();

  const clinicaId = String(dados.get("clinicaId") ?? "");
  const servicoId = String(dados.get("servicoId") ?? "");
  const profissionalId = String(dados.get("profissionalId") ?? "") || null;
  const dataISO = String(dados.get("data") ?? "");
  const horaInicio = String(dados.get("horaInicio") ?? "");
  if (!clinicaId || !servicoId || !dataISO || !horaInicio) {
    return { ok: false, erro: "Clínica, serviço, data e hora são obrigatórios." };
  }

  // Garante a linha única de Parametros antes de numerar o pedido: numerar
  // é um update, e num banco recém-criado não haveria o que atualizar.
  await parametros();

  const servico = await prisma.servico.findFirst({ where: { id: servicoId, ativo: true } });
  if (!servico) return { ok: false, erro: "Serviço indisponível." };

  const data = dataDeISO(dataISO);
  const valorServicoCentavos = await valorDoServico(clinicaId, servicoId);

  // Checar disponibilidade e só depois gravar, com uma transação comum, deixa
  // uma corrida aberta: com dezenas de profissionais e a equipe + o portal da
  // clínica marcando ao mesmo tempo, duas requisições podem ler "livre" antes
  // de qualquer uma escrever. `travarRecursos` fecha isso — trava primeiro os
  // recursos em disputa, e só então checa e grava, tudo dentro da mesma
  // transação.
  const resultado = await prisma.$transaction(async (tx) => {
    await travarRecursos(tx, {
      clinicaId,
      profissionalId,
      tipoEquipamento: servico.exigeEquipamento ? servico.tipoEquipamento : null,
    });

    const impedimentos = await verificarAlocacao(
      { clinicaId, profissionalId, data, horaInicio, duracaoMin: servico.duracaoMin },
      tx
    );
    if (temBloqueio(impedimentos)) {
      return {
        ok: false as const,
        erro: impedimentos.filter((i) => i.bloqueante).map((i) => i.mensagem).join(" "),
      };
    }

    let valorRepasseCentavos = 0;
    if (profissionalId) {
      valorRepasseCentavos = (await repasseDoPedido(profissionalId, servicoId, valorServicoCentavos)).valorCentavos;
    }

    // Serviço com equipamento ilimitado não reserva unidade: o aparelho
    // existe de sobra (ou é do próprio profissional) e prender uma unidade
    // dele tiraria horário de quem realmente disputa o estoque.
    const reservaEquipamento = servico.exigeEquipamento && !servico.equipamentoIlimitado;
    const equipamentoId =
      profissionalId && reservaEquipamento
        ? await equipamentoLivre(data, horaInicio, servico.duracaoMin, servico.tipoEquipamento, undefined, tx)
        : null;
    if (profissionalId && reservaEquipamento && !equipamentoId) {
      return { ok: false as const, erro: "Nenhum equipamento livre nesse horário." };
    }

    const numero = await proximoNumero(tx);
    const pedido = await tx.pedido.create({
      data: {
        numero,
        clinicaId,
        servicoId,
        profissionalId,
        equipamentoId,
        data,
        horaInicio,
        duracaoMin: servico.duracaoMin,
        status: profissionalId ? "ALOCADO" : "CONFIRMADO",
        origem: "INTERNO",
        valorServicoCentavos,
        valorRepasseCentavos,
        pacienteNome: String(dados.get("pacienteNome") ?? "") || null,
        pacienteContato: String(dados.get("pacienteContato") ?? "") || null,
        doutorNome: String(dados.get("doutorNome") ?? "").trim() || null,
        condicaoPagamento: String(dados.get("condicaoPagamento") ?? "").trim() || null,
        observacoes: String(dados.get("observacoes") ?? "") || null,
        criadoPorId: sessao.usuarioId,
      },
    });

    return {
      ok: true as const,
      pedido,
      avisos: impedimentos.filter((i) => !i.bloqueante).map((i) => i.mensagem),
    };
  });

  if (!resultado.ok) return resultado;

  const { pedido, avisos } = resultado;
  await registrarAuditoria(sessao.usuarioId, "Pedido", pedido.id, "criar", `nº ${pedido.numero}`);
  await enfileirarMensagem(pedido.id, "CONFIRMACAO");
  if (pedido.profissionalId) await enfileirarMensagem(pedido.id, "ALOCACAO");
  await sincronizarEvento(pedido.id);

  atualizarTelas();
  return { ok: true, avisos };
}

/**
 * Solicitação aberta pela própria clínica no portal. Nasce SOLICITADO: é
 * pedido, não compromisso. A equipe confirma — e é essa confirmação que
 * separa o autoatendimento de um canal onde qualquer um marca qualquer coisa.
 */
export async function solicitarPedido(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await exigirClinica();

  const servicoId = String(dados.get("servicoId") ?? "");
  const profissionalId = String(dados.get("profissionalId") ?? "") || null;
  const dataISO = String(dados.get("data") ?? "");
  const horaInicio = String(dados.get("horaInicio") ?? "");
  if (!servicoId || !dataISO || !horaInicio) {
    return { ok: false, erro: "Serviço, data e hora são obrigatórios." };
  }

  const [servico, config] = await Promise.all([
    prisma.servico.findFirst({ where: { id: servicoId, ativo: true } }),
    parametros(),
  ]);
  if (!servico) return { ok: false, erro: "Serviço indisponível." };

  const data = dataDeISO(dataISO);
  const limite = new Date(Date.now() + config.antecedenciaMinimaHoras * 60 * 60 * 1000);
  if (new Date(`${dataISO}T${horaInicio}:00-03:00`) < limite) {
    return {
      ok: false,
      erro: `Agendamentos pelo portal precisam de ${config.antecedenciaMinimaHoras}h de antecedência. Para urgências, fale com a central.`,
    };
  }

  const valorServicoCentavos = await valorDoServico(sessao.clinicaId, servicoId);

  // O profissional escolhido fica GRAVADO no pedido, e não como frase em
  // observações. Ele é o que a clínica pediu e o que a equipe vai confirmar —
  // e é a agenda dele que o reagendamento pelo portal consulta depois.
  //
  // Isso segura o horário desse profissional enquanto o pedido está
  // SOLICITADO: é reserva provisória, não alocação. O que separa as duas é o
  // status, e é a equipe que faz a segunda. Segurar é de propósito — duas
  // clínicas pedindo o mesmo horário e as duas recebendo "ok" é pior do que
  // a segunda ver o horário indisponível na hora. `travarRecursos` garante
  // que essa checagem e essa gravação são atômicas mesmo com duas clínicas
  // pedindo o mesmo profissional no mesmo instante.
  const resultado = await prisma.$transaction(async (tx) => {
    await travarRecursos(tx, { clinicaId: sessao.clinicaId, profissionalId });

    const impedimentos = await verificarAlocacao(
      { clinicaId: sessao.clinicaId, profissionalId, data, horaInicio, duracaoMin: servico.duracaoMin },
      tx
    );
    if (temBloqueio(impedimentos)) {
      return { ok: false as const, erro: "Esse horário acabou de ficar indisponível. Escolha outro." };
    }

    const profissional = profissionalId
      ? await tx.profissional.findFirst({ where: { id: profissionalId, ativo: true }, select: { id: true } })
      : null;

    const numero = await proximoNumero(tx);
    const pedido = await tx.pedido.create({
      data: {
        numero,
        clinicaId: sessao.clinicaId,
        servicoId,
        profissionalId: profissional?.id ?? null,
        observacoes: String(dados.get("observacoes") ?? "") || null,
        data,
        horaInicio,
        duracaoMin: servico.duracaoMin,
        status: "SOLICITADO",
        origem: "PORTAL_CLINICA",
        valorServicoCentavos,
        pacienteNome: String(dados.get("pacienteNome") ?? "") || null,
        pacienteContato: String(dados.get("pacienteContato") ?? "") || null,
        doutorNome: String(dados.get("doutorNome") ?? "").trim() || null,
        criadoPorId: sessao.usuarioId,
      },
    });

    return { ok: true as const, pedido };
  });

  if (!resultado.ok) return resultado;

  await registrarAuditoria(
    sessao.usuarioId,
    "Pedido",
    resultado.pedido.id,
    "solicitar",
    `nº ${resultado.pedido.numero}`
  );
  atualizarTelas();
  return { ok: true };
}

// ─── Esteira ────────────────────────────────────────────────────────────────

async function transicionar(pedidoId: string, para: StatusPedido, usuarioId: string): Promise<Resultado> {
  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, select: { status: true } });
  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };
  if (!podeTransicionar(pedido.status, para)) {
    return { ok: false, erro: `Não é possível ir de ${pedido.status} para ${para}.` };
  }
  await prisma.pedido.update({ where: { id: pedidoId }, data: { status: para } });
  await registrarAuditoria(usuarioId, "Pedido", pedidoId, "status", `${pedido.status} → ${para}`);
  return { ok: true };
}

export async function confirmarPedido(pedidoId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  const resultado = await transicionar(pedidoId, "CONFIRMADO", sessao.usuarioId);
  if (resultado.ok) {
    await enfileirarMensagem(pedidoId, "CONFIRMACAO");
    await sincronizarEvento(pedidoId);
    atualizarTelas();
  }
  return resultado;
}

export async function alocarPedido(pedidoId: string, profissionalId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "LOGISTICA")) {
    return { ok: false, erro: "Só a logística aloca profissionais." };
  }

  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: {
      servico: {
        select: {
          id: true,
          duracaoMin: true,
          exigeEquipamento: true,
          equipamentoIlimitado: true,
          tipoEquipamento: true,
        },
      },
    },
  });
  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };
  if (!podeTransicionar(pedido.status, "ALOCADO")) {
    return { ok: false, erro: "Só é possível alocar um pedido confirmado." };
  }

  const resultado = await prisma.$transaction(async (tx) => {
    await travarRecursos(tx, {
      clinicaId: pedido.clinicaId,
      profissionalId,
      tipoEquipamento: pedido.servico.exigeEquipamento ? pedido.servico.tipoEquipamento : null,
    });

    const impedimentos = await verificarAlocacao(
      {
        clinicaId: pedido.clinicaId,
        profissionalId,
        data: pedido.data,
        horaInicio: pedido.horaInicio,
        duracaoMin: pedido.duracaoMin,
        ignorarPedidoId: pedido.id,
      },
      tx
    );
    if (temBloqueio(impedimentos)) {
      return {
        ok: false as const,
        erro: impedimentos.filter((i) => i.bloqueante).map((i) => i.mensagem).join(" "),
      };
    }

    const reservaEquipamento =
      pedido.servico.exigeEquipamento && !pedido.servico.equipamentoIlimitado;
    const equipamentoId = reservaEquipamento
      ? await equipamentoLivre(
          pedido.data,
          pedido.horaInicio,
          pedido.duracaoMin,
          pedido.servico.tipoEquipamento,
          pedido.id,
          tx
        )
      : null;
    if (reservaEquipamento && !equipamentoId) {
      return { ok: false as const, erro: "Nenhum equipamento livre nesse horário." };
    }

    const repasse = await repasseDoPedido(profissionalId, pedido.servicoId, pedido.valorServicoCentavos);

    await tx.pedido.update({
      where: { id: pedido.id },
      data: {
        profissionalId,
        equipamentoId,
        status: "ALOCADO",
        valorRepasseCentavos: repasse.valorCentavos,
      },
    });

    return {
      ok: true as const,
      repasseOrigem: repasse.origem,
      avisos: impedimentos.filter((i) => !i.bloqueante).map((i) => i.mensagem),
    };
  });

  if (!resultado.ok) return resultado;

  await registrarAuditoria(sessao.usuarioId, "Pedido", pedido.id, "alocar", `repasse por ${resultado.repasseOrigem}`);
  await enfileirarMensagem(pedido.id, "ALOCACAO");
  await sincronizarEvento(pedido.id);

  atualizarTelas();
  return { ok: true, avisos: resultado.avisos };
}

/**
 * Devolve o pedido à fila — profissional recusou, imprevisto, endereço fora
 * de área. Exclusivo da logística (ata de 21/09): depois que o profissional
 * aceita, só ela pode tirá-lo do caso, nunca a própria pessoa profissional
 * de forma autônoma.
 */
export async function desalocarPedido(pedidoId: string, motivo: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "LOGISTICA")) {
    return { ok: false, erro: "Só a logística desaloca um profissional." };
  }
  if (!motivo.trim()) {
    return { ok: false, erro: "Informe o motivo da realocação." };
  }

  const resultado = await transicionar(pedidoId, "CONFIRMADO", sessao.usuarioId);
  if (resultado.ok) {
    await prisma.pedido.update({
      where: { id: pedidoId },
      data: { profissionalId: null, equipamentoId: null, valorRepasseCentavos: 0 },
    });
    // A mensagem de alocação é apagada para que o próximo profissional
    // alocado receba a dele — a unicidade é por pedido × tipo.
    await prisma.mensagemWhatsapp
      .delete({ where: { pedidoId_tipo: { pedidoId, tipo: "ALOCACAO" } } })
      .catch(() => undefined);
    // Sem profissional, o evento sai da agenda dele: "some da minha agenda
    // quando me tiram do caso" é o mínimo para alguém confiar no que vê ali.
    // Cai na agenda da operação se houver uma, que é onde a equipe acompanha.
    await sincronizarEvento(pedidoId);
    await registrarAuditoria(sessao.usuarioId, "Pedido", pedidoId, "desalocar", motivo);
    atualizarTelas();
  }
  return resultado;
}

/** Exclusivo do comercial (ata de 21/09) — é quem decide, com a clínica, se o atendimento cai. */
export async function cancelarPedido(pedidoId: string, motivo: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "COMERCIAL")) {
    return { ok: false, erro: "Só o comercial cancela um agendamento." };
  }
  if (!motivo.trim()) {
    return { ok: false, erro: "Informe o motivo do cancelamento." };
  }

  const resultado = await transicionar(pedidoId, "CANCELADO", sessao.usuarioId);
  if (resultado.ok) {
    await prisma.pedido.update({
      where: { id: pedidoId },
      data: { canceladoEm: new Date(), motivoCancelamento: motivo },
    });
    await prisma.mensagemWhatsapp.updateMany({
      where: { pedidoId, status: "PENDENTE" },
      data: { status: "CANCELADA" },
    });
    // Tira o evento da agenda de quem ia atender. Sem isto o profissional
    // continua com o compromisso no celular e aparece numa clínica que
    // cancelou — o jeito mais rápido de a agenda do Google deixar de ser
    // confiável.
    await sincronizarEvento(pedidoId);
    atualizarTelas();
  }
  return resultado;
}

/**
 * Fecha o pedido a partir do relatório do profissional.
 *
 * O repasse nasce aqui e só aqui — REALIZADO gera, FALTOU não. É a regra que
 * o financeiro assume inteira: o que aparece em "a pagar" passou por um
 * relatório que alguém assinou.
 */
export async function registrarResultado(
  pedidoId: string,
  compareceu: boolean,
  usuarioId: string
): Promise<Resultado> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: {
      id: true,
      status: true,
      data: true,
      profissionalId: true,
      valorRepasseCentavos: true,
    },
  });
  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };

  const destino: StatusPedido = compareceu ? "REALIZADO" : "FALTOU";
  if (!podeTransicionar(pedido.status, destino)) {
    return { ok: false, erro: "Só um pedido alocado pode ser finalizado." };
  }

  await prisma.pedido.update({ where: { id: pedido.id }, data: { status: destino } });

  if (compareceu && pedido.profissionalId) {
    // Nasce AGUARDANDO_APROVACAO: o valor já é conhecido e aparece para o
    // profissional como "a receber", mas só entra no "a pagar" da operação
    // depois que a equipe confere o relatório (ata de 14/09).
    await prisma.repasse.upsert({
      where: { pedidoId: pedido.id },
      update: { valorCentavos: pedido.valorRepasseCentavos },
      create: {
        pedidoId: pedido.id,
        profissionalId: pedido.profissionalId,
        // Competência é o mês do ATENDIMENTO, não o do envio do relatório:
        // relatório atrasado não empurra o custo para o mês seguinte.
        competencia: competenciaDe(pedido.data),
        valorCentavos: pedido.valorRepasseCentavos,
        status: "AGUARDANDO_APROVACAO",
      },
    });
    await marcarNegocioGanho(pedido.id);
  }

  await registrarAuditoria(usuarioId, "Pedido", pedido.id, "resultado", destino);
  await enfileirarMensagem(pedido.id, "RESULTADO");

  atualizarTelas();
  return { ok: true };
}

// ─── Portal da clínica ──────────────────────────────────────────────────────

/**
 * Janela em que a clínica ainda mexe no próprio pedido sozinha.
 *
 * Vale a mesma antecedência mínima do agendamento: mais perto do que isso, o
 * profissional já se organizou para o deslocamento e o equipamento já foi
 * separado. Desmarcar em cima da hora continua possível — mas pela central,
 * falando com alguém, que é o que dá à operação a chance de remanejar.
 */
async function dentroDaJanelaDaClinica(data: Date, horaInicio: string): Promise<boolean> {
  const config = await parametros();
  const limite = new Date(Date.now() + config.antecedenciaMinimaHoras * 60 * 60 * 1000);
  return instanteDoAtendimento(data, horaInicio) >= limite;
}

async function pedidoDaClinica(pedidoId: string, clinicaId: string) {
  // O filtro por clinicaId é o que impede mexer no pedido de outra clínica
  // trocando o id na URL.
  return prisma.pedido.findFirst({
    where: { id: pedidoId, clinicaId },
    include: {
      servico: {
        select: {
          duracaoMin: true,
          exigeEquipamento: true,
          equipamentoIlimitado: true,
          tipoEquipamento: true,
        },
      },
    },
  });
}

/**
 * Reagendamento pelo portal.
 *
 * O profissional já alocado continua no pedido se estiver livre no novo
 * horário — trocar de profissional a cada mudança de hora seria perder o
 * combinado com quem já conhece o caso. Se ele não estiver livre, o
 * reagendamento é recusado com o motivo, e a clínica escolhe outro horário.
 */
export async function reagendarPedido(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await exigirClinica();

  const pedidoId = String(dados.get("pedidoId") ?? "");
  const dataISO = String(dados.get("data") ?? "");
  const horaInicio = String(dados.get("horaInicio") ?? "");
  if (!dataISO || !horaInicio) return { ok: false, erro: "Escolha a nova data e o novo horário." };

  const pedido = await pedidoDaClinica(pedidoId, sessao.clinicaId);
  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };
  if (!STATUS_ATIVOS.includes(pedido.status)) {
    return { ok: false, erro: "Este atendimento já foi finalizado." };
  }

  if (!(await dentroDaJanelaDaClinica(pedido.data, pedido.horaInicio))) {
    const config = await parametros();
    return {
      ok: false,
      erro: `Faltam menos de ${config.antecedenciaMinimaHoras}h para este atendimento. Fale com a central para remarcar.`,
    };
  }

  const novaData = dataDeISO(dataISO);
  if (!(await dentroDaJanelaDaClinica(novaData, horaInicio))) {
    const config = await parametros();
    return { ok: false, erro: `O novo horário precisa de ${config.antecedenciaMinimaHoras}h de antecedência.` };
  }

  const resultado = await prisma.$transaction(async (tx) => {
    await travarRecursos(tx, {
      clinicaId: sessao.clinicaId,
      profissionalId: pedido.profissionalId,
      tipoEquipamento:
        pedido.equipamentoId && pedido.servico.exigeEquipamento ? pedido.servico.tipoEquipamento : null,
    });

    const impedimentos = await verificarAlocacao(
      {
        clinicaId: sessao.clinicaId,
        profissionalId: pedido.profissionalId,
        equipamentoId: pedido.equipamentoId,
        data: novaData,
        horaInicio,
        duracaoMin: pedido.duracaoMin,
        ignorarPedidoId: pedido.id,
      },
      tx
    );
    if (temBloqueio(impedimentos)) {
      return {
        ok: false as const,
        erro: impedimentos.filter((i) => i.bloqueante).map((i) => i.mensagem).join(" "),
      };
    }

    await tx.pedido.update({
      where: { id: pedido.id },
      data: { data: novaData, horaInicio },
    });

    return { ok: true as const };
  });

  if (!resultado.ok) return resultado;

  // Confirmação e lembrete antigos não valem mais: apagados, a fila remonta
  // com a data nova em vez de avisar a clínica do horário que não existe.
  await prisma.mensagemWhatsapp.deleteMany({
    where: { pedidoId: pedido.id, tipo: { in: ["CONFIRMACAO", "ALOCACAO", "LEMBRETE"] }, status: "PENDENTE" },
  });
  await enfileirarMensagem(pedido.id, "CONFIRMACAO");
  if (pedido.profissionalId) await enfileirarMensagem(pedido.id, "ALOCACAO");
  await sincronizarEvento(pedido.id);

  await registrarAuditoria(
    sessao.usuarioId,
    "Pedido",
    pedido.id,
    "reagendar-portal",
    `${isoDeData(pedido.data)} ${pedido.horaInicio} → ${dataISO} ${horaInicio}`
  );

  atualizarTelas();
  return { ok: true };
}

/** Cancelamento pelo portal, na mesma janela do reagendamento. */
export async function cancelarPeloPortal(pedidoId: string, motivo: string): Promise<Resultado> {
  const sessao = await exigirClinica();

  const pedido = await pedidoDaClinica(pedidoId, sessao.clinicaId);
  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };
  if (!podeTransicionar(pedido.status, "CANCELADO")) {
    return { ok: false, erro: "Este atendimento já foi finalizado." };
  }

  if (!(await dentroDaJanelaDaClinica(pedido.data, pedido.horaInicio))) {
    const config = await parametros();
    return {
      ok: false,
      erro: `Faltam menos de ${config.antecedenciaMinimaHoras}h para este atendimento. Fale com a central para cancelar.`,
    };
  }

  await prisma.pedido.update({
    where: { id: pedido.id },
    data: {
      status: "CANCELADO",
      canceladoEm: new Date(),
      motivoCancelamento: motivo ? `Cancelado pela clínica: ${motivo}` : "Cancelado pela clínica.",
    },
  });
  await prisma.mensagemWhatsapp.updateMany({
    where: { pedidoId: pedido.id, status: "PENDENTE" },
    data: { status: "CANCELADA" },
  });
  await sincronizarEvento(pedido.id);

  await registrarAuditoria(sessao.usuarioId, "Pedido", pedido.id, "cancelar-portal", motivo || undefined);

  atualizarTelas();
  return { ok: true };
}

/** Caminho da equipe interna para o caso em que o profissional não preenche. */
export async function marcarResultadoInterno(pedidoId: string, compareceu: boolean): Promise<Resultado> {
  const sessao = await exigirInterno();
  return registrarResultado(pedidoId, compareceu, sessao.usuarioId);
}

/**
 * Como esta clínica paga ESTE atendimento.
 *
 * Preenchido à mão pela equipe (ata de 14/09): depende do histórico e do
 * comportamento de cada clínica, que é coisa que o atendente sabe e o sistema
 * não tem como inferir.
 */
export async function definirCondicaoPagamento(pedidoId: string, condicao: string): Promise<Resultado> {
  const sessao = await exigirInterno();

  const valor = condicao.trim();
  if (valor && !condicaoValida(valor)) {
    return { ok: false, erro: "Condição de pagamento desconhecida." };
  }

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, select: { numero: true } });
  if (!pedido) return { ok: false, erro: "Agendamento não encontrado." };

  await prisma.pedido.update({
    where: { id: pedidoId },
    data: { condicaoPagamento: valor || null },
  });

  await registrarAuditoria(
    sessao.usuarioId,
    "Pedido",
    pedidoId,
    "condicao-pagamento",
    valor || "(em branco)"
  );

  atualizarTelas();
  return { ok: true };
}
