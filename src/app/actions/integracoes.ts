"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirResponsavel } from "@/lib/sessao";
import { criarNegocio, marcarNegocioGanho } from "@/lib/integracoes/pipedrive";
import type { Resultado } from "./pedidos";

/**
 * Reprocessa uma sincronização do PipeDrive que ficou pendente (ata de
 * 28/09).
 *
 * Restrito ao responsável: reprocessar dispara escrita num sistema externo, e
 * quem responde pela operação é quem decide refazer. A ação certa é decidida
 * pelo ESTADO do pedido, não pela ação que falhou: um pedido já realizado
 * precisa acabar como "ganho" (e marcarNegocioGanho cria o negócio antes, se
 * faltar), enquanto um ainda em aberto só precisa do negócio criado. Assim o
 * reprocessamento conserta a lacuna inteira de uma vez, não só a etapa que
 * registrou o erro.
 */
export async function reprocessarPipedrive(pedidoId: string): Promise<Resultado> {
  await exigirResponsavel();

  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { id: true, status: true },
  });
  if (!pedido) return { ok: false, erro: "Agendamento não encontrado." };

  if (pedido.status === "REALIZADO") {
    await marcarNegocioGanho(pedido.id);
  } else {
    await criarNegocio(pedido.id);
  }

  // Confere se a última tentativa passou a ser sucesso — o reprocessamento
  // grava uma nova linha em SincronizacaoExterna, e é ela que diz se resolveu.
  const ultima = await prisma.sincronizacaoExterna.findFirst({
    where: { sistema: "PIPEDRIVE", entidade: "Pedido", entidadeId: pedido.id },
    orderBy: { criadaEm: "desc" },
    select: { sucesso: true, erro: true },
  });

  revalidatePath("/painel/integracoes");
  if (ultima && !ultima.sucesso) {
    return { ok: false, erro: ultima.erro ?? "O PipeDrive recusou a sincronização de novo." };
  }
  return { ok: true };
}
