/**
 * Como o cliente enxerga o pagamento de um atendimento realizado (ata de
 * 05/10): "pago" ou "pendente", com destaque para o que ainda deve.
 *
 * O dado vem da fatura (quando a clínica já foi cobrada) e do que o
 * profissional declarou ter recebido no relatório (dinheiro, Pix, cheque no
 * ato). Falta e atendimento que não aconteceu não têm pagamento a mostrar.
 */
export type SituacaoDePagamento = "pago" | "pendente";

export function situacaoDoPagamento(pedido: {
  status: string;
  fatura: { status: string } | null;
  recebidoNoAto?: boolean;
}): SituacaoDePagamento | null {
  if (pedido.status !== "REALIZADO") return null;
  if (pedido.fatura?.status === "PAGA" || pedido.recebidoNoAto) return "pago";
  return "pendente";
}
