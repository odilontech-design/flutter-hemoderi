import type { PrismaClient } from "@prisma/client";
import { tabelasDaClinica } from "@/lib/preco";

/**
 * O catálogo de curso (ata de 27/10): só os serviços precificados nas tabelas
 * de curso liberadas para a clínica, com o preço delas. Nulo quando a clínica
 * não tem tabela de curso — e aí a opção "Curso" nem aparece no agendamento.
 */
export async function precosDeCurso(
  prisma: Pick<PrismaClient, "tabelaPreco" | "clinica" | "precoTabela">,
  clinicaId: string,
  ufs: string[]
): Promise<{ precos: Map<string, number>; precosPorUf: Record<string, Record<string, number>> } | null> {
  const tabelaIds = await tabelasDaClinica(prisma, clinicaId, "CURSO");
  if (tabelaIds.length === 0) return null;
  const itens = await prisma.precoTabela.findMany({
    where: { tabelaId: { in: tabelaIds } },
    select: { servicoId: true, valorCentavos: true },
  });
  const precos = new Map<string, number>();
  for (const item of itens) {
    const atual = precos.get(item.servicoId);
    precos.set(item.servicoId, atual === undefined ? item.valorCentavos : Math.min(atual, item.valorCentavos));
  }
  if (precos.size === 0) return null;
  // A tabela de curso não varia por praça: o mesmo preço em toda UF.
  const mapa = Object.fromEntries(precos);
  return { precos, precosPorUf: Object.fromEntries(ufs.map((uf) => [uf, mapa])) };
}
