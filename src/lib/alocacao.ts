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
 */

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
export async function verificarAlocacao({
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
}): Promise<Impedimento[]> {
  const alvo = intervaloDe(horaInicio, duracaoMin);
  const impedimentos: Impedimento[] = [];

  const pedidosDoDia = await prisma.pedido.findMany({
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

  const clinica = await prisma.clinica.findUnique({
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
      prisma.disponibilidade.findMany({ where: { profissionalId } }),
      prisma.bloqueio.findMany({ where: { profissionalId, data } }),
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
  profissionalId: string;
  dataISO: string;
  ignorarPedidoId?: string;
  exigirAntecedencia?: boolean;
}): Promise<string[]> {
  const data = dataDeISO(dataISO);

  const [config, servico, clinica, disponibilidades, bloqueios] = await Promise.all([
    parametros(),
    prisma.servico.findUnique({ where: { id: servicoId } }),
    prisma.clinica.findUnique({ where: { id: clinicaId }, select: { salas: true } }),
    prisma.disponibilidade.findMany({ where: { profissionalId } }),
    prisma.bloqueio.findMany({ where: { profissionalId, data } }),
  ]);
  if (!servico || !clinica) return [];

  const pedidosDoDia = await prisma.pedido.findMany({
    where: {
      data,
      status: { in: STATUS_ATIVOS },
      ...(ignorarPedidoId ? { id: { not: ignorarPedidoId } } : {}),
      OR: [{ clinicaId }, { profissionalId }, { equipamentoId: { not: null } }],
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
  const declaradas = janelasDoDia(disponibilidades, data.getUTCDay());
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

  const equipamentosLivres = servico.exigeEquipamento
    ? await prisma.equipamento.count({ where: { status: "DISPONIVEL" } })
    : 0;

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

    if (servico.exigeEquipamento) {
      const emUso = pedidosDoDia.filter(
        (p) => p.equipamentoId && haSobreposicao(alvo, intervaloDe(p.horaInicio, p.duracaoMin))
      ).length;
      if (emUso >= equipamentosLivres) return false;
    }

    return true;
  });
}

/** Primeiro equipamento livre no horário — usado ao alocar serviço que exige. */
export async function equipamentoLivre(
  data: Date,
  horaInicio: string,
  duracaoMin: number,
  ignorarPedidoId?: string
): Promise<string | null> {
  const alvo = intervaloDe(horaInicio, duracaoMin);

  const [equipamentos, pedidos] = await Promise.all([
    prisma.equipamento.findMany({ where: { status: "DISPONIVEL" }, select: { id: true } }),
    prisma.pedido.findMany({
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
