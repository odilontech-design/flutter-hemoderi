"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirAdministradorTecnico } from "@/lib/sessao";
import { donoDosNegocios, reatribuirNegocios, testarConexao, usuariosDoPipedrive } from "@/lib/integracoes/pipedrive";
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

/**
 * Mostra em nome de quem os negócios novos nascem. Se não achou a Sthefany,
 * lista os usuários do PipeDrive com o número de cada um — o número vai em
 * PIPEDRIVE_DONO_ID na Vercel e resolve de vez.
 */
export async function verificarDonoPipedrive(): Promise<Resultado> {
  await exigirAdministradorTecnico();
  try {
    const dono = await donoDosNegocios();
    const usuarios = await usuariosDoPipedrive();
    if (dono) {
      const u = usuarios.find((x) => x.id === dono);
      return { ok: true, avisos: [`Os negócios novos nascem com ${u?.name ?? "o usuário"} ${u?.email ? `(${u.email}) ` : ""}— número ${dono}.`] };
    }
    const lista = usuarios.filter((u) => u.active_flag !== false).map((u) => `${u.name ?? "?"} <${u.email ?? "sem e-mail"}> = ${u.id}`).join(" · ");
    return { ok: false, erro: `Não achei a Sthefany. Os negócios estão indo para o dono do token. Usuários: ${lista}. Coloque o número dela em PIPEDRIVE_DONO_ID na Vercel e faça o redeploy.` };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Falhou." };
  }
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

/**
 * Passa para a Sthefany os negócios que já estavam no PipeDrive em nome de
 * quem agendou (pedido de 05/11). Um lote por chamada; a tela chama de novo
 * com `aPartirDe` até acabar.
 */
export async function reatribuirNegociosPipedrive(aPartirDe?: string): Promise<{ ok: boolean; erro?: string; feitos: number; restam: number; ultimo: string | null; falhas: string[] }> {
  await exigirAdministradorTecnico();
  const r = await reatribuirNegocios(40, aPartirDe);
  return { ok: r.falhas.length === 0, erro: r.falhas[0], ...r };
}
