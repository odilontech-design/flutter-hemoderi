/**
 * Reprocessamento das pendências do PipeDrive, fora de "use server" para a
 * rotina diária poder chamar sem sessão. Quem chama de tela é
 * actions/integracoes.ts, que confere o responsável antes.
 *
 * A ação certa é decidida pelo ESTADO do pedido, não pela ação que falhou:
 * relatório aprovado vira negócio GANHO (ata de 03/11), cancelado com negócio
 * vira PERDIDO, e o resto espera a aprovação.
 */

import { prisma } from "@/lib/prisma";
import { pendenciasDeSincronizacao } from "@/lib/sincronizacao";
import { marcarNegocioPerdido, pipedriveConfigurado, registrarNegocioAprovado, testarConexao } from "./pipedrive";
import { textoDoRelatorioDoPedido } from "@/lib/texto-relatorio-pedido";

export async function reprocessarPedidoPipedrive(pedidoId: string): Promise<{ ok: boolean; erro?: string }> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { id: true, status: true, pipedriveNegocioId: true, motivoCancelamento: true, relatorio: { select: { aprovadoEm: true } } },
  });
  if (!pedido) return { ok: false, erro: "Agendamento não encontrado." };

  // Desde a ata de 03/11 o negócio só nasce com o relatório aprovado.
  if (pedido.relatorio?.aprovadoEm) {
    await registrarNegocioAprovado(pedido.id, await textoDoRelatorioDoPedido(pedido.id));
  } else if (pedido.status === "CANCELADO" && pedido.pipedriveNegocioId) {
    await marcarNegocioPerdido(pedido.id, pedido.motivoCancelamento);
  } else {
    // Nada a escrever agora (o negócio virá na aprovação): a pendência antiga
    // de "criar negócio" sai da lista em vez de ficar para sempre.
    await prisma.sincronizacaoExterna.create({
      data: {
        sistema: "PIPEDRIVE",
        entidade: "Pedido",
        entidadeId: pedido.id,
        acao: "aguardando-aprovacao",
        sucesso: true,
        referencia: pedido.pipedriveNegocioId,
      },
    });
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
