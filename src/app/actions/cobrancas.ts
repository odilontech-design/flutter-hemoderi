"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirInterno, registrarAuditoria } from "@/lib/sessao";
import { perfilPermite } from "@/lib/papeis";
import { criarCobrancaPix, consultarCobranca } from "@/lib/integracoes/santander-pix";
import type { Resultado } from "./pedidos";

/**
 * Gera uma cobrança Pix para uma fatura.
 *
 * Chamada pelo pós-venda (Stephanie) na esteira do faturamento, depois que
 * a fatura está fechada e o cupom (se houver) já foi aplicado.
 */
export async function gerarCobrancaPixFatura(faturaId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "POS_VENDA")) {
    return { ok: false, erro: "Só o pós-venda ou o responsável gera cobrança Pix." };
  }

  const fatura = await prisma.fatura.findUnique({
    where: { id: faturaId },
    include: {
      clinica: { select: { nome: true, cnpj: true } },
      cobrancas: { where: { status: "ATIVA" }, select: { id: true } },
    },
  });
  if (!fatura) return { ok: false, erro: "Fatura não encontrada." };
  if (fatura.status !== "ABERTA") return { ok: false, erro: "Só se gera cobrança para fatura aberta." };
  if (fatura.cobrancas.length > 0) {
    return { ok: false, erro: "Já existe uma cobrança ativa para esta fatura. Cancele-a antes de gerar outra." };
  }

  const valorLiquido = fatura.valorCentavos - fatura.descontoCentavos;
  if (valorLiquido <= 0) {
    return { ok: false, erro: "O valor líquido da fatura é zero — não há o que cobrar." };
  }

  const resultado = await criarCobrancaPix({
    faturaId: fatura.id,
    valorCentavos: valorLiquido,
    vencimento: fatura.vencimento,
    descricao: `Hemoderi - Fatura ${fatura.numero}`,
    devedorNome: fatura.clinica.nome,
    devedorCnpj: fatura.clinica.cnpj ?? undefined,
  });

  if (!resultado.ok) {
    return { ok: false, erro: resultado.erro ?? "Erro ao gerar cobrança no Santander." };
  }

  await registrarAuditoria(
    sessao.usuarioId,
    "Fatura",
    faturaId,
    "gerar-pix",
    `txid: ${resultado.txid}`
  );

  revalidatePath("/painel/financeiro");
  return { ok: true };
}

/**
 * Consulta o status de uma cobrança Pix e atualiza o banco.
 */
export async function consultarCobrancaPix(cobrancaId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "POS_VENDA")) {
    return { ok: false, erro: "Só o pós-venda ou o responsável consulta cobranças." };
  }

  const cobranca = await prisma.cobrancaPix.findUnique({
    where: { id: cobrancaId },
    select: { txid: true },
  });
  if (!cobranca) return { ok: false, erro: "Cobrança não encontrada." };

  const resultado = await consultarCobranca(cobranca.txid);

  if (!resultado.ok) {
    return { ok: false, erro: resultado.erro ?? "Erro ao consultar o Santander." };
  }

  await registrarAuditoria(
    sessao.usuarioId,
    "CobrancaPix",
    cobrancaId,
    "consultar-status",
    `status: ${resultado.status}`
  );

  revalidatePath("/painel/financeiro");

  if (resultado.pago) {
    return { ok: true };
  }
  return { ok: true };
}

/**
 * Cancela uma cobrança Pix ativa.
 */
export async function cancelarCobrancaPix(cobrancaId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "POS_VENDA")) {
    return { ok: false, erro: "Só o pós-venda ou o responsável cancela cobranças." };
  }

  const cobranca = await prisma.cobrancaPix.findUnique({
    where: { id: cobrancaId },
    select: { id: true, status: true },
  });
  if (!cobranca) return { ok: false, erro: "Cobrança não encontrada." };
  if (cobranca.status !== "ATIVA") {
    return { ok: false, erro: "Só se cancela cobrança com status ativa." };
  }

  await prisma.cobrancaPix.update({
    where: { id: cobrancaId },
    data: { status: "CANCELADA" },
  });

  await registrarAuditoria(sessao.usuarioId, "CobrancaPix", cobrancaId, "cancelar");
  revalidatePath("/painel/financeiro");
  return { ok: true };
}
