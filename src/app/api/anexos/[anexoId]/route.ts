import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Um anexo de relatório (reunião de 28/10). Mesma regra do comprovante: a
 * equipe Hemoderi e o próprio profissional autor; a clínica nunca. Nada de URL
 * pública — o arquivo só sai por aqui, com a sessão reconferida a cada pedido.
 */
export async function GET(_requisicao: Request, { params }: { params: { anexoId: string } }) {
  const sessao = await getServerSession(authOptions);
  const usuario = sessao?.user as { id?: string; papel?: string } | undefined;
  if (!usuario?.id) return new Response("Não autorizado.", { status: 401 });

  const anexo = await prisma.relatorioAnexo.findUnique({
    where: { id: params.anexoId },
    include: { relatorio: { select: { profissionalId: true } } },
  });
  if (!anexo) return new Response("Anexo não encontrado.", { status: 404 });

  const conta = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: { desativadoEm: true, papel: true, profissionalId: true },
  });
  if (!conta || conta.desativadoEm) return new Response("Não autorizado.", { status: 401 });

  const ehEquipe = conta.papel === "INTERNO";
  const ehAutor = conta.profissionalId != null && conta.profissionalId === anexo.relatorio.profissionalId;
  if (!ehEquipe && !ehAutor) return new Response("Não autorizado.", { status: 403 });

  return new Response(new Uint8Array(anexo.dados), {
    headers: {
      "Content-Type": anexo.tipo,
      "Content-Disposition": `inline; filename="${encodeURIComponent(anexo.nome)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
