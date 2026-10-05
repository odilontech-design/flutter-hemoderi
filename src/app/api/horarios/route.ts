import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { horariosDisponiveis, horariosDisponiveisConjunto } from "@/lib/alocacao";

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

  // Vários serviços na mesma visita: "id:qtd,id:qtd", na ordem em que
  // acontecem. A resposta é a do bloco inteiro.
  const itensTexto = url.searchParams.get("itens");
  if (clinicaId && itensTexto && data) {
    const itens = itensTexto
      .split(",")
      .map((par) => {
        const [id, qtd] = par.split(":");
        return { servicoId: id ?? "", quantidade: Math.max(1, Math.trunc(Number(qtd)) || 1) };
      })
      .filter((item) => item.servicoId)
      .slice(0, 12);

    // `hora` confere UM horário digitado à mão; sem ele, devolve a grade.
    const hora = url.searchParams.get("hora");
    const resultado = await horariosDisponiveisConjunto({
      clinicaId,
      itens,
      dataISO: data,
      exigirAntecedencia: sessao.user.papel === "CLINICA",
      ...(hora ? { horas: [hora] } : {}),
    });
    return Response.json(resultado);
  }

  if (!clinicaId || !servicoId || !data) {
    return Response.json({ horarios: [] });
  }

  // No reagendamento, o pedido não pode conflitar consigo mesmo. Só sai da
  // conta um pedido que pertence a quem está perguntando.
  const pedidoParaIgnorar = url.searchParams.get("ignorarPedidoId");
  const pedidoAtual = pedidoParaIgnorar
    ? await prisma.pedido.findFirst({
        where: { id: pedidoParaIgnorar, clinicaId },
        select: { id: true, duracaoMin: true },
      })
    : null;
  const ignorarPedidoId = pedidoAtual?.id;
  // `hora` confere UM horário digitado à mão; sem ele, devolve a grade.
  const horaDigitada = url.searchParams.get("hora");

  const horarios = await horariosDisponiveis({
    clinicaId,
    servicoId,
    profissionalId: profissionalId || null,
    dataISO: data,
    ignorarPedidoId,
    // A antecedência mínima vale para quem agenda sozinho; a equipe interna
    // encaixa urgência.
    exigirAntecedencia: sessao.user.papel === "CLINICA",
    // No reagendamento o bloco tem a duração do PEDIDO, que pode diferir da do
    // serviço (por hora, com quantidade).
    ...(pedidoAtual ? { duracaoMin: pedidoAtual.duracaoMin } : {}),
    ...(horaDigitada ? { horas: [horaDigitada] } : {}),
  });

  return Response.json({ horarios });
}
