import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { parametros } from "@/lib/alocacao";
import { Cartao, Titulo } from "@/components/ui";
import { FormularioAgendamento } from "./FormularioAgendamento";

export const dynamic = "force-dynamic";

export default async function Agendar() {
  await exigirClinica();

  const [servicos, profissionais, config] = await Promise.all([
    prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, duracaoMin: true },
    }),
    prisma.profissional.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, especialidade: true },
    }),
    parametros(),
  ]);

  return (
    <>
      <Titulo>Agendar atendimento</Titulo>
      <Cartao className="max-w-2xl">
        <FormularioAgendamento
          servicos={servicos}
          profissionais={profissionais}
          antecedenciaHoras={config.antecedenciaMinimaHoras}
        />
      </Cartao>
    </>
  );
}
