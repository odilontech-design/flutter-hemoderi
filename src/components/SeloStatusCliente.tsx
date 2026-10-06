import type { StatusPedido } from "@prisma/client";
import { COR_STATUS, ROTULO_STATUS_CLIENTE, statusParaCliente } from "@/lib/pedido";

/**
 * O status como o CLIENTE lê (ata de 02/10): solicitado, confirmado ou
 * cancelado. "Alocado" é detalhe interno e aparece como confirmado.
 */
export function SeloStatusCliente({ status }: { status: StatusPedido }) {
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${COR_STATUS[statusParaCliente(status)]}`}
    >
      {ROTULO_STATUS_CLIENTE[status]}
    </span>
  );
}
