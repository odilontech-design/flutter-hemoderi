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
 * "por paciente", "por período", "por hora" — ou, quando o serviço é vendido
 * por quantidade sem franquia (disparos do Atria, dentes do Light Touch), "por
 * disparo", "por dente": o preço unitário que a clínica lê (ata de 29/10).
 */
export function unidadeDoPreco(servico: {
  unidadeCobranca: UnidadeCobranca;
  permiteQuantidade?: boolean;
  quantidadeIncluida?: number | null;
  rotuloQuantidade?: string | null;
}): string {
  const rotulo = servico.rotuloQuantidade?.trim();
  if (servico.permiteQuantidade && servico.quantidadeIncluida == null && rotulo && servico.unidadeCobranca !== "HORA") {
    return `por ${rotulo.toLowerCase().endsWith("s") ? rotulo.toLowerCase().slice(0, -1) : rotulo.toLowerCase()}`;
  }
  return ROTULO_UNIDADE[servico.unidadeCobranca];
}

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
  servico: RegraDePreco & { unidadeCobranca: UnidadeCobranca; rotuloQuantidade?: string | null; permiteQuantidade?: boolean; quantidadeMinima?: number | null }
): string {
  if (valorCentavos <= 0) return "sob consulta";
  if (servico.quantidadeIncluida == null) {
    const minimo = servico.permiteQuantidade && (servico.quantidadeMinima ?? 1) > 1 ? ` (mínimo ${servico.quantidadeMinima!.toLocaleString("pt-BR")})` : "";
    return `${formatarReais(valorCentavos)} ${unidadeDoPreco(servico)}${minimo}`;
  }

  const rotulo = servico.rotuloQuantidade?.trim() || "unidades";
  const adicional = servico.valorAdicionalCentavos ?? 0;
  const base = `${formatarReais(valorCentavos)} até ${servico.quantidadeIncluida.toLocaleString("pt-BR")} ${rotulo}`;
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

/**
 * O valor por paciente ou por disparo de um pacote (ata de 03/11: mostrar o
 * preço "por paciente / por disparo" em vez de só o total). "AirFlow (pacote
 * 4 pacientes)" a R$ 1.540 → R$ 385 por paciente; sessão de 500 disparos →
 * valor por disparo. Null quando o serviço já é cobrado por unidade.
 */
export function valorPorUnidadeDoPacote(servico: {
  nome: string;
  valorCentavos: number;
  quantidadeIncluida?: number | null;
}): { valorCentavos: number; unidade: string } | null {
  if (servico.valorCentavos <= 0) return null;
  const pacientes = /(\d+)\s*pacientes\b/i.exec(servico.nome);
  if (pacientes && Number(pacientes[1]) > 1) {
    return { valorCentavos: Math.round(servico.valorCentavos / Number(pacientes[1])), unidade: "por paciente" };
  }
  const disparos = /([\d.]+)\s*disparos\b/i.exec(servico.nome);
  const quantos = disparos ? Number(disparos[1].replace(/\./g, "")) : servico.quantidadeIncluida ?? 0;
  if (disparos && quantos > 1) {
    return { valorCentavos: Math.round(servico.valorCentavos / quantos), unidade: "por disparo" };
  }
  return null;
}

/**
 * As opções de uma família em texto curto (ata de 03/11: "textos descritivos
 * dos tipos de pacotes"): "AirFlow – GBT Machine (pacote 2 pacientes)" vira
 * "pacote 2 pacientes"; "LiteTouch – Frenectomia" vira "Frenectomia".
 */
export function opcaoCurta(nome: string): string {
  const parenteses = /\(([^)]+)\)\s*$/.exec(nome);
  if (parenteses) return parenteses[1].trim();
  const partes = nome.split(" – ");
  return (partes.length > 1 ? partes.slice(1).join(" – ") : nome).trim();
}
