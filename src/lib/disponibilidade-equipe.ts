import { prisma } from "@/lib/prisma";
import { haSobreposicao, intervaloDe, type Intervalo } from "@/lib/agenda";
import { paraMinutos } from "@/lib/data";
import { STATUS_ATIVOS } from "@/lib/pedido";
import { TURNOS, type ChaveTurno } from "@/lib/turnos";

/**
 * A grade de disponibilidade da equipe, para a logística acompanhar.
 *
 * A ata de 28/09 pediu uma tela no acesso logístico "para a Joyce acompanhar
 * a disponibilidade das equipes". A informação já existia espalhada — cada
 * profissional declara a dele em `/profissional/disponibilidade` —, mas a
 * logística não tinha onde ver todo mundo de uma vez. Alocar sem essa visão
 * é adivinhar, ou abrir sessenta agendas uma a uma.
 *
 * A grade cruza três fontes, na ordem em que uma vence a outra:
 *
 *   1. AUSÊNCIA (Bloqueio) — o profissional avisou que não vai poder. Vence
 *      tudo: de nada adianta ter declarado a manhã de terça se marcou
 *      ausência nessa terça.
 *   2. OCUPADO (Pedido ativo alocado) — já tem atendimento no turno. Não é
 *      "indisponível": o turno da tarde comporta mais de um horário, então a
 *      logística ainda pode caber outro; a tela mostra quantos já tem.
 *   3. DECLARADO (Disponibilidade recorrente) — disse que pode naquele dia da
 *      semana e turno. Sem isso, é "não declarou" — que não é "não pode",
 *      é "a logística não sabe" e trata caso a caso.
 */

export type EstadoTurno = "livre" | "ocupado" | "ausente" | "sem-declaracao";

export type TurnoDoDia = {
  turno: ChaveTurno;
  estado: EstadoTurno;
  /** Quantos atendimentos já ocupam o turno — só faz sentido em "ocupado". */
  atendimentos: number;
};

export type DiaDoProfissional = {
  /** ISO do dia (yyyy-mm-dd), para casar com a coluna da grade. */
  iso: string;
  turnos: TurnoDoDia[];
};

export type LinhaDaEquipe = {
  profissionalId: string;
  nome: string;
  dias: DiaDoProfissional[];
};

/** Só os turnos com hora de verdade entram na grade — INTEGRAL é os dois
 *  juntos, e não uma terceira coluna. */
const TURNOS_GRADE = TURNOS.filter((t) => t.chave !== "INTEGRAL");

function isoDoDia(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** O turno como intervalo de minutos desde a meia-noite. */
function intervaloDoTurno(turno: (typeof TURNOS)[number]): Intervalo {
  return { inicio: paraMinutos(turno.horaInicio), fim: paraMinutos(turno.horaFim) };
}

/**
 * Monta a grade para uma lista de dias.
 *
 * Uma consulta por tabela e o cruzamento em memória: com dezenas de
 * profissionais e uma janela de dias curta, buscar tudo de uma vez e casar
 * aqui é mais barato — e mais legível — que uma consulta por célula.
 */
export async function disponibilidadeDaEquipe(dias: Date[]): Promise<LinhaDaEquipe[]> {
  if (dias.length === 0) return [];

  const inicio = dias[0];
  const fim = dias[dias.length - 1];
  // O fim do intervalo é o dia seguinte ao último, para o `lt` pegar o último
  // dia inteiro sem depender da hora gravada.
  const fimExclusivo = new Date(fim.getTime() + 24 * 60 * 60 * 1000);

  const [profissionais, disponibilidades, bloqueios, pedidos] = await Promise.all([
    prisma.profissional.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.disponibilidade.findMany({
      select: { profissionalId: true, diaSemana: true, horaInicio: true, horaFim: true },
    }),
    prisma.bloqueio.findMany({
      where: { data: { gte: inicio, lt: fimExclusivo } },
      select: { profissionalId: true, data: true, horaInicio: true, horaFim: true },
    }),
    prisma.pedido.findMany({
      where: {
        data: { gte: inicio, lt: fimExclusivo },
        status: { in: STATUS_ATIVOS },
        profissionalId: { not: null },
      },
      select: { profissionalId: true, data: true, horaInicio: true, duracaoMin: true },
    }),
  ]);

  return profissionais.map((profissional) => {
    const minhasJanelas = disponibilidades.filter((d) => d.profissionalId === profissional.id);
    const meusBloqueios = bloqueios.filter((b) => b.profissionalId === profissional.id);
    const meusPedidos = pedidos.filter((p) => p.profissionalId === profissional.id);

    const diasDoProfissional = dias.map((dia): DiaDoProfissional => {
      const iso = isoDoDia(dia);
      const diaSemana = dia.getUTCDay();

      const turnos = TURNOS_GRADE.map((turno): TurnoDoDia => {
        const faixa = intervaloDoTurno(turno);

        // 1. Ausência vence tudo. Bloqueio sem hora é o dia inteiro.
        const ausente = meusBloqueios.some((b) => {
          if (isoDoDia(b.data) !== iso) return false;
          const faixaBloqueio =
            b.horaInicio && b.horaFim
              ? { inicio: paraMinutos(b.horaInicio), fim: paraMinutos(b.horaFim) }
              : { inicio: 0, fim: 24 * 60 };
          return haSobreposicao(faixa, faixaBloqueio);
        });
        if (ausente) return { turno: turno.chave, estado: "ausente", atendimentos: 0 };

        const declarou = minhasJanelas.some(
          (j) => j.diaSemana === diaSemana && haSobreposicao(faixa, { inicio: paraMinutos(j.horaInicio), fim: paraMinutos(j.horaFim) })
        );

        const atendimentos = meusPedidos.filter(
          (p) => isoDoDia(p.data) === iso && haSobreposicao(faixa, intervaloDe(p.horaInicio, p.duracaoMin))
        ).length;

        // Ocupado é mostrado mesmo sem declaração: um atendimento alocado num
        // turno é fato, e esconder isso só porque a janela recorrente não foi
        // cadastrada daria à logística uma agenda mais vazia do que a real.
        if (atendimentos > 0) return { turno: turno.chave, estado: "ocupado", atendimentos };
        if (declarou) return { turno: turno.chave, estado: "livre", atendimentos: 0 };
        return { turno: turno.chave, estado: "sem-declaracao", atendimentos: 0 };
      });

      return { iso, turnos };
    });

    return { profissionalId: profissional.id, nome: profissional.nome, dias: diasDoProfissional };
  });
}

export { TURNOS_GRADE };
