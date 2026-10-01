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
import { formatarReais } from "@/lib/dinheiro";

export type RegraDeQuantidade = {
  permiteQuantidade: boolean;
  quantidadeMaxima: number | null;
  /** Ausente vale 1. */
  quantidadeMinima?: number;
};

/** Franquia: o preço cobre `quantidadeIncluida`; cada unidade acima soma o adicional. */
export type RegraDePreco = {
  quantidadeIncluida?: number | null;
  valorAdicionalCentavos?: number;
};

/** A menor quantidade que se vende — a tela já começa nela. */
export function quantidadeMinimaDe(regra: RegraDeQuantidade): number {
  return regra.permiteQuantidade ? Math.max(1, Math.trunc(regra.quantidadeMinima ?? 1)) : 1;
}

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
  const minima = quantidadeMinimaDe(regra);
  const n = Math.trunc(Number(pedida));
  if (!Number.isFinite(n) || n < minima) return minima;
  return regra.quantidadeMaxima ? Math.min(n, regra.quantidadeMaxima) : n;
}

/** A quantidade foi aceita como veio, ou o sistema precisou corrigir? */
export function quantidadeValida(regra: RegraDeQuantidade, pedida: unknown): boolean {
  const n = Number(pedida);
  if (!Number.isInteger(n) || n < 1) return false;
  if (!regra.permiteQuantidade) return n === 1;
  if (n < quantidadeMinimaDe(regra)) return false;
  return !regra.quantidadeMaxima || n <= regra.quantidadeMaxima;
}

/**
 * O total do item. Sem franquia, é preço × quantidade (Light Touch por dente).
 * Com franquia, o preço do serviço já cobre a quantidade incluída e só o que
 * passa dela soma — R$ 990 até 400 disparos, mais R$ 1,70 por disparo extra.
 * Abaixo da franquia não há desconto: quem pede menos paga o preço cheio.
 */
export function totalDoItem(valorCentavos: number, quantidade: number, regra: RegraDePreco = {}): number {
  if (regra.quantidadeIncluida == null) return valorCentavos * quantidade;
  const excedente = Math.max(0, quantidade - regra.quantidadeIncluida);
  return valorCentavos + (regra.valorAdicionalCentavos ?? 0) * excedente;
}

/** "R$ 990,00 até 400 disparos + R$ 1,70 por disparo adicional" — para catálogo e carrinho. */
export function descricaoDoPreco(
  valorCentavos: number,
  servico: RegraDePreco & { unidadeCobranca: UnidadeCobranca; rotuloQuantidade?: string | null }
): string {
  if (valorCentavos <= 0) return "sob consulta";
  if (servico.quantidadeIncluida == null) return `${formatarReais(valorCentavos)} ${ROTULO_UNIDADE[servico.unidadeCobranca]}`;

  const rotulo = servico.rotuloQuantidade?.trim() || "unidades";
  const adicional = servico.valorAdicionalCentavos ?? 0;
  const base = `${formatarReais(valorCentavos)} até ${servico.quantidadeIncluida} ${rotulo}`;
  if (adicional <= 0) return base;
  // "dentes" → "dente", "disparos" → "disparo", "elementos" → "elemento"
  const singular = rotulo.endsWith("s") ? rotulo.slice(0, -1) : rotulo;
  return `${base} + ${formatarReais(adicional)} por ${singular} adicional`;
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
