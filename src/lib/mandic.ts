import type { PrismaClient } from "@prisma/client";

/**
 * Ata de 29/10: PG e Orçamento aparecem para TODOS os profissionais, num
 * primeiro momento; a restrição à Mandic fica pronta para ser religada (basta
 * `true`).
 */
export const PG_E_ORCAMENTO_SO_MANDIC = false;


/**
 * Atendimento Mandic (pedido do André, 28/10): "PG e Orçamento são números
 * exclusivos de atendimentos à Mandic — deveria aparecer para preenchimento
 * somente quando a tabela e o cliente forem Mandic". É Mandic quando a clínica
 * tem o perfil Mandic ou uma tabela de preços de perfil Mandic liberada.
 */
export async function atendimentoMandic(
  prisma: Pick<PrismaClient, "clinica" | "tabelaPreco">,
  clinicaId: string
): Promise<boolean> {
  const clinica = await prisma.clinica.findUnique({ where: { id: clinicaId }, select: { perfis: true } });
  if (clinica?.perfis.includes("MANDIC")) return true;
  const tabelas = await prisma.tabelaPreco.count({
    where: { ativa: true, perfil: "MANDIC", clinicas: { some: { id: clinicaId } } },
  });
  return tabelas > 0;
}

/** O relatório pede (e mostra) os números de orçamento e PG neste atendimento? */
export async function pedeOrcamentoEPg(
  prisma: Pick<PrismaClient, "clinica" | "tabelaPreco">,
  clinicaId: string
): Promise<boolean> {
  return PG_E_ORCAMENTO_SO_MANDIC ? atendimentoMandic(prisma, clinicaId) : true;
}
