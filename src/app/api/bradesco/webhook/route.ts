import { NextRequest, NextResponse } from "next/server";
import { consultarCobranca } from "@/lib/integracoes/bradesco-pix";

// Rota de dados vivos: nunca pré-renderizada no build.
export const dynamic = "force-dynamic";

/**
 * Aviso de pagamento Pix do Bradesco.
 *
 * O banco faz um POST com `{ pix: [{ txid, endToEndId, valor, horario }] }`
 * quando um Pix cai. O endereço é cadastrado pelo botão "Registrar aviso de
 * pagamento" da tela Integrações, com o segredo na própria URL — o Bradesco
 * não assina o aviso.
 *
 * O corpo NÃO é tomado como verdade: cada txid avisado é CONSULTADO no banco,
 * e só a consulta baixa a cobrança e a fatura. Um POST forjado, mesmo com o
 * segredo vazado, no máximo manda o sistema conferir uma cobrança.
 */
export async function POST(req: NextRequest) {
  const segredo = process.env.BRADESCO_WEBHOOK_SEGREDO?.trim();
  if (!segredo || req.nextUrl.searchParams.get("segredo") !== segredo) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  let corpo: { pix?: Array<{ txid?: string }> };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const txids = [...new Set((corpo.pix ?? []).map((p) => p.txid).filter((t): t is string => Boolean(t)))].slice(0, 50);
  for (const txid of txids) await consultarCobranca(txid);

  return NextResponse.json({ ok: true, conferidos: txids.length });
}
