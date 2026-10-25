/**
 * Reprocessamento das pendências do PipeDrive, fora de "use server" para a
 * rotina diária poder chamar sem sessão. Quem chama de tela é
 * actions/integracoes.ts, que confere o responsável antes.
 *
 * A ação certa é decidida pelo ESTADO do pedido, não pela ação que falhou: um
 * realizado precisa acabar como ganho, um cancelado como perdido (as duas
 * criam o negócio antes, se faltar), um em aberto só precisa do negócio.
 */

import { prisma } from "@/lib/prisma";
import { pendenciasDeSincronizacao } from "@/lib/sincronizacao";
import { criarNegocio, marcarNegocioGanho, marcarNegocioPerdido, pipedriveConfigurado, testarConexao } from "./pipedrive";

export async function reprocessarPedidoPipedrive(pedidoId: string): Promise<{ ok: boolean; erro?: string }> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { id: true, status: true, pipedriveNegocioId: true, motivoCancelamento: true },
  });
  if (!pedido) return { ok: false, erro: "Agendamento não encontrado." };

  if (pedido.status === "REALIZADO") {
    await marcarNegocioGanho(pedido.id);
  } else if (pedido.status === "CANCELADO") {
    await marcarNegocioPerdido(pedido.id, pedido.motivoCancelamento);
  } else if (pedido.pipedriveNegocioId) {
    // O negócio já existe (criado por outra tentativa): criarNegocio sairia
    // calado e a pendência antiga ficaria na lista para sempre. Registra o
    // que já é fato.
    await prisma.sincronizacaoExterna.create({
      data: {
        sistema: "PIPEDRIVE",
        entidade: "Pedido",
        entidadeId: pedido.id,
        acao: "criar-negocio",
        sucesso: true,
        referencia: pedido.pipedriveNegocioId,
      },
    });
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

  if (ultima && !ultima.sucesso) {
    return { ok: false, erro: ultima.erro ?? "O PipeDrive recusou a sincronização de novo." };
  }
  return { ok: true };
}


/**
 * Até `limite` pedidos com pendência. Testa a conexão antes de qualquer
 * escrita — com domínio ou token errado, todas falhariam igual e só encheriam
 * o histórico — e para no primeiro erro, pelo mesmo motivo.
 */
export async function reprocessarPendenciasPipedrive(
  limite: number
): Promise<{ feitos: number; restam: number; erro?: string }> {
  if (!pipedriveConfigurado()) return { feitos: 0, restam: 0, erro: "Integração não configurada." };

  const tentativas = await prisma.sincronizacaoExterna.findMany({
    where: { sistema: "PIPEDRIVE", entidade: "Pedido" },
    orderBy: { criadaEm: "desc" },
    take: 500,
    select: { entidadeId: true, acao: true, sucesso: true, erro: true, criadaEm: true },
  });
  const pedidoIds = [...new Set(pendenciasDeSincronizacao(tentativas).map((p) => p.entidadeId))];
  if (pedidoIds.length === 0) return { feitos: 0, restam: 0 };

  const teste = await testarConexao();
  if (!teste.ok) return { feitos: 0, restam: pedidoIds.length, erro: teste.erro };

  const existentes = new Set(
    (await prisma.pedido.findMany({ where: { id: { in: pedidoIds } }, select: { id: true } })).map((p) => p.id)
  );
  const fila = pedidoIds.filter((id) => existentes.has(id));

  let feitos = 0;
  for (const id of fila.slice(0, limite)) {
    const r = await reprocessarPedidoPipedrive(id);
    if (!r.ok) return { feitos, restam: fila.length - feitos, erro: r.erro };
    feitos++;
  }
  return { feitos, restam: fila.length - feitos };
}
