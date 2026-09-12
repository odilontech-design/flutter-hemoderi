import { prisma } from "@/lib/prisma";
import { despacharPendentes, enfileirarMensagem } from "@/lib/integracoes/whatsapp";
import { hojeUTC, somarDias } from "@/lib/data";
import { parametros } from "@/lib/alocacao";

// Rota de dados vivos: nunca pré-renderizada no build.
export const dynamic = "force-dynamic";

/**
 * Rotina de lembretes, chamada pelo agendador da Vercel (ver vercel.json).
 *
 * Roda de hora em hora e é segura para repetir: o lembrete é gravado com
 * unicidade por pedido × tipo, então rodar duas vezes no mesmo dia não manda
 * a mensagem duas vezes. Idempotência aqui não é elegância — é o que separa
 * "lembramos a clínica" de "enchemos a clínica de mensagem".
 */
export async function GET(requisicao: Request) {
  const segredo = process.env.CRON_SECRET;
  if (segredo) {
    const autorizacao = requisicao.headers.get("authorization");
    if (autorizacao !== `Bearer ${segredo}`) {
      return Response.json({ erro: "não autorizado" }, { status: 401 });
    }
  }

  const config = await parametros();

  // Um dia inteiro de antecedência é o caso comum (24h). Para janelas
  // diferentes, o cálculo continua sendo "o dia do atendimento que cai dentro
  // da antecedência configurada".
  const diasDeAntecedencia = Math.max(1, Math.round(config.horasLembrete / 24));
  const alvo = somarDias(hojeUTC(), diasDeAntecedencia);

  const pedidos = await prisma.pedido.findMany({
    where: { data: alvo, status: { in: ["CONFIRMADO", "ALOCADO"] } },
    select: { id: true },
  });

  for (const pedido of pedidos) {
    await enfileirarMensagem(pedido.id, "LEMBRETE");
  }

  const entrega = await despacharPendentes();

  return Response.json({ enfileirados: pedidos.length, ...entrega });
}
