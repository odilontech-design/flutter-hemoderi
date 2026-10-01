import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { agruparPorFamilia } from "@/lib/familia";
import { FormularioPedido } from "./FormularioPedido";

export const dynamic = "force-dynamic";

export default async function NovoPedido() {
  await exigirInterno();

  const [clinicas, servicos, profissionais] = await Promise.all([
    prisma.clinica.findMany({ where: { ativa: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, familia: true, duracaoMin: true, exigeEquipamento: true },
    }),
    prisma.profissional.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  // Mesmas categorias do catálogo e do relatório, na ordem do catálogo — a
  // lista corrida de 38 serviços obrigava a procurar pelo nome.
  const grupos = agruparPorFamilia(servicos, { fundirSolitarias: false, ordemDoCatalogo: true });

  return (
    <>
      <Titulo>Novo agendamento</Titulo>
      <Cartao className="max-w-2xl">
        <FormularioPedido clinicas={clinicas} grupos={grupos} profissionais={profissionais} />
      </Cartao>
    </>
  );
}
