import { prisma } from "@/lib/prisma";
import { despacharPendentes, enfileirarMensagem } from "@/lib/integracoes/whatsapp";
import { hojeUTC, somarDias } from "@/lib/data";
import { parametros } from "@/lib/alocacao";

// Rota de dados vivos: nunca pré-renderizada no build.
export const dynamic = "force-dynamic";

/**
 * Rotina de lembretes, chamada pelo agendador da Vercel (ver vercel.json).
 *
 * Roda uma vez por dia — não porque a lógica precise disso, mas porque o
 * plano Hobby da Vercel só permite cron diário, e um schedule mais frequente
 * faz o deploy inteiro ser recusado (não é erro de build: é o cron sendo
 * inválido para o plano). É seguro rodar só 1x/dia porque esta rotina
 * calcula o DIA-ALVO do lembrete (hoje + horasLembrete) e enfileira tudo que
 * cai nele de uma vez — não depende de checar hora a hora. O que perde
 * frequência é só o DESPACHO de mensagens já enfileiradas, e isso não
 * importa enquanto o WhatsApp (Fase 4) não estiver ligado. Ao migrar para o
 * plano Pro, `vercel.json` pode voltar para "0 * * * *".
 *
 * De qualquer forma é segura para repetir: o lembrete é gravado com
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
