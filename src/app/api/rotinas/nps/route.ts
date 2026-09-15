import { gerarPesquisasNps } from "@/lib/rotinas/nps";

// Rota de dados vivos: nunca pré-renderizada no build.
export const dynamic = "force-dynamic";

/**
 * A lógica mora em lib/rotinas/nps.ts — chamada tanto por esta rota quanto
 * pela rotina de mensagens, que já tem o único cron diário que o Hobby da
 * Vercel permite. Esta rota existe independente para virar seu próprio cron
 * assim que a operação migrar de plano, e para permitir rodar a geração na
 * mão (mesmo `Authorization: Bearer CRON_SECRET`) sem esperar a mensageria.
 */
export async function GET(requisicao: Request) {
  const segredo = process.env.CRON_SECRET;
  if (segredo) {
    const autorizacao = requisicao.headers.get("authorization");
    if (autorizacao !== `Bearer ${segredo}`) {
      return Response.json({ erro: "não autorizado" }, { status: 401 });
    }
  }

  const resultado = await gerarPesquisasNps();
  return Response.json(resultado);
}
