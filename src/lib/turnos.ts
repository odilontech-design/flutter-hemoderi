/**
 * Disponibilidade declarada por turno, não por horário digitado.
 *
 * O profissional pensa em "posso de manhã", não em "08:00 às 12:00". Pedir o
 * horário exato transferia para ele uma tradução que o sistema sabe fazer — e
 * era onde a janela saía errada (13h30 em vez de 13h, meia hora que some da
 * agenda de sessenta pessoas).
 *
 * O período integral é o dia inteiro; o horário de funcionamento da operação
 * (Parametros) continua sendo o limite externo, então "integral" na prática
 * significa "o que a operação abrir".
 */

export type ChaveTurno = "MANHA" | "TARDE" | "INTEGRAL";

export type Turno = {
  chave: ChaveTurno;
  rotulo: string;
  horaInicio: string;
  horaFim: string;
  descricao: string;
};

export const TURNOS: Turno[] = [
  {
    chave: "MANHA",
    rotulo: "Manhã",
    horaInicio: "08:00",
    horaFim: "12:00",
    descricao: "onde a operação mais precisa de gente",
  },
  {
    chave: "TARDE",
    rotulo: "Tarde",
    horaInicio: "13:00",
    horaFim: "18:00",
    descricao: "",
  },
  {
    chave: "INTEGRAL",
    rotulo: "Dia inteiro",
    horaInicio: "00:00",
    horaFim: "23:59",
    descricao: "vale o horário de funcionamento da operação",
  },
];

export function turnoPorChave(chave: string): Turno | undefined {
  return TURNOS.find((t) => t.chave === chave);
}

/**
 * Que turno uma janela já gravada representa — para a tela mostrar "Manhã"
 * em vez de "08:00 às 12:00" no que foi declarado antes desta mudança, e
 * para não perder as janelas fora do padrão (que continuam aparecendo com o
 * horário cru).
 */
export function turnoDaJanela(horaInicio: string, horaFim: string): Turno | undefined {
  return TURNOS.find((t) => t.horaInicio === horaInicio && t.horaFim === horaFim);
}

export function rotuloDaJanela(horaInicio: string, horaFim: string): string {
  const turno = turnoDaJanela(horaInicio, horaFim);
  return turno ? turno.rotulo : `${horaInicio} às ${horaFim}`;
}
