import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

  if (!clinicaId || !servicoId || !profissionalId || !data) {
    return Response.json({ horarios: [] });
  }

  const horarios = await horariosDisponiveis({
    clinicaId,
    servicoId,
    profissionalId,
    dataISO: data,
    // A antecedência mínima vale para quem agenda sozinho; a equipe interna
    // encaixa urgência.
    exigirAntecedencia: sessao.user.papel === "CLINICA",
  });

  return Response.json({ horarios });
}
