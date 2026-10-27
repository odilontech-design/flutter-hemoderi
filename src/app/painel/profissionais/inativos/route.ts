import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { situacaoDoAcesso } from "@/lib/profissionais-acesso";

export const dynamic = "force-dynamic";

/**
 * Planilha dos profissionais que ainda não ativaram o acesso (ata de 27/10):
 * a equipe manda no grupo para cobrar quem falta. Abre no Excel — CSV com
 * separador ";" e BOM, que é o que o Excel em português lê sem reclamar.
 * Sem CPF nem dados de pagamento: o que vai para um grupo de mensagens é só o
 * necessário para a cobrança.
 */
export async function GET() {
  const sessao = await getServerSession(authOptions);
  if (sessao?.user?.papel !== "INTERNO") return new Response("Não autorizado", { status: 401 });

  const profissionais = await prisma.profissional.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: {
      nome: true,
      telefone: true,
      email: true,
      _count: { select: { servicosAptos: true } },
      usuarios: { select: { desativadoEm: true, senhaProvisoria: true } },
    },
  });

  const limpo = (texto: string | null | undefined) => (texto ?? "").replace(/[;\r\n]+/g, " ").trim();
  const linhas = [["Nome", "Telefone", "E-mail", "Situação do acesso", "Serviços habilitados"]];
  for (const p of profissionais) {
    const situacao = situacaoDoAcesso(p.usuarios);
    if (situacao === "ativo") continue;
    linhas.push([limpo(p.nome), limpo(p.telefone), limpo(p.email), TEXTO[situacao], String(p._count.servicosAptos)]);
  }

  const dia = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + linhas.map((l) => l.join(";")).join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="profissionais-inativos-${dia}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

const TEXTO = {
  "sem-acesso": "Sem acesso criado",
  "nunca-entrou": "Acesso criado, ainda não entrou",
  desativado: "Acesso desativado",
} as const;
