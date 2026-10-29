"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirAdministradorTecnico } from "@/lib/sessao";
import { testarConexao } from "@/lib/integracoes/pipedrive";
import { reprocessarPedidoPipedrive, reprocessarPendenciasPipedrive } from "@/lib/integracoes/pipedrive-pendencias";
import { despacharPendentes } from "@/lib/integracoes/whatsapp";
import type { Resultado } from "./pedidos";

/**
 * Reprocessa uma sincronização do PipeDrive que ficou pendente (ata de
 * 28/09). Restrito ao responsável: reprocessar escreve num sistema externo.
 * A regra de qual ação refazer está em lib/integracoes/pipedrive-pendencias.ts.
 */
export async function reprocessarPipedrive(pedidoId: string): Promise<Resultado> {
  await exigirAdministradorTecnico();
  const r = await reprocessarPedidoPipedrive(pedidoId);
  revalidatePath("/painel/integracoes");
  return r.ok ? { ok: true } : { ok: false, erro: r.erro };
}

/** Confere token e domínio sem escrever nada no PipeDrive. */
export async function testarConexaoPipedrive(): Promise<Resultado> {
  await exigirAdministradorTecnico();
  const teste = await testarConexao();
  return teste.ok ? { ok: true, avisos: [teste.descricao] } : { ok: false, erro: teste.erro };
}

/** Por clique: cabe no tempo de uma função da Vercel mesmo com o PipeDrive lento. */
const LOTE = 20;

/**
 * Reprocessa as pendências em lote (ata de 21/10). A mesma rotina roda
 * sozinha todo dia de manhã (app/api/rotinas/mensagens).
 */
export async function reprocessarTodasPipedrive(): Promise<Resultado> {
  await exigirAdministradorTecnico();
  const r = await reprocessarPendenciasPipedrive(LOTE);
  revalidatePath("/painel/integracoes");
  if (r.erro) return { ok: false, erro: `${r.feitos} sincronizado(s); parou no erro: ${r.erro}` };
  return {
    ok: true,
    avisos: [`${r.feitos} sincronizado(s).${r.restam > 0 ? ` Restam ${r.restam} — clique de novo.` : ""}`],
  };
}

/**
 * Devolve à fila as mensagens de WhatsApp que falharam e despacha (revisão de
 * 25/10). As que perderam o sentido — atendimento que já passou — o próprio
 * despacho cancela em vez de mandar informação velha.
 */
export async function reenviarFalhasWhatsapp(): Promise<Resultado> {
  await exigirAdministradorTecnico();
  if (!process.env.WHATSAPP_API_URL) return { ok: false, erro: "WHATSAPP_API_URL não configurada." };

  const { count } = await prisma.mensagemWhatsapp.updateMany({
    where: { status: "FALHA" },
    data: { status: "PENDENTE", erro: null },
  });
  const entrega = await despacharPendentes(LOTE);
  revalidatePath("/painel/integracoes");

  if (entrega.interrompido) return { ok: false, erro: entrega.interrompido };
  return {
    ok: true,
    avisos: [
      `${count} devolvida(s) à fila · ${entrega.enviadas} enviada(s) · ${entrega.canceladas} cancelada(s) por já terem passado · ${entrega.falhas} falha(s).`,
    ],
  };
}
