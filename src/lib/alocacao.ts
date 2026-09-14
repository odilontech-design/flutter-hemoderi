/**
 * Alocação: decidir se um profissional (e um equipamento) podem assumir um
 * atendimento em determinado horário, e quais horários ainda estão livres.
 *
 * São quatro recursos disputados ao mesmo tempo, e ignorar qualquer um deles
 * produz um agendamento que a operação não consegue cumprir:
 *
 *   • o profissional, que não se divide;
 *   • o equipamento, que é contável e viaja com ele;
 *   • a sala da clínica — a clínica do briefing tem 10, então dois
 *     atendimentos simultâneos no mesmo endereço são normais, onze não são;
 *   • a disponibilidade que o profissional declarou.
 *
 * A aritmética pura está em lib/agenda.ts e é testada sozinha; aqui é só a
 * parte que precisa do banco.
 *
 * Com dezenas de profissionais e duas portas de entrada (portal da clínica e
 * painel interno) marcando ao mesmo tempo, checar disponibilidade e só depois
 * gravar deixa uma brecha: duas requisições podem ler "livre" antes de
 * qualquer uma escrever, e as duas escreverem. `travarRecursos` fecha essa
 * brecha — quem chama esta lib dentro de uma transação, tendo travado antes
 * os recursos em jogo, tem a garantia de que o que `verificarAlocacao` leu
 * continua verdade até o `commit`.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  cabeEmAlgumaJanela,
  haSobreposicao,
  horariosLivres,
  intervaloDe,
  intervalosDeBloqueio,
  janelasDoDia,
  mesclarIntervalos,
  subtrairIntervalos,
  type Intervalo,
} from "@/lib/agenda";
import { dataDeISO, instanteDoAtendimento, paraMinutos } from "@/lib/data";
import { STATUS_ATIVOS } from "@/lib/pedido";

/** Aceita tanto o cliente normal quanto o `tx` de dentro de uma transação. */
export type ClientePrisma = PrismaClient | Prisma.TransactionClient;

/**
 * Trava, na ordem, os recursos que um agendamento disputa — só vale dentro de
 * uma transação (`pg_advisory_xact_lock` libera sozinho no commit/rollback).
 *
 * A ordem é sempre a mesma (clínica, depois tipo de equipamento, depois
 * profissional) para que duas transações concorrentes, mesmo disputando os
 * mesmos dois recursos, nunca fiquem cada uma esperando a trava que a outra
 * já está segurando — isso seria deadlock, não fila.
 */
