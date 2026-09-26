import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirResponsavel } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { NovoAcesso, type Vinculo } from "../NovoAcesso";

export const dynamic = "force-dynamic";

export default async function NovoAcessoPagina() {
  await exigirResponsavel();

  const [clinicas, profissionais] = await Promise.all([
    prisma.clinica.findMany({
      where: { ativa: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, email: true, usuarios: { select: { id: true }, take: 1 } },
    }),
    prisma.profissional.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, email: true, usuarios: { select: { id: true }, take: 1 } },
    }),
  ]);

  const paraVinculo = (c: { id: string; nome: string; email: string | null; usuarios: { id: string }[] }): Vinculo => ({
    id: c.id,
    nome: c.nome,
    email: c.email,
    temAcesso: c.usuarios.length > 0,
  });

  return (
    <>
      <Titulo
        acao={
          <Link href="/painel/acessos" className="text-[11px] font-semibold text-bordo hover:underline">
            ← voltar para acessos
          </Link>
        }
      >
        Novo acesso
      </Titulo>
      <Cartao className="max-w-2xl">
        <NovoAcesso clinicas={clinicas.map(paraVinculo)} profissionais={profissionais.map(paraVinculo)} />
      </Cartao>
    </>
  );
}
