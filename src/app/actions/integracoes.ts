"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirResponsavel } from "@/lib/sessao";
import { criarNegocio, marcarNegocioGanho, pipedriveConfigurado, testarConexao } from "@/lib/integracoes/pipedrive";
import { pendenciasDeSincronizacao } from "@/lib/sincronizacao";
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
  const resultado = await reprocessarUm(pedidoId);
  revalidatePath("/painel/integracoes");
  return resultado;
}

async function reprocessarUm(pedidoId: string): Promise<Resultado> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { id: true, status: true, pipedriveNegocioId: true },
  });
  if (!pedido) return { ok: false, erro: "Agendamento não encontrado." };

  if (pedido.status === "REALIZADO") {
    await marcarNegocioGanho(pedido.id);
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

/** Confere token e domínio sem escrever nada no PipeDrive. */
export async function testarConexaoPipedrive(): Promise<Resultado> {
  await exigirResponsavel();
  const teste = await testarConexao();
  return teste.ok ? { ok: true, avisos: [teste.descricao] } : { ok: false, erro: teste.erro };
}

/** Por clique: cabe no tempo de uma função da Vercel mesmo com o PipeDrive lento. */
const LOTE = 20;

/**
 * Reprocessa as pendências em lote (ata de 21/10: 60 agendamentos sem
 * negócio). Antes de qualquer escrita testa a conexão — com domínio ou token
 * errado, as 60 falhariam do mesmo jeito e só encheriam o histórico. Para no
 * primeiro erro, pelo mesmo motivo.
 */
export async function reprocessarTodasPipedrive(): Promise<Resultado> {
  await exigirResponsavel();
  if (!pipedriveConfigurado()) return { ok: false, erro: "Integração não configurada." };

  const teste = await testarConexao();
  if (!teste.ok) return { ok: false, erro: teste.erro };

  const tentativas = await prisma.sincronizacaoExterna.findMany({
    where: { sistema: "PIPEDRIVE", entidade: "Pedido" },
    orderBy: { criadaEm: "desc" },
    take: 500,
    select: { entidadeId: true, acao: true, sucesso: true, erro: true, criadaEm: true },
  });
  const pedidoIds = [...new Set(pendenciasDeSincronizacao(tentativas).map((p) => p.entidadeId))];
  const existentes = new Set(
    (await prisma.pedido.findMany({ where: { id: { in: pedidoIds } }, select: { id: true } })).map((p) => p.id)
  );
  const fila = pedidoIds.filter((id) => existentes.has(id));

  let feitos = 0;
  for (const id of fila.slice(0, LOTE)) {
    const resultado = await reprocessarUm(id);
    if (!resultado.ok) {
      revalidatePath("/painel/integracoes");
      return { ok: false, erro: `${feitos} sincronizado(s); parou no erro: ${resultado.erro}` };
    }
    feitos++;
  }

  revalidatePath("/painel/integracoes");
  const restam = fila.length - feitos;
  return {
    ok: true,
    avisos: [`${feitos} sincronizado(s).${restam > 0 ? ` Restam ${restam} — clique de novo.` : ""}`],
  };
}
