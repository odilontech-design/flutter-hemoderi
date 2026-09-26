import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { familiaDoNome } from "@/lib/familia";
import { NovoServicoForm } from "./NovoServicoForm";

export const dynamic = "force-dynamic";

export default async function NovoServico() {
  await exigirInterno();

  const [servicos, equipamentos] = await Promise.all([
    prisma.servico.findMany({ select: { nome: true, familia: true } }),
    prisma.equipamento.findMany({ select: { tipo: true } }),
  ]);

  const tiposDeEquipamento = Array.from(new Set(equipamentos.map((e) => e.tipo).filter(Boolean))) as string[];
  const familias = Array.from(
    new Set(servicos.map((s) => s.familia?.trim()).filter(Boolean).concat(servicos.map((s) => familiaDoNome(s.nome))))
  ).sort((a, b) => String(a).localeCompare(String(b), "pt-BR")) as string[];

  return (
    <>
      <Titulo
        acao={
          <Link href="/painel/catalogo" className="text-[11px] font-semibold text-bordo hover:underline">
            ← voltar para o catálogo
          </Link>
        }
      >
        Novo serviço
      </Titulo>
      <Cartao className="max-w-2xl">
        <NovoServicoForm familias={familias} tiposDeEquipamento={tiposDeEquipamento} />
      </Cartao>
    </>
  );
}
