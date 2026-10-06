import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * O comprovante de recebimento de um relatório (ata de 05/10).
 *
 * Quem pode ver: a equipe Hemoderi (qualquer perfil interno ativo) e o
 * próprio profissional autor do relatório. A clínica nunca — o comprovante
 * traz dado de conta e de cartão que é da operação. Nada de URL pública: o
 * arquivo só sai por aqui, com a sessão conferida a cada pedido.
 */
export async function GET(_requisicao: Request, { params }: { params: { relatorioId: string } }) {
  const sessao = await getServerSession(authOptions);
  const usuario = sessao?.user as { id?: string; papel?: string; profissionalId?: string } | undefined;
  if (!usuario?.id) return new Response("Não autorizado.", { status: 401 });

  const comprovante = await prisma.comprovanteRecebimento.findUnique({
    where: { relatorioId: params.relatorioId },
    include: { relatorio: { select: { profissionalId: true } } },
  });
  if (!comprovante) return new Response("Comprovante não encontrado.", { status: 404 });

  // Reconfere o vínculo no banco: acesso desativado perde o arquivo na hora,
  // não quando o token expirar.
  const conta = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: { desativadoEm: true, profissionalId: true },
  });
  if (!conta || conta.desativadoEm) return new Response("Não autorizado.", { status: 401 });

  const ehEquipe = usuario.papel === "INTERNO";
  const ehAutor =
    usuario.papel === "PROFISSIONAL" && conta.profissionalId === comprovante.relatorio.profissionalId;
  if (!ehEquipe && !ehAutor) return new Response("Não autorizado.", { status: 403 });

  return new Response(new Uint8Array(comprovante.dados), {
    headers: {
      "Content-Type": comprovante.tipo,
      "Content-Disposition": `inline; filename="${encodeURIComponent(comprovante.nome)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
