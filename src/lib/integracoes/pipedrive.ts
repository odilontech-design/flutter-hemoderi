/**
 * PipeDrive (Fase 4).
 *
 * Por decisão do cliente, o PipeDrive continua sendo a fonte central do
 * histórico comercial — este sistema não replica funil nem contatos. A única
 * escrita prevista é marcar o negócio como GANHO quando o atendimento é
 * realizado, fechando o ciclo que hoje é feito à mão.
 *
 * Escrever menos aqui é a decisão, não uma etapa faltando: duas fontes
 * editáveis do mesmo dado comercial divergem em semanas.
 */

import { prisma } from "@/lib/prisma";

function configurado(): boolean {
  return Boolean(process.env.PIPEDRIVE_API_TOKEN && process.env.PIPEDRIVE_DOMINIO);
}

export async function marcarNegocioGanho(pedidoId: string): Promise<void> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { id: true, pipedriveNegocioId: true },
  });
  if (!pedido?.pipedriveNegocioId) return;

  if (!configurado()) {
    await prisma.sincronizacaoExterna.create({
      data: {
        sistema: "PIPEDRIVE",
        entidade: "Pedido",
        entidadeId: pedido.id,
        acao: "marcar-ganho",
        sucesso: false,
        referencia: pedido.pipedriveNegocioId,
        erro: "Integração não configurada (Fase 4).",
      },
    });
    return;
  }

  const dominio = process.env.PIPEDRIVE_DOMINIO;
  const token = process.env.PIPEDRIVE_API_TOKEN;
  const url = `https://${dominio}.pipedrive.com/api/v1/deals/${pedido.pipedriveNegocioId}?api_token=${token}`;

  try {
    const resposta = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "won" }),
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    await prisma.sincronizacaoExterna.create({
      data: {
        sistema: "PIPEDRIVE",
        entidade: "Pedido",
        entidadeId: pedido.id,
        acao: "marcar-ganho",
        sucesso: true,
        referencia: pedido.pipedriveNegocioId,
      },
    });
  } catch (erro) {
    await prisma.sincronizacaoExterna.create({
      data: {
        sistema: "PIPEDRIVE",
        entidade: "Pedido",
        entidadeId: pedido.id,
        acao: "marcar-ganho",
        sucesso: false,
        referencia: pedido.pipedriveNegocioId,
        erro: erro instanceof Error ? erro.message : String(erro),
      },
    });
  }
}
