import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { horariosDisponiveis } from "@/lib/alocacao";

// Rota de dados vivos: nunca pré-renderizada no build.
export const dynamic = "force-dynamic";

/**
 * Horários livres para o formulário de agendamento.
 *
 * A clínica NUNCA informa qual é: o escopo vem da sessão. Aceitar clinicaId
 * do cliente aqui deixaria qualquer clínica sondar a ocupação das outras.
 */
export async function GET(requisicao: Request) {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user) return Response.json({ horarios: [] }, { status: 401 });

  const url = new URL(requisicao.url);
  const servicoId = url.searchParams.get("servicoId") ?? "";
  const profissionalId = url.searchParams.get("profissionalId") ?? "";
  const data = url.searchParams.get("data") ?? "";

  const clinicaId =
    sessao.user.papel === "CLINICA"
      ? sessao.user.clinicaId
      : sessao.user.papel === "INTERNO"
        ? url.searchParams.get("clinicaId")
        : null;

  if (!clinicaId || !servicoId || !data) {
    return Response.json({ horarios: [] });
  }

  // No reagendamento, o pedido não pode conflitar consigo mesmo. Só sai da
  // conta um pedido que pertence a quem está perguntando.
  const pedidoParaIgnorar = url.searchParams.get("ignorarPedidoId");
  const ignorarPedidoId = pedidoParaIgnorar
    ? (
        await prisma.pedido.findFirst({
          where: { id: pedidoParaIgnorar, clinicaId },
          select: { id: true },
        })
      )?.id
    : undefined;

  const horarios = await horariosDisponiveis({
    clinicaId,
    servicoId,
    profissionalId: profissionalId || null,
    dataISO: data,
    ignorarPedidoId,
    // A antecedência mínima vale para quem agenda sozinho; a equipe interna
    // encaixa urgência.
    exigirAntecedencia: sessao.user.papel === "CLINICA",
  });

  return Response.json({ horarios });
}