export async function travarRecursos(
  tx: Prisma.TransactionClient,
  recursos: { clinicaId?: string | null; tipoEquipamento?: string | null; profissionalId?: string | null }
): Promise<void> {
  const chaves: { tipo: string; valor: string }[] = [];
  if (recursos.clinicaId) chaves.push({ tipo: "clinica", valor: recursos.clinicaId });
  if (recursos.tipoEquipamento) chaves.push({ tipo: "equipamento", valor: recursos.tipoEquipamento });
  if (recursos.profissionalId) chaves.push({ tipo: "profissional", valor: recursos.profissionalId });

  for (const { tipo, valor } of chaves.sort((a, b) => (a.tipo + a.valor).localeCompare(b.tipo + b.valor))) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tipo}), hashtext(${valor}))`;
  }
}

export type Impedimento = {
  tipo: "PROFISSIONAL" | "EQUIPAMENTO" | "SALA" | "BLOQUEIO" | "DISPONIBILIDADE" | "ANTECEDENCIA";
  mensagem: string;
  /**
   * Impedimento bloqueante para a equipe interna. Atender fora da janela
   * declarada é combinável por telefone — vira aviso, não trava. Sala cheia,
   * equipamento reservado e profissional ocupado são fatos físicos e travam.
   */
  bloqueante: boolean;
};

async function parametros() {
  return prisma.parametros.upsert({
    where: { id: "hemoderi" },
    update: {},
    create: { id: "hemoderi" },
  });
}

/**
 * Verifica um horário para um profissional. Devolve a lista do que está no
 * caminho — vazia quando está livre.
 *
 * `ignorarPedidoId` existe para o reagendamento: um pedido não pode conflitar
 * consigo mesmo.
 */
export async function verificarAlocacao(
  {
    clinicaId,
    profissionalId,
    equipamentoId,
    data,
    horaInicio,
    duracaoMin,
    ignorarPedidoId,
  }: {
    clinicaId: string;
    profissionalId?: string | null;
    equipamentoId?: string | null;
    data: Date;
    horaInicio: string;
    duracaoMin: number;
    ignorarPedidoId?: string;
  },
  bd: ClientePrisma = prisma
): Promise<Impedimento[]> {
  const alvo = intervaloDe(horaInicio, duracaoMin);
  const impedimentos: Impedimento[] = [];

  const pedidosDoDia = await bd.pedido.findMany({
    where: {
      data,
      status: { in: STATUS_ATIVOS },
      ...(ignorarPedidoId ? { id: { not: ignorarPedidoId } } : {}),
      OR: [
        { clinicaId },
        ...(profissionalId ? [{ profissionalId }] : []),
        ...(equipamentoId ? [{ equipamentoId }] : []),
      ],
    },
    select: {
      id: true,
      numero: true,
      horaInicio: true,
      duracaoMin: true,
      clinicaId: true,
      profissionalId: true,
      equipamentoId: true,
    },
  });

  const sobrepostos = pedidosDoDia.filter((p) =>
    haSobreposicao(alvo, intervaloDe(p.horaInicio, p.duracaoMin))
  );

  if (profissionalId) {
    const ocupado = sobrepostos.find((p) => p.profissionalId === profissionalId);
    if (ocupado) {
      impedimentos.push({
        tipo: "PROFISSIONAL",
        mensagem: `Profissional já está no pedido ${ocupado.numero} nesse horário.`,
        bloqueante: true,
      });
    }
  }

  if (equipamentoId) {
    const reservado = sobrepostos.find((p) => p.equipamentoId === equipamentoId);
    if (reservado) {
      impedimentos.push({
        tipo: "EQUIPAMENTO",
        mensagem: `Equipamento já reservado no pedido ${reservado.numero}.`,
        bloqueante: true,
      });
    }
  }

  const clinica = await bd.clinica.findUnique({
    where: { id: clinicaId },
    select: { salas: true, nome: true },
  });
  const ocupacaoDaClinica = sobrepostos.filter((p) => p.clinicaId === clinicaId).length;
  if (clinica && ocupacaoDaClinica >= clinica.salas) {
    impedimentos.push({
      tipo: "SALA",
      mensagem: `${clinica.nome} já tem ${ocupacaoDaClinica} atendimento(s) nesse horário e ${clinica.salas} sala(s).`,
      bloqueante: true,
    });
  }

  if (profissionalId) {
    const [disponibilidades, bloqueios] = await Promise.all([
      bd.disponibilidade.findMany({ where: { profissionalId } }),
      bd.bloqueio.findMany({ where: { profissionalId, data } }),
    ]);

    const ausencias = intervalosDeBloqueio(bloqueios);
    if (ausencias.some((a) => haSobreposicao(alvo, a))) {
      impedimentos.push({
        tipo: "BLOQUEIO",
        mensagem: "Profissional marcou ausência nesse dia/horário.",
        bloqueante: true,
      });
    }

    const janelas = janelasDoDia(disponibilidades, data.getUTCDay());
    if (janelas.length === 0 || !cabeEmAlgumaJanela(alvo, janelas)) {
      impedimentos.push({
        tipo: "DISPONIBILIDADE",
        mensagem: "Horário fora da disponibilidade declarada pelo profissional.",
        bloqueante: false,
      });
    }
  }

  return impedimentos;
}

export function temBloqueio(impedimentos: Impedimento[]): boolean {
  return impedimentos.some((i) => i.bloqueante);
}

/**
 * Horários livres de um profissional para um serviço num dia — o que alimenta
 * tanto o formulário interno quanto o portal da clínica.
 *
 * `exigirAntecedencia` só é ligado no portal: a equipe interna encaixa
 * urgência para daqui a duas horas, o cliente sozinho não, senão a operação
 * descobre o pedido quando já não há como alocar ninguém.
 */
export async function horariosDisponiveis({
  clinicaId,
  servicoId,
  profissionalId,
  dataISO,
  ignorarPedidoId,
  exigirAntecedencia = false,
}: {
  clinicaId: string;
  servicoId: string;
  /**
   * Nulo quando ainda não há profissional definido. Nesse caso a janela é a
   * do expediente da operação — não há agenda individual a consultar, e as
   * travas que restam (sala e equipamento) continuam valendo.
   */
  profissionalId: string | null;
  dataISO: string;
  ignorarPedidoId?: string;
  exigirAntecedencia?: boolean;
}): Promise<string[]> {
  const data = dataDeISO(dataISO);

  const [config, servico, clinica, disponibilidades, bloqueios] = await Promise.all([
    parametros(),
    prisma.servico.findUnique({ where: { id: servicoId } }),
    prisma.clinica.findUnique({ where: { id: clinicaId }, select: { salas: true } }),
    profissionalId ? prisma.disponibilidade.findMany({ where: { profissionalId } }) : [],
    profissionalId ? prisma.bloqueio.findMany({ where: { profissionalId, data } }) : [],
  ]);
  if (!servico || !clinica) return [];

  const pedidosDoDia = await prisma.pedido.findMany({
    where: {
      data,
      status: { in: STATUS_ATIVOS },
      ...(ignorarPedidoId ? { id: { not: ignorarPedidoId } } : {}),
      OR: [
        { clinicaId },
        ...(profissionalId ? [{ profissionalId }] : []),
        { equipamentoId: { not: null } },
      ],
    },
    select: {
      horaInicio: true,
      duracaoMin: true,
      clinicaId: true,
      profissionalId: true,
      equipamentoId: true,
    },
  });

  // A janela útil é a interseção de três limites: o horário em que a operação
  // funciona, o que o profissional declarou e o que ele não bloqueou.
  const expediente: Intervalo = {
    inicio: paraMinutos(config.horaAbertura),
    fim: paraMinutos(config.horaFechamento),
  };
  // Sem profissional escolhido, a janela é o expediente inteiro.
  const declaradas = profissionalId
    ? janelasDoDia(disponibilidades, data.getUTCDay())
    : [expediente];
  const dentroDoExpediente = mesclarIntervalos(declaradas)
    .map((j) => ({ inicio: Math.max(j.inicio, expediente.inicio), fim: Math.min(j.fim, expediente.fim) }))
    .filter((j) => j.fim > j.inicio);
  const janelas = subtrairIntervalos(dentroDoExpediente, intervalosDeBloqueio(bloqueios));

  const ocupacoesDoProfissional = pedidosDoDia
    .filter((p) => p.profissionalId === profissionalId)
    .map((p) => intervaloDe(p.horaInicio, p.duracaoMin));

  const candidatos = horariosLivres({
    janelas,
    ocupacoes: ocupacoesDoProfissional,
    duracaoMin: servico.duracaoMin,
  });

  // O pool considerado é só o do TIPO que o serviço exige — um AirFlow não
  // substitui um laser LiteTouch. Sem tipo definido, cai no comportamento de
  // antes (qualquer equipamento disponível), só para não travar cadastro
  // incompleto.
  // Serviço marcado como ilimitado usa aparelho que a operação tem de sobra
  // (ou que o profissional leva o próprio): ele continua exigindo equipamento
  // no relatório, mas não disputa uma unidade do estoque. Sem essa exceção,
  // um item abundante limita a agenda como se fosse escasso.
  const contaEstoque = servico.exigeEquipamento && !servico.equipamentoIlimitado;

  const poolEquipamentos = contaEstoque
    ? await prisma.equipamento.findMany({
        where: {
          status: "DISPONIVEL",
          ...(servico.tipoEquipamento ? { tipo: servico.tipoEquipamento } : {}),
        },
        select: { id: true },
      })
    : [];
  const idsDoPool = new Set(poolEquipamentos.map((e) => e.id));

  const limite = exigirAntecedencia
    ? new Date(Date.now() + config.antecedenciaMinimaHoras * 60 * 60 * 1000)
    : new Date();

  return candidatos.filter((hora) => {
    const alvo = intervaloDe(hora, servico.duracaoMin);

    if (instanteDoAtendimento(data, hora) < limite) return false;

    const naClinica = pedidosDoDia.filter(
      (p) => p.clinicaId === clinicaId && haSobreposicao(alvo, intervaloDe(p.horaInicio, p.duracaoMin))
    ).length;
    if (naClinica >= clinica.salas) return false;

    if (contaEstoque) {
      if (poolEquipamentos.length === 0) return false;
      const emUso = pedidosDoDia.filter(
        (p) =>
          p.equipamentoId &&
          idsDoPool.has(p.equipamentoId) &&
          haSobreposicao(alvo, intervaloDe(p.horaInicio, p.duracaoMin))
      ).length;
      if (emUso >= poolEquipamentos.length) return false;
    }

    return true;
  });
}

/**
 * Quem, dentre os profissionais ativos, já não serve para este horário — está
 * em outro atendimento que se sobrepõe, ou marcou ausência. Não olha
 * disponibilidade declarada (isso é aviso, não bloqueio — ver `Impedimento`).
 *
 * Alimenta o seletor de "alocar profissional" na esteira. Com meia dúzia de
 * profissionais, oferecer todo mundo e deixar a equipe descobrir por
 * tentativa quem está livre é só um clique extra; com dezenas, é a esteira
 * inteira travando em tentativa e erro. Uma consulta só, reaproveitada para
 * todos os profissionais do dia — não uma por nome da lista.
 */
export async function profissionaisIndisponiveis(
  data: Date,
  horaInicio: string,
  duracaoMin: number,
  ignorarPedidoId?: string
): Promise<Set<string>> {
  const alvo = intervaloDe(horaInicio, duracaoMin);

  const [pedidosDoDia, bloqueiosDoDia] = await Promise.all([
    prisma.pedido.findMany({
      where: {
        data,
        status: { in: STATUS_ATIVOS },
        profissionalId: { not: null },
        ...(ignorarPedidoId ? { id: { not: ignorarPedidoId } } : {}),
      },
      select: { profissionalId: true, horaInicio: true, duracaoMin: true },
    }),
    prisma.bloqueio.findMany({
      where: { data },
      select: { profissionalId: true, horaInicio: true, horaFim: true },
    }),
  ]);

  const indisponiveis = new Set<string>();
  for (const p of pedidosDoDia) {
    if (p.profissionalId && haSobreposicao(alvo, intervaloDe(p.horaInicio, p.duracaoMin))) {
      indisponiveis.add(p.profissionalId);
    }
  }
  for (const b of bloqueiosDoDia) {
    const ausencia =
      b.horaInicio && b.horaFim ? { inicio: paraMinutos(b.horaInicio), fim: paraMinutos(b.horaFim) } : { inicio: 0, fim: 24 * 60 };
    if (haSobreposicao(alvo, ausencia)) indisponiveis.add(b.profissionalId);
  }

  return indisponiveis;
}

/**
 * Primeiro equipamento livre no horário — usado ao alocar serviço que exige.
 *
 * `tipoEquipamento` restringe a busca ao tipo que o serviço pede (casa com
 * Equipamento.tipo). Sem tipo definido, considera qualquer equipamento
 * disponível — comportamento de transição para cadastro ainda incompleto.
 */
export async function equipamentoLivre(
  data: Date,
  horaInicio: string,
  duracaoMin: number,
  tipoEquipamento?: string | null,
  ignorarPedidoId?: string,
  bd: ClientePrisma = prisma
): Promise<string | null> {
  const alvo = intervaloDe(horaInicio, duracaoMin);

  const [equipamentos, pedidos] = await Promise.all([
    bd.equipamento.findMany({
      where: { status: "DISPONIVEL", ...(tipoEquipamento ? { tipo: tipoEquipamento } : {}) },
      select: { id: true },
    }),
    bd.pedido.findMany({
      where: {
        data,
        status: { in: STATUS_ATIVOS },
        equipamentoId: { not: null },
        ...(ignorarPedidoId ? { id: { not: ignorarPedidoId } } : {}),
      },
      select: { equipamentoId: true, horaInicio: true, duracaoMin: true },
    }),
  ]);

  const ocupados = new Set(
    pedidos
      .filter((p) => haSobreposicao(alvo, intervaloDe(p.horaInicio, p.duracaoMin)))
      .map((p) => p.equipamentoId as string)
  );

  return equipamentos.find((e) => !ocupados.has(e.id))?.id ?? null;
}

export { parametros };
