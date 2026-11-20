import { tokenConfere } from "@/lib/asaas-status";
import { processarAvisoDoPipedrive, USUARIO_DO_WEBHOOK } from "@/lib/integracoes/pipedrive-volta";

export const dynamic = "force-dynamic";

/**
 * Aviso do PipeDrive de negócio alterado (caminho de volta, 20/11). Só aceita
 * com o usuário e a senha cadastrados no aviso (PIPEDRIVE_WEBHOOK_SENHA), em
 * HTTP Basic. Autenticado, responde 200 sempre: o PipeDrive desativa o aviso
 * depois de muitas falhas, e o que der errado fica como pendência na tela de
 * integrações.
 */
export async function POST(requisicao: Request) {
  const senha = process.env.PIPEDRIVE_WEBHOOK_SENHA?.trim();
  const esperado = senha ? `Basic ${Buffer.from(`${USUARIO_DO_WEBHOOK}:${senha}`).toString("base64")}` : "";
  if (!senha || !tokenConfere(requisicao.headers.get("authorization"), esperado)) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }
  const corpo = await requisicao.json().catch(() => null);
  let resultado = "sem corpo";
  if (corpo) {
    try {
      resultado = await processarAvisoDoPipedrive(corpo);
    } catch (erro) {
      console.error("pipedrive: webhook", erro);
      resultado = "falhou";
    }
  }
  return Response.json({ recebido: true, resultado });
}
