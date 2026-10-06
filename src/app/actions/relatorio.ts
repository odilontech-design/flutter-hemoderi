"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { comEnderecoDoPedido } from "@/lib/endereco";
import { exigirProfissional } from "@/lib/sessao";
import {
  ajudaCustoEmCentavos,
  camposClinicosEmBranco,
  CAMPOS_CLINICOS,
  divergiu,
  enderecoEmUmaLinha,
  lerServicosAdicionais,
} from "@/lib/relatorio";
import { comprovanteAceito, lerRecebimento } from "@/lib/recebimento";
import { registrarResultado, type Resultado } from "./pedidos";

/**
 * O relatório pós-atendimento — a peça central do portal do profissional.
 *
 * Ele fecha o pedido e registra o que aconteceu de fato. O repasse, porém,
 * não nasce daqui: desde a ata de 14/09, ele depende de a equipe APROVAR o
 * relatório (ver aprovarRelatorio em actions/financeiro). Em campo o
 * procedimento muda — membrana que virou stickbone, quantidade diferente do
 * combinado —, e pagar antes de alguém conferir é pagar o que a clínica
 * ainda vai contestar.
 *
 * O relatório continua EDITÁVEL enquanto não for aprovado: é o profissional
 * corrigindo o que digitou errado, não reabrindo um pagamento.
 */
