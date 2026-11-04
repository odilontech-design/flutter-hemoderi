import { asaasConfigurado, conferirEmAberto } from "@/lib/integracoes/asaas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Conferência periódica com o Asaas: pergunta como estão as cobranças de
 * cartão em aberto e acerta o que o webhook não trouxe. Chamada de hora em
 * hora pelo agendador do GitHub (.github/workflows/conferir-asaas.yml), com o
 * mesmo CRON_SECRET das outras rotinas. Idempotente.
 */
export async function GET(requisicao: Request) {
  const segredo = process.env.CRON_SECRET;
  if (segredo && requisicao.headers.get("authorization") !== `Bearer ${segredo}`) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }
  if (!asaasConfigurado()) return Response.json({ ok: true, ignorado: "Asaas não configurado" });
  return Response.json({ ok: true, ...(await conferirEmAberto(30)) });
}
