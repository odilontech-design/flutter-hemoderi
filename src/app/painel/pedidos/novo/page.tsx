import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { FormularioPedido } from "./FormularioPedido";

export const dynamic = "force-dynamic";

export default async function NovoPedido() {
  await exigirInterno();

  const [clinicas, servicos, profissionais] = await Promise.all([
    prisma.clinica.findMany({ where: { ativa: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, duracaoMin: true, exigeEquipamento: true },
    }),
    prisma.profissional.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  return (
    <>
      <Titulo>Novo agendamento</Titulo>
      <Cartao className="max-w-2xl">
        <FormularioPedido clinicas={clinicas} servicos={servicos} profissionais={profissionais} />
      </Cartao>
    </>
  );
}
