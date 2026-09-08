/**
 * A esteira do pedido: quais mudanças de status são possíveis e o que cada
 * uma significa.
 *
 * A máquina fica aqui, e não espalhada nas telas, porque é ela que garante o
 * que o financeiro assume mais adiante: só existe repasse depois de REALIZADO,
 * e nada é cobrado da clínica sem relatório. Uma tela que mudasse status
 * direto no banco furaria essa garantia sem aviso.
 */

import type { StatusPedido } from "@prisma/client";

export const TRANSICOES: Record<StatusPedido, StatusPedido[]> = {
  // Nasce do portal da clínica; ainda não é compromisso da operação.
  SOLICITADO: ["CONFIRMADO", "CANCELADO"],
  // Compromisso assumido, sem dono. É esta fila que a equipe trabalha.
  CONFIRMADO: ["ALOCADO", "CANCELADO"],
  // Volta para CONFIRMADO quando o profissional desiste e a vaga reabre.
  ALOCADO: ["REALIZADO", "FALTOU", "CONFIRMADO", "CANCELADO"],
  // Terminais: o que aconteceu, aconteceu. Correção de resultado é feita
  // pela equipe interna com registro em auditoria, nunca por transição.
  REALIZADO: [],
  FALTOU: [],
  CANCELADO: [],
};

export function podeTransicionar(de: StatusPedido, para: StatusPedido): boolean {
  return TRANSICOES[de].includes(para);
}

export const ROTULO_STATUS: Record<StatusPedido, string> = {
  SOLICITADO: "Solicitado",
  CONFIRMADO: "Confirmado",
  ALOCADO: "Alocado",
  REALIZADO: "Realizado",
  FALTOU: "Faltou",
  CANCELADO: "Cancelado",
};

export const COR_STATUS: Record<StatusPedido, string> = {
  SOLICITADO: "bg-amber-100 text-amber-800",
  CONFIRMADO: "bg-sky-100 text-sky-800",
  ALOCADO: "bg-indigo-100 text-indigo-800",
  REALIZADO: "bg-emerald-100 text-emerald-800",
  FALTOU: "bg-rose-100 text-rose-800",
  CANCELADO: "bg-gray-100 text-gray-500",
};

/** Status que ainda ocupam a agenda — os que a alocação precisa considerar. */
export const STATUS_ATIVOS: StatusPedido[] = ["SOLICITADO", "CONFIRMADO", "ALOCADO"];

/** Status que a equipe precisa resolver hoje. */
export const STATUS_PENDENTES: StatusPedido[] = ["SOLICITADO", "CONFIRMADO"];
