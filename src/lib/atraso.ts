import { instanteDoAtendimento } from "./data";

/**
 * Atraso de chegada: quanto tempo depois do combinado o profissional
 * registrou que chegou.
 *
 * Nasceu da ata de 28/09. O André pediu o relatório para "alinhar
 * expectativas" depois do caso do Luiz Carlos, que se perdeu dentro de um
 * edifício grande: o problema real não é a pessoa que chega tarde, é a
 * clínica esperando sem saber se alguém vem. Por isso o número vem do botão
 * de chegada — e não de GPS, que a mesma ata dispensou.
 */

/**
 * Quanto um atraso pode ser antes de virar atraso.
 *
 * Dez minutos não é leniência: é o que separa trânsito e elevador de um
 * problema de operação. Sem tolerância, o relatório listaria quase todo
 * atendimento e viraria uma tela que ninguém abre — e aí o atraso de uma
 * hora, que é o que importa, se perde no meio.
 */
export const TOLERANCIA_MINUTOS = 10;

/**
 * Minutos entre o horário agendado e a chegada registrada.
 *
 * Negativo quando a pessoa chegou adiantada, que é informação boa e não
 * precisa ser escondida atrás de um zero.
 */
export function minutosDeAtraso(data: Date, horaInicio: string, checkinEm: Date): number {
  const combinado = instanteDoAtendimento(data, horaInicio);
  return Math.round((checkinEm.getTime() - combinado.getTime()) / 60_000);
}

/** Passou da tolerância? É o que entra no relatório. */
export function houveAtraso(data: Date, horaInicio: string, checkinEm: Date | null): boolean {
  if (!checkinEm) return false;
  return minutosDeAtraso(data, horaInicio, checkinEm) > TOLERANCIA_MINUTOS;
}

/**
 * "1h20" em vez de "80 min" — quem lê o relatório está comparando atrasos,
 * e minuto corrido acima de uma hora exige conta de cabeça.
 */
export function formatarAtraso(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}
