/**
 * Os estados de uma cobrança de cartão e como o Asaas os conta. Sem acesso a
 * banco nem rede: é a regra que o webhook, a conferência e a tela dividem.
 */

export type StatusCartao = "PENDENTE" | "PAGA" | "VENCIDA" | "CANCELADA" | "ESTORNADA" | "CONTESTADA" | "RECUSADA";

export const ROTULO_STATUS_CARTAO: Record<StatusCartao, string> = {
  PENDENTE: "Aguardando pagamento",
  PAGA: "Paga",
  VENCIDA: "Vencida",
  CANCELADA: "Cancelada",
  ESTORNADA: "Estornada",
  CONTESTADA: "Contestada (chargeback)",
  RECUSADA: "Cartão recusado",
};

/** O evento do webhook → estado. Eventos que não mexem na cobrança voltam nulos. */
export function statusDoEvento(evento: string): StatusCartao | null {
  switch (evento) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      return "PAGA";
    case "PAYMENT_OVERDUE":
      return "VENCIDA";
    case "PAYMENT_DELETED":
      return "CANCELADA";
    case "PAYMENT_REFUNDED":
      return "ESTORNADA";
    case "PAYMENT_CHARGEBACK_REQUESTED":
      return "CONTESTADA";
    case "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED":
    case "PAYMENT_REPROVED_BY_RISK_ANALYSIS":
      return "RECUSADA";
    case "PAYMENT_RESTORED":
      return "PENDENTE";
    default:
      return null;
  }
}

/** O `status` de GET /payments/{id} → estado. Desconhecido ou em trânsito = nulo (não mexe). */
export function statusDoPagamento(pagamento: { status?: string; deleted?: boolean }): StatusCartao | null {
  if (pagamento.deleted) return "CANCELADA";
  switch (pagamento.status) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "PAGA";
    case "PENDING":
      return "PENDENTE";
    case "OVERDUE":
      return "VENCIDA";
    case "REFUNDED":
      return "ESTORNADA";
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
    case "AWAITING_CHARGEBACK_REVERSAL":
      return "CONTESTADA";
    default:
      return null;
  }
}

/**
 * Pode ir de `atual` para `novo`? Paga nunca volta a vencida ou cancelada por
 * um evento atrasado; só estorno e contestação saem de paga. Reenvio do mesmo
 * estado não é transição.
 */
export function transicaoPermitida(atual: string, novo: StatusCartao): boolean {
  if (atual === novo) return false;
  switch (novo) {
    case "PAGA":
      return ["PENDENTE", "VENCIDA", "RECUSADA", "CANCELADA"].includes(atual);
    case "ESTORNADA":
      return ["PAGA", "CONTESTADA"].includes(atual);
    case "CONTESTADA":
      return atual === "PAGA";
    case "VENCIDA":
      return ["PENDENTE", "RECUSADA"].includes(atual);
    case "CANCELADA":
      return ["PENDENTE", "VENCIDA", "RECUSADA"].includes(atual);
    case "RECUSADA":
      return atual === "PENDENTE";
    case "PENDENTE":
      return atual === "CANCELADA";
  }
}

/** Esta cobrança ainda pode ser paga pelo cliente (e portanto cancelada, ou conferida)? */
export function emAberto(status: string): boolean {
  return status === "PENDENTE" || status === "VENCIDA" || status === "RECUSADA";
}

/** Compara o token do webhook sem vazar, pelo tempo, quantos caracteres bateram. */
export function tokenConfere(recebido: string | null, esperado: string): boolean {
  if (!recebido || recebido.length !== esperado.length) return false;
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) diferenca |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return diferenca === 0;
}
