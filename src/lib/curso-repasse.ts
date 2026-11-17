import type { Prisma } from "@prisma/client";

/**
 * Curso com vários pacientes (ligação de 17/11): cada paciente tem o seu
 * relatório — cada um é um agendamento da visita —, mas o profissional faz UM
 * trabalho e recebe UM pagamento. O repasse fica no primeiro agendamento da
 * visita; os demais ficam em zero. Fora de curso, cada um paga o seu.
 */
export async function pagaRepasseNaVisita(
  bd: Pick<Prisma.TransactionClient, "pedido">,
  pedido: { id: string; modalidade?: string | null; grupoId?: string | null }
): Promise<boolean> {
  if (pedido.modalidade !== "CURSO" || !pedido.grupoId) return true;
  const primeiro = await bd.pedido.findFirst({
    where: { grupoId: pedido.grupoId, status: { not: "CANCELADO" } },
    orderBy: { numero: "asc" },
    select: { id: true },
  });
  return !primeiro || primeiro.id === pedido.id;
}

