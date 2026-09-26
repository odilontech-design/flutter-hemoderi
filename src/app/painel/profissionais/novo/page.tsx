import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { NovoProfissionalForm } from "./NovoProfissionalForm";

export const dynamic = "force-dynamic";

export default async function NovoProfissional() {
  await exigirInterno();

  const gruposRepasse = await prisma.grupoRepasse.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return (
    <>
      <Titulo
        acao={
          <Link href="/painel/profissionais" className="text-[11px] font-semibold text-bordo hover:underline">
            ← voltar para profissionais
          </Link>
        }
      >
        Novo profissional
      </Titulo>
      <Cartao className="max-w-2xl">
        <NovoProfissionalForm gruposRepasse={gruposRepasse} />
      </Cartao>
    </>
  );
}
