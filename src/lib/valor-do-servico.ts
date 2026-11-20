import { prisma } from "@/lib/prisma";
import { precoDoServico, tabelasDaClinica } from "@/lib/preco";

/**
 * Preço unitário do serviço para a clínica — negociado, tabela do perfil, praça
 * ou tabela padrão (lib/preco.ts). `uf` é a do ENDEREÇO do atendimento quando
 * a clínica atende em mais de um lugar; sem ela vale a do cadastro.
 */
export async function valorDoServico(
  clinicaId: string,
  servicoId: string,
  uf?: string | null,
  modalidade: "PARTICULAR" | "CURSO" = "PARTICULAR"
): Promise<number> {
  const [clinica, servico, tabelaIds] = await Promise.all([
    prisma.clinica.findUnique({ where: { id: clinicaId }, select: { uf: true } }),
    prisma.servico.findUnique({ where: { id: servicoId }, select: { valorPadraoCentavos: true } }),
    tabelasDaClinica(prisma, clinicaId, modalidade),
  ]);
  const { valorCentavos } = await precoDoServico(prisma, {
    // Curso tem tabela própria: o preço negociado do particular não vale nele.
    clinicaId: modalidade === "CURSO" ? null : clinicaId,
    servicoId,
    uf: uf ?? clinica?.uf,
    valorPadraoCentavos: servico?.valorPadraoCentavos ?? 0,
    tabelaIds,
  });
  return valorCentavos;
}
