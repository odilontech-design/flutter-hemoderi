/**
 * Quantidade e total de um serviço no agendamento (ata de 01/10).
 *
 * Três regras que o André descreveu:
 *   • Light Touch cobra por dente tratado ou por paciente — a clínica informa
 *     a quantidade e o preço final acompanha.
 *   • PRF é UM por paciente. Para outro paciente é outro agendamento, não um
 *     "2" no campo — a coleta e o preparo são por pessoa.
 *   • O preço é cobrado por paciente, por período ou por hora — o que a
 *     quantidade significa depende disso.
 */

import type { UnidadeCobranca } from "@prisma/client";

export type RegraDeQuantidade = {
  permiteQuantidade: boolean;
  quantidadeMaxima: number | null;
};

export const ROTULO_UNIDADE: Record<UnidadeCobranca, string> = {
  PACIENTE: "por paciente",
  PERIODO: "por período",
  HORA: "por hora",
};

/**
 * A quantidade que vale: serviço sem quantidade variável é sempre 1, e o
 * resto é inteiro entre 1 e o máximo (quando existe). Nunca devolve algo
 * inválido — quem chama grava o resultado.
 */
export function quantidadeEfetiva(regra: RegraDeQuantidade, pedida: unknown): number {
  if (!regra.permiteQuantidade) return 1;
  const n = Math.trunc(Number(pedida));
  if (!Number.isFinite(n) || n < 1) return 1;
  return regra.quantidadeMaxima ? Math.min(n, regra.quantidadeMaxima) : n;
}

/** A quantidade foi aceita como veio, ou o sistema precisou corrigir? */
export function quantidadeValida(regra: RegraDeQuantidade, pedida: unknown): boolean {
  const n = Number(pedida);
  if (!Number.isInteger(n) || n < 1) return false;
  if (!regra.permiteQuantidade) return n === 1;
  return !regra.quantidadeMaxima || n <= regra.quantidadeMaxima;
}

export function totalDoItem(valorUnitarioCentavos: number, quantidade: number): number {
  return valorUnitarioCentavos * quantidade;
}

/**
 * Duração que o atendimento ocupa na agenda. Em serviço cobrado por hora com
 * quantidade, a quantidade SÃO as horas: três horas contratadas reservam três
 * blocos, não um — senão o preço sobe e a agenda continua achando que só há
 * uma hora ocupada.
 */
export function duracaoEfetiva(
  servico: { duracaoMin: number; unidadeCobranca: UnidadeCobranca; permiteQuantidade: boolean },
  quantidade: number
): number {
  if (servico.unidadeCobranca === "HORA" && servico.permiteQuantidade) {
    return servico.duracaoMin * Math.max(1, quantidade);
  }
  return servico.duracaoMin;
}
