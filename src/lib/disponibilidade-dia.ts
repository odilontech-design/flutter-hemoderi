import { cabeEmAlgumaJanela, haSobreposicao, intervalosDeBloqueio, janelasDoDia, type JanelaDeclarada } from "@/lib/agenda";
import { paraMinutos } from "@/lib/data";
import { TURNOS, type ChaveTurno, type Turno } from "@/lib/turnos";

/**
 * Edição de um dia do calendário (pedido de 04/11: "as datas no calendário
 * sejam editáveis"). O profissional diz em que turnos está disponível NAQUELE
 * dia; o sistema traduz isso para o que já existe — janela de um dia só
 * quando o padrão não cobre o turno, ausência quando cobre e ele não pode.
 */

/** Os turnos que o calendário edita. "Dia inteiro" é manhã + tarde. */
export const TURNOS_DO_DIA: Turno[] = TURNOS.filter((t) => t.chave !== "INTEGRAL");

const intervalo = (t: Turno) => ({ inicio: paraMinutos(t.horaInicio), fim: paraMinutos(t.horaFim) });

/** Em que turnos o profissional está disponível nesta data, hoje. */
export function turnosDisponiveis(
  janelas: JanelaDeclarada[],
  bloqueios: { horaInicio: string | null; horaFim: string | null }[],
  data: Date
): ChaveTurno[] {
  const validas = janelasDoDia(janelas, data);
  const ausencias = intervalosDeBloqueio(bloqueios);
  return TURNOS_DO_DIA.filter(
    (t) => cabeEmAlgumaJanela(intervalo(t), validas) && !ausencias.some((a) => haSobreposicao(intervalo(t), a))
  ).map((t) => t.chave);
}

export type PlanoDoDia = {
  /** Turnos a abrir com uma janela só para esta data. */
  abrir: Turno[];
  /** Turnos a fechar com ausência (o padrão cobre, mas neste dia não pode). */
  fechar: Turno[];
};

/**
 * O que gravar para o dia ficar como o profissional marcou. `outrasJanelas`
 * são as que NÃO são exclusivas deste dia (o padrão semanal e os períodos):
 * as de um dia só e as ausências da data são refeitas do zero.
 */
export function planoDoDia(outrasJanelas: JanelaDeclarada[], data: Date, desejados: ChaveTurno[]): PlanoDoDia {
  const cobertas = janelasDoDia(outrasJanelas, data);
  const querDiaInteiro = desejados.includes("INTEGRAL");
  const abrir: Turno[] = [];
  const fechar: Turno[] = [];
  for (const t of TURNOS_DO_DIA) {
    const quer = querDiaInteiro || desejados.includes(t.chave);
    const coberto = cabeEmAlgumaJanela(intervalo(t), cobertas);
    if (quer && !coberto) abrir.push(t);
    if (!quer && coberto) fechar.push(t);
  }
  return { abrir, fechar };
}
