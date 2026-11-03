import { EVENTOS_DE_PAGAMENTO, confirmarPagamentoCartao } from "@/lib/integracoes/asaas";

export const dynamic = "force-dynamic";

/**
 * Aviso de pagamento do Asaas (ata de 03/11). Só aceita com o token
 * configurado no painel do Asaas (ASAAS_WEBHOOK_TOKEN), que chega no
 * cabeçalho asaas-access-token. Responde 200 sempre que o token confere, para
 * o Asaas não reenviar o mesmo evento sem parar.
 */
export async function POST(requisicao: Request) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!esperado || requisicao.headers.get("asaas-access-token") !== esperado) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }
  const corpo = (await requisicao.json().catch(() => null)) as { event?: string; payment?: { id?: string; installment?: string | null } } | null;
  if (corpo?.event && EVENTOS_DE_PAGAMENTO.includes(corpo.event) && corpo.payment) {
    await confirmarPagamentoCartao(corpo.payment);
  }
  return Response.json({ recebido: true });
}
