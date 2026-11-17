import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lerDispositivo } from "@/lib/dispositivo";

export const dynamic = "force-dynamic";

/**
 * O app avisa qual aparelho recebe as notificações de quem entrou. O token é
 * único: se outra pessoa entra no mesmo celular, ele passa a ser dela — quem
 * saiu para de receber.
 */
export async function POST(requisicao: Request) {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user?.id) return Response.json({ erro: "Entre para registrar o aparelho." }, { status: 401 });
  const dados = lerDispositivo(await requisicao.json().catch(() => null));
  if (!dados) return Response.json({ erro: "Dados do aparelho inválidos." }, { status: 400 });

  const usuario = await prisma.usuario.findUnique({ where: { id: sessao.user.id }, select: { desativadoEm: true } });
  if (!usuario || usuario.desativadoEm) return Response.json({ erro: "Acesso desativado." }, { status: 403 });

  await prisma.dispositivoPush.upsert({
    where: { token: dados.token },
    update: { usuarioId: sessao.user.id, plataforma: dados.plataforma, app: dados.app },
    create: { usuarioId: sessao.user.id, token: dados.token, plataforma: dados.plataforma, app: dados.app },
  });
  return Response.json({ ok: true });
}

/** Ao sair da conta, o app tira o aparelho: nada de notificação para quem não está logado. */
export async function DELETE(requisicao: Request) {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user?.id) return Response.json({ ok: true });
  const token = new URL(requisicao.url).searchParams.get("token");
  if (token) await prisma.dispositivoPush.deleteMany({ where: { token, usuarioId: sessao.user.id } });
  return Response.json({ ok: true });
}
