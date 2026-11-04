import { tokenConfere } from "@/lib/asaas-status";
import { aplicarEventoAsaas } from "@/lib/integracoes/asaas";

export const dynamic = "force-dynamic";

/**
 * Aviso do Asaas (ata de 03/11): pagamento, vencimento, estorno, contestação,
 * cartão recusado, cancelamento. Só aceita com o token configurado no painel
 * do Asaas (ASAAS_WEBHOOK_TOKEN), no cabeçalho asaas-access-token.
 *
 * Com o token certo responde 200 sempre — o Asaas pausa a fila do webhook
 * depois de várias respostas de erro, e parar de receber é pior que um evento
 * com falha. O que falhar fica registrado em EventoAsaas (tela de integrações)
 * e a conferência periódica com o Asaas acerta o resto.
 */
export async function POST(requisicao: Request) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!esperado || !tokenConfere(requisicao.headers.get("asaas-access-token"), esperado)) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }
  const corpo = (await requisicao.json().catch(() => null)) as Parameters<typeof aplicarEventoAsaas>[0] | null;
  if (corpo) {
    try {
      await aplicarEventoAsaas(corpo);
    } catch (erro) {
      console.error("asaas: webhook", erro);
    }
  }
  return Response.json({ recebido: true });
}
