import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { parametros } from "@/lib/alocacao";
import { agruparPorFamilia } from "@/lib/familia";
import { Titulo } from "@/components/ui";
import { FormularioAgendamento } from "./FormularioAgendamento";

export const dynamic = "force-dynamic";

export default async function Agendar() {
  const sessao = await exigirClinica();

  const [servicos, config] = await Promise.all([
    prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, duracaoMin: true, familia: true },
    }),
    parametros(),
  ]);

  const grupos = agruparPorFamilia(servicos);

  return (
    <>
      <Titulo>Agendar atendimento</Titulo>
      <FormularioAgendamento
        grupos={grupos}
        antecedenciaHoras={config.antecedenciaMinimaHoras}
        clinicaNome={sessao.clinicaNome}
        whatsappCentral={config.whatsapp}
      />
    </>
  );
}