export async function enviarRelatorio(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await exigirProfissional();

  const pedidoId = String(dados.get("pedidoId") ?? "");
  const compareceu = String(dados.get("compareceu") ?? "sim") === "sim";

  // O pedido precisa ser DESTE profissional. Sem esse filtro, trocar o id no
  // formulário fecharia o atendimento de outra pessoa.
  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId, profissionalId: sessao.profissionalId },
    select: {
      id: true,
      status: true,
      servicoId: true,
      doutorNome: true,
      clinica: { select: { nome: true, endereco: true, numero: true, bairro: true, cidade: true, uf: true } },
      endereco: { select: { endereco: true, numero: true, bairro: true, cidade: true, uf: true } },
      relatorio: { select: { aprovadoEm: true, comprovante: { select: { id: true } } } },
    },
  });
  if (!pedido) return { ok: false, erro: "Atendimento não encontrado na sua agenda." };

  // Reenvio corrige o que foi digitado errado — a não ser que a equipe já
  // tenha aprovado: dali em diante o relatório virou base de pagamento, e
  // mexer nele sozinho seria mexer no próprio repasse.
  const jaAprovado = pedido.relatorio?.aprovadoEm != null;
  if (jaAprovado) {
    return {
      ok: false,
      erro: "Este relatório já foi aprovado pela equipe. Fale com a central para qualquer correção.",
    };
  }
  if (pedido.status !== "ALOCADO" && !pedido.relatorio) {
    return { ok: false, erro: "Este atendimento já foi finalizado." };
  }

  // Campos clínicos: obrigatórios, mas "não se aplica" conta como resposta
  // (ata de 21/09). Só são exigidos quando houve atendimento — num "não
  // compareceu" não existe sinal vital para medir.
  const clinicos = Object.fromEntries(
    CAMPOS_CLINICOS.map((campo) => [campo.nome, String(dados.get(campo.nome) ?? "").trim() || null])
  ) as Record<string, string | null>;

  if (compareceu) {
    const faltando = camposClinicosEmBranco(clinicos);
    if (faltando.length > 0) {
      const nomes = faltando.map((c) => c.rotulo).join(", ");
      return {
        ok: false,
        erro: `Falta preencher: ${nomes}. Use "não se aplica" no que não foi medido neste atendimento.`,
      };
    }
  }

  const ajudaCustoCentavos = ajudaCustoEmCentavos(String(dados.get("ajudaCusto") ?? ""));
  if (ajudaCustoCentavos === undefined) {
    return { ok: false, erro: "Ajuda de custo: use só números, como 150,00." };
  }

  // O que foi recebido da clínica no ato (ata de 05/10). Só se pergunta
  // quando houve atendimento: numa falta não existe valor a receber.
  let recebimento: ReturnType<typeof lerRecebimento> | null = null;
  let comprovante: { nome: string; tipo: string; tamanho: number; dados: Buffer } | null = null;
  if (compareceu) {
    recebimento = lerRecebimento({
      situacao: String(dados.get("recebimento") ?? ""),
      forma: String(dados.get("formaRecebimento") ?? ""),
      valor: String(dados.get("valorRecebido") ?? ""),
    });
    if (!recebimento.ok) return { ok: false, erro: recebimento.erro };

    const arquivo = dados.get("comprovante");
    if (recebimento.dados.exigeComprovante && arquivo instanceof File && arquivo.size > 0) {
      const problema = comprovanteAceito(arquivo);
      if (problema) return { ok: false, erro: problema };
      comprovante = {
        nome: arquivo.name.slice(0, 120) || "comprovante",
        tipo: arquivo.type,
        tamanho: arquivo.size,
        dados: Buffer.from(await arquivo.arrayBuffer()),
      };
    }
    // Correção do relatório: o comprovante do envio anterior continua valendo
    // quando a pessoa não anexa outro.
    if (recebimento.dados.exigeComprovante && !comprovante && !pedido.relatorio?.comprovante) {
      return { ok: false, erro: "Anexe o comprovante do Pix ou do cartão para enviar o relatório." };
    }
  }
  const guardaComprovante = recebimento?.ok === true && recebimento.dados.exigeComprovante;

  const quantidade = Number(dados.get("quantidade") ?? 1);

  // O serviço principal pode ser trocado pelo profissional (ata de 02/10).
  // Igual ao agendado não é "troca" — fica nulo, e só divergência é guardada.
  let servicoRealizadoId: string | null = null;
  const escolhido = String(dados.get("servicoRealizadoId") ?? "");
  if (compareceu && escolhido && escolhido !== pedido.servicoId) {
    const existe = await prisma.servico.count({ where: { id: escolhido, ativo: true } });
    if (!existe) return { ok: false, erro: "O serviço principal informado não está mais no catálogo. Reabra o relatório e confira." };
    servicoRealizadoId = escolhido;
  }

  // Serviços do catálogo feitos além do agendado. Só entram os que existem e
  // estão ativos — o id vem do navegador e não vale por si só. Num "não
  // compareceu" não houve o que executar a mais.
  const adicionais = compareceu
    ? lerServicosAdicionais(dados.getAll("adicionalServicoId"), dados.getAll("adicionalQuantidade"))
    : [];
  if (adicionais.length > 0) {
    const validos = await prisma.servico.count({
      where: { id: { in: adicionais.map((a) => a.servicoId) }, ativo: true },
    });
    if (validos !== adicionais.length) {
      return { ok: false, erro: "Um dos serviços informados além do agendado não está mais no catálogo. Reabra o relatório e confira." };
    }
  }

  // Vem do navegador, no momento do envio — pode faltar (permissão negada,
  // sem GPS, formulário enviado de um jeito que não passou por lá). Nulo é
  // um estado normal aqui, não um erro: confirma presença quando dá, nunca
  // trava o relatório quando não dá.
  const latitude = Number(dados.get("latitude"));
  const longitude = Number(dados.get("longitude"));
  const precisaoMetros = Number(dados.get("precisaoMetros"));
  const localizacao =
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude, precisaoMetros: Number.isFinite(precisaoMetros) ? precisaoMetros : null }
      : { latitude: null, longitude: null, precisaoMetros: null };

  const clinicaNome = String(dados.get("clinicaNomeInformado") ?? "").trim();
  const endereco = String(dados.get("enderecoInformado") ?? "").trim();
  const doutor = String(dados.get("doutorNomeInformado") ?? "").trim();
  const correcoesDoAgendamento = {
    clinicaNomeInformado: divergiu(pedido.clinica.nome, clinicaNome) ? clinicaNome : null,
    enderecoInformado: divergiu(enderecoEmUmaLinha(comEnderecoDoPedido(pedido.clinica, pedido.endereco)), endereco) ? endereco : null,
    doutorNomeInformado: divergiu(pedido.doutorNome, doutor) ? doutor : null,
  };

  const conteudo = {
    compareceu,
    inicioReal: String(dados.get("inicioReal") ?? "") || null,
    fimReal: String(dados.get("fimReal") ?? "") || null,
    quantidade: Number.isFinite(quantidade) && quantidade > 0 ? Math.trunc(quantidade) : 1,
    servicoRealizadoId,
    intercorrencia: String(dados.get("intercorrencia") ?? "") === "sim",
    observacoes: String(dados.get("observacoes") ?? "") || null,
    ...clinicos,
    // O que a pessoa executou além do contratado — a membrana que virou
    // stickybone. Declarado aqui, validado pelo pós-venda na aprovação.
    servicosAdicionais: String(dados.get("servicosAdicionais") ?? "").trim() || null,
    ajudaCustoCentavos,
    ajudaCustoJustificativa: String(dados.get("ajudaCustoJustificativa") ?? "").trim() || null,
    recebimento: recebimento?.ok ? recebimento.dados.recebimento : null,
    formaRecebimento: recebimento?.ok ? recebimento.dados.formaRecebimento : null,
    valorRecebidoCentavos: recebimento?.ok ? recebimento.dados.valorRecebidoCentavos : null,
    // A chave PIX deixou de ser pedida a cada relatório (ata de 02/10): é
    // única e fixa no cadastro do profissional, e é dela que sai o pagamento.
    // Os dados do agendamento como ele aconteceu (ata de 28/09). Guardados
    // SÓ quando divergem do que estava marcado: o formulário chega com o
    // agendado preenchido, e gravar o texto igual encheria a conferência do
    // pós-venda de "divergências" que são o próprio valor de origem.
    ...correcoesDoAgendamento,
  };

  await prisma.$transaction(async (tx) => {
    const relatorio = await tx.relatorioAtendimento.upsert({
      where: { pedidoId: pedido.id },
      // Update de verdade, não vazio: reenviar é corrigir, e um upsert que
      // ignora a correção devolve "salvo" sem ter salvo nada.
      //
      // A correção derruba as conferências que o pós-venda já tinha feito: o
      // que foi validado era o texto anterior. Manter o "serviço conferido" em
      // cima de um serviço reescrito é pior que não ter conferência nenhuma,
      // porque parece conferido.
      update: {
        ...conteudo,
        ...localizacao,
        servicoValidadoEm: null,
        valorValidadoEm: null,
        ajudaCustoValidadaEm: null,
        // Reenviar é a resposta à devolução: o relatório volta para a fila
        // de conferência do pós-venda.
        devolvidoEm: null,
        motivoDevolucao: null,
        devolvidoPorId: null,
      },
      create: { pedidoId: pedido.id, profissionalId: sessao.profissionalId, ...conteudo, ...localizacao },
      select: { id: true },
    });

    // O comprovante só existe enquanto a resposta o exige: trocar Pix por
    // dinheiro, ou "recebeu" por "não recebeu", apaga o arquivo antigo.
    if (!guardaComprovante) {
      await tx.comprovanteRecebimento.deleteMany({ where: { relatorioId: relatorio.id } });
    } else if (comprovante) {
      await tx.comprovanteRecebimento.upsert({
        where: { relatorioId: relatorio.id },
        update: { ...comprovante, criadoEm: new Date() },
        create: { relatorioId: relatorio.id, ...comprovante },
      });
    }

    // A lista inteira é substituída: reenviar o relatório é reenviar o que
    // ele diz agora, inclusive o que a pessoa tirou.
    await tx.relatorioServicoAdicional.deleteMany({ where: { relatorioId: relatorio.id } });
    if (adicionais.length > 0) {
      await tx.relatorioServicoAdicional.createMany({
        data: adicionais.map((a) => ({ relatorioId: relatorio.id, ...a })),
      });
    }
  });

  // Mexe no pedido para a fila do pós-venda ver que há relatório novo (o aviso
  // de fila olha o `atualizadoEm` do pedido, e relatório reenviado não o muda).
  await prisma.pedido.update({ where: { id: pedido.id }, data: { atualizadoEm: new Date() } });

  // Só fecha o pedido na primeira vez; correção não reabre a esteira.
  const resultado =
    pedido.status === "ALOCADO"
      ? await registrarResultado(pedido.id, compareceu, sessao.usuarioId)
      : { ok: true as const };

  revalidatePath("/profissional");
  revalidatePath("/profissional/relatorios");
  revalidatePath("/painel/pedidos");
  revalidatePath("/painel/financeiro");
  return resultado;
}
