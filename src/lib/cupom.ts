/**
 * Cupom de desconto — regras de negócio puras.
 *
 * Decisão do André: a equipe cria cupons configuráveis (% ou R$, serviços
 * elegíveis, validade e/ou limite de usos). O cupom é aplicado na fatura
 * pelo pós-venda, DEPOIS que a fatura é fechada — o preço do serviço não
 * muda; o que muda é quanto a clínica paga naquela competência.
 *
 * A lib é pura: recebe dados, devolve resultado. O Prisma fica nas actions.
 */

import type { TipoDesconto } from "@prisma/client";

export type DadosCupom = {
  tipo: TipoDesconto;
  valor: number;
  servicoIds: string[];
  validoAte: Date | null;
  limiteUsos: number | null;
  usosRealizados: number;
  ativo: boolean;
};

export type DadosFatura = {
  valorCentavos: number;
  descontoCentavos: number;
  servicoIds: string[];
};

export type ResultadoValidacao =
  | { valido: true; descontoCentavos: number }
  | { valido: false; motivo: string };

/**
 * Valida se o cupom pode ser aplicado à fatura e calcula o desconto.
 *
 * `agora` é injetável para teste; em produção é `new Date()`.
 */
export function validarCupom(
  cupom: DadosCupom,
  fatura: DadosFatura,
  agora: Date = new Date()
): ResultadoValidacao {
  if (!cupom.ativo) {
    return { valido: false, motivo: "Este cupom está desativado." };
  }

  if (cupom.validoAte && agora > cupom.validoAte) {
    return { valido: false, motivo: "Este cupom expirou." };
  }

  if (cupom.limiteUsos !== null && cupom.usosRealizados >= cupom.limiteUsos) {
    return { valido: false, motivo: "Este cupom atingiu o limite de usos." };
  }

  // Elegibilidade por serviço: se o cupom especifica serviços, pelo menos um
  // dos serviços da fatura precisa ser elegível.
  if (cupom.servicoIds.length > 0) {
    const elegivel = fatura.servicoIds.some((id) => cupom.servicoIds.includes(id));
    if (!elegivel) {
      return { valido: false, motivo: "Nenhum serviço desta fatura é elegível para este cupom." };
    }
  }

  const liquido = fatura.valorCentavos - fatura.descontoCentavos;
  if (liquido <= 0) {
    return { valido: false, motivo: "A fatura já está zerada — não há valor a descontar." };
  }

  const descontoNominal = calcularDesconto(cupom, fatura.valorCentavos);
  // O desconto efetivo não pode ultrapassar o que falta pagar.
  const descontoCentavos = Math.min(descontoNominal, liquido);

  if (descontoCentavos <= 0) {
    return { valido: false, motivo: "O desconto calculado é zero para esta fatura." };
  }

  return { valido: true, descontoCentavos };
}

/**
 * Calcula o desconto nominal (sem teto) dado o tipo do cupom.
 */
function calcularDesconto(cupom: DadosCupom, valorBrutoCentavos: number): number {
  if (cupom.tipo === "PERCENTUAL") {
    return Math.round((valorBrutoCentavos * cupom.valor) / 100);
  }
  // VALOR_FIXO: o valor já é em centavos.
  return cupom.valor;
}

/**
 * Normaliza o código digitado: maiúscula, sem espaço.
 */
export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/\s+/g, "");
}
