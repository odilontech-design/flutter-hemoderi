import { prisma } from "@/lib/prisma";
import { despacharPendentes, enfileirarMensagem, TIPOS_PARA_O_PROFISSIONAL } from "@/lib/integracoes/whatsapp";
import { hojeUTC, instanteDoAtendimento } from "@/lib/data";

// Rota de dados vivos: nunca pré-renderizada no build.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Minutos depois do horário combinado em que o profissional é lembrado (pedido do André, 30/10). */
const LEMBRAR_APOS_MIN = 15;
/** Depois disso o lembrete perde o sentido: o atraso já é caso da logística. */
const DESISTIR_APOS_MIN = 120;

/**
 * Lembrete de chegada: 15 minutos depois do horário, sem "Cheguei" registrado,
 * o profissional recebe um WhatsApp automático.
 *
 * Precisa rodar com frequência (a cada poucos minutos), o que o cron diário do
 * plano Hobby da Vercel não permite — quem chama é o agendador do GitHub
 * (.github/workflows/lembrete-chegada.yml). É idempotente: a mensagem é única
 * por pedido × tipo, então chamar de novo não repete o aviso.
 */
export async function GET(requisicao: Request) {
  const segredo = process.env.CRON_SECRET;
  if (segredo && requisicao.headers.get("authorization") !== `Bearer ${segredo}`) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }

  const agora = Date.now();
  const candidatos = await prisma.pedido.findMany({
    where: { data: hojeUTC(), status: "ALOCADO", checkinEm: null, profissionalId: { not: null } },
    select: { id: true, data: true, horaInicio: true },
  });
  const devidos = candidatos.filter((p) => {
    const minutos = (agora - instanteDoAtendimento(p.data, p.horaInicio).getTime()) / 60_000;
    return minutos >= LEMBRAR_APOS_MIN && minutos <= DESISTIR_APOS_MIN;
  });

  for (const pedido of devidos) await enfileirarMensagem(pedido.id, "LEMBRETE_CHEGADA");
  // O que ficou na fila (queda de rede na hora) sai agora.
  const entrega = await despacharPendentes(50, undefined, TIPOS_PARA_O_PROFISSIONAL);

  return Response.json({ avaliados: candidatos.length, lembrados: devidos.length, ...entrega });
}
