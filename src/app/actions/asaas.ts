"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirAdministradorTecnico, registrarAuditoria } from "@/lib/sessao";
import {
  cancelarCobrancaNoAsaas,
  conferirCobrancaNoAsaas,
  conferirEmAberto,
  testarConexaoAsaas as testarAsaas,
} from "@/lib/integracoes/asaas";
import { ROTULO_STATUS_CARTAO, type StatusCartao } from "@/lib/asaas-status";
import type { Resultado } from "./pedidos";

/** Restritas ao responsável técnico, como o resto de Integrações: mexem em dinheiro de outro sistema. */

export async function testarConexaoAsaas(): Promise<Resultado> {
  await exigirAdministradorTecnico();
  const r = await testarAsaas();
  return r.ok ? { ok: true, avisos: [`Conexão com o Asaas funcionando (${r.ambiente}).`] } : { ok: false, erro: r.erro };
}

export async function conferirCobrancaCartao(id: string): Promise<Resultado> {
  const sessao = await exigirAdministradorTecnico();
  const r = await conferirCobrancaNoAsaas(id);
  if (!r.ok) return { ok: false, erro: r.erro };
  await registrarAuditoria(sessao.usuarioId, "CobrancaCartao", id, "asaas-conferir", r.status);
  revalidatePath("/painel/integracoes");
  const rotulo = ROTULO_STATUS_CARTAO[r.status as StatusCartao] ?? r.status;
  return { ok: true, avisos: [r.mudou ? `Acertada: agora está "${rotulo}".` : `Sem mudança: "${rotulo}" no Asaas.`] };
}

export async function conferirCobrancasEmAberto(): Promise<Resultado> {
  const sessao = await exigirAdministradorTecnico();
  const r = await conferirEmAberto(30);
  await registrarAuditoria(sessao.usuarioId, "CobrancaCartao", "lote", "asaas-conferir-todas", `${r.conferidas} conferidas, ${r.acertadas} acertadas`);
  revalidatePath("/painel/integracoes");
  if (r.conferidas === 0) return { ok: true, avisos: ["Nenhuma cobrança em aberto para conferir."] };
  return {
    ok: r.falhas.length === 0,
    ...(r.falhas.length ? { erro: `${r.falhas.length} falha(s): ${r.falhas[0]}` } : {}),
    avisos: [`${r.conferidas} conferida(s), ${r.acertadas} acertada(s).`],
  };
}

export async function cancelarCobrancaCartao(id: string): Promise<Resultado> {
  const sessao = await exigirAdministradorTecnico();
  const r = await cancelarCobrancaNoAsaas(id);
  if (!r.ok) return { ok: false, erro: r.erro };
  await registrarAuditoria(sessao.usuarioId, "CobrancaCartao", id, "asaas-cancelar", "cancelada pela equipe");
  revalidatePath("/painel/integracoes");
  return { ok: true, avisos: ["Cobrança cancelada no Asaas: o link deixa de funcionar."] };
}

/**
 * Depois de um estorno no Asaas o dinheiro voltou ao cliente: os atendimentos
 * deixam de contar como pagos no cartão e voltam a poder ser cobrados. Não
 * mexe no que foi pago por Pix, e só nos atendimentos que nenhuma outra
 * cobrança paga cobre.
 */
export async function reabrirAtendimentosEstornados(id: string): Promise<Resultado> {
  const sessao = await exigirAdministradorTecnico();
  const cobranca = await prisma.cobrancaCartao.findUnique({ where: { id } });
  if (!cobranca) return { ok: false, erro: "Cobrança não encontrada." };
  if (cobranca.status !== "ESTORNADA") return { ok: false, erro: "Só se reabre uma cobrança estornada." };

  const outras = await prisma.cobrancaCartao.findMany({
    where: { id: { not: id }, status: "PAGA", pedidoIds: { hasSome: cobranca.pedidoIds } },
    select: { pedidoIds: true },
  });
  const cobertos = new Set(outras.flatMap((o) => o.pedidoIds));
  const aReabrir = cobranca.pedidoIds.filter((p) => !cobertos.has(p));
  const { count } = await prisma.pedido.updateMany({ where: { id: { in: aReabrir } }, data: { cartaoPagoEm: null } });
  await prisma.cobrancaCartao.update({ where: { id }, data: { observacao: `Atendimentos reabertos após o estorno (${count}).` } });
  await registrarAuditoria(sessao.usuarioId, "CobrancaCartao", id, "asaas-reabrir", `${count} atendimento(s) voltaram a pendente`);
  revalidatePath("/painel/integracoes");
  revalidatePath("/painel/financeiro");
  return { ok: true, avisos: [`${count} atendimento(s) voltaram a constar como não pagos no cartão.`] };
}
