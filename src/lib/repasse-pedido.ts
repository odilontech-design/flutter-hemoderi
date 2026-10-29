import { prisma } from "@/lib/prisma";
import { parametros } from "@/lib/alocacao";
import { calcularRepasse } from "@/lib/repasse";
import { pracaDoAtendimento } from "@/lib/praca";

/**
 * O repasse de um atendimento, pela cadeia de regras (negociada por
 * profissional × serviço → praça → serviço → grupo/profissional → padrão).
 * Mora na lib porque a alocação, a correção de valor e a importação da tabela
 * por praça (com a aplicação retroativa) usam a mesma conta.
 */
export async function repasseDoPedido(
  profissionalId: string,
  servicoId: string,
  valorServicoCentavos: number,
  /** Onde é o atendimento: decide a praça da tabela de repasse (ata de 20/10). */
  local: { clinicaId: string; enderecoId?: string | null }
) {
  const [regra, servico, profissional, config, endereco, clinica] = await Promise.all([
    prisma.regraRepasse.findUnique({
      where: { profissionalId_servicoId: { profissionalId, servicoId } },
      select: { percent: true, fixoCentavos: true },
    }),
    prisma.servico.findUnique({
      where: { id: servicoId },
      select: { repassePercent: true, repasseFixoCentavos: true },
    }),
    prisma.profissional.findUnique({
      where: { id: profissionalId },
      select: {
        repassePercentPadrao: true,
        // Sem isto o valor fixo do profissional nunca chegava ao cálculo.
        repasseFixoCentavos: true,
        grupoRepasse: { select: { percent: true, fixoCentavos: true } },
      },
    }),
    parametros(),
    local.enderecoId
      ? prisma.enderecoClinica.findUnique({ where: { id: local.enderecoId }, select: { uf: true, cidade: true } })
      : null,
    prisma.clinica.findUnique({ where: { id: local.clinicaId }, select: { uf: true, cidade: true } }),
  ]);

  const praca = pracaDoAtendimento(endereco ?? clinica ?? {});
  const regraDaPraca = await prisma.repassePraca.findUnique({
    where: { servicoId_praca: { servicoId, praca } },
    select: { percent: true, fixoCentavos: true },
  });

  return calcularRepasse({
    valorServicoCentavos,
    regra,
    praca: regraDaPraca,
    servico,
    profissional,
    grupo: profissional?.grupoRepasse,
    percentPadrao: config.repassePercentPadrao,
  });
}
