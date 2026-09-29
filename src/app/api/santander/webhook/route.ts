import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Webhook do Santander para confirmação de pagamento Pix.
 *
 * O Santander envia um POST quando o status da cobrança muda (pagamento
 * recebido, expirada, etc.). A URL deste webhook precisa ser cadastrada
 * no portal do desenvolvedor Santander.
 *
 * Em sandbox, o Santander não envia webhooks reais — a consulta manual
 * (botão "Atualizar status" na tela) é o caminho alternativo.
 */
export async function POST(req: NextRequest) {
  const segredo = process.env.SANTANDER_WEBHOOK_SECRET;

  if (segredo) {
    const assinatura = req.headers.get("x-webhook-secret") ?? req.headers.get("x-signature");
    if (assinatura !== segredo) {
      return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
    }
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const pix = corpo as { pix?: Array<{ txid?: string; endToEndId?: string; horario?: string; valor?: string }> };

  if (!pix.pix || !Array.isArray(pix.pix)) {
    return NextResponse.json({ ok: true });
  }

  for (const pagamento of pix.pix) {
    if (!pagamento.txid) continue;

    const cobranca = await prisma.cobrancaPix.findUnique({
      where: { txid: pagamento.txid },
      select: { id: true, faturaId: true, status: true },
    });

    if (!cobranca || cobranca.status !== "ATIVA") continue;

    await prisma.cobrancaPix.update({
      where: { id: cobranca.id },
      data: {
        status: "CONCLUIDA",
        endToEndId: pagamento.endToEndId ?? null,
        pagoEm: pagamento.horario ? new Date(pagamento.horario) : new Date(),
      },
    });

    await prisma.fatura.update({
      where: { id: cobranca.faturaId },
      data: {
        status: "PAGA",
        pagaEm: pagamento.horario ? new Date(pagamento.horario) : new Date(),
      },
    });

    await prisma.sincronizacaoExterna.create({
      data: {
        sistema: "SANTANDER",
        entidade: "CobrancaPix",
        entidadeId: cobranca.id,
        acao: "webhook-pagamento",
        sucesso: true,
        referencia: pagamento.endToEndId,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
