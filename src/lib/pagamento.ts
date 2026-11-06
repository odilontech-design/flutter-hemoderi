/**
 * Condições de pagamento que a operação usa.
 *
 * Mora aqui, e NÃO em actions/pedidos.ts, por um motivo que só aparece em
 * produção: num arquivo "use server" todo export vira uma referência de
 * server action. Uma constante exportada de lá chega ao navegador como
 * função, não como array — e a tela quebra com "map is not a function",
 * depois de compilar e passar no typecheck sem uma palavra.
 *
 * Lista fechada de propósito: o campo é lido no fechamento do mês, e texto
 * livre viraria "faturado", "Faturado", "mensal" e "fiado" significando a
 * mesma coisa.
 */
export const CONDICOES_PAGAMENTO = [
  "Antecipado",
  "No ato do atendimento",
  "Faturado no mês",
  "Cortesia",
] as const;

export type CondicaoPagamento = (typeof CONDICOES_PAGAMENTO)[number];

export function condicaoValida(valor: string): valor is CondicaoPagamento {
  return (CONDICOES_PAGAMENTO as readonly string[]).includes(valor);
}

/**
 * Como o CLIENTE paga o atendimento — o que ele escolhe ao agendar (ata de
 * 02/10). Pix, cartão de crédito (Asaas), dinheiro e cheque.
 *
 * Não confundir com `CONDICOES_PAGAMENTO`, o acordo interno da operação com a
 * clínica (antecipado, faturado…), que o cliente não vê.
 */
export const FORMAS_DE_PAGAMENTO = ["Pix", "Cartão de crédito", "Dinheiro", "Cheque"] as const;

/** A escolha que leva ao pagamento com cartão pelo Asaas (à vista ou parcelado). */
export const FORMA_CARTAO = "Cartão de crédito";

export type FormaDePagamento = (typeof FORMAS_DE_PAGAMENTO)[number];

export function formaDePagamentoValida(valor: string): valor is FormaDePagamento {
  return (FORMAS_DE_PAGAMENTO as readonly string[]).includes(valor);
}
