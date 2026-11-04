"use server";

import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { perfilPermite } from "@/lib/papeis";
import { codigoDoPedido } from "@/lib/numeracao";
import { alocarPedido, desalocarPedido, type Resultado } from "./pedidos";

/**
 * Alocação, desalocação e realocação em massa (ata de 04/11): a logística
 * marca vários atendimentos na esteira e resolve de uma vez — "a agenda da
 * Ana Carolina em dezembro inteiro", "tirar a Sandra de todos da semana".
 *
 * Cada pedido passa pela MESMA regra da alocação individual (aptidão,
 * conflito de agenda, equipamento, repasse, aviso ao profissional anterior,
 * Google Agenda); o lote só repete o clique. Um pedido que falha não derruba
 * os outros: o retorno diz quais foram e por quê.
 */

const LIMITE = 60;

async function rotulos(ids: string[]): Promise<Map<string, string>> {
  const pedidos = await prisma.pedido.findMany({
    where: { id: { in: ids } },
    select: { id: true, numero: true, data: true, clinica: { select: { nome: true } } },
  });
  return new Map(pedidos.map((p) => [p.id, codigoDoPedido(p.numero, p.clinica.nome, p.data)]));
}

function resumo(feitos: number, verbo: string, falhas: string[]): Resultado {
  if (feitos === 0 && falhas.length > 0) return { ok: false, erro: falhas.join(" · ") };
  return {
    ok: true,
    avisos: [`${feitos} atendimento(s) ${verbo}.`, ...falhas],
  };
}

function validarIds(ids: string[]): string | null {
  if (ids.length === 0) return "Marque pelo menos um atendimento.";
  if (ids.length > LIMITE) return `Até ${LIMITE} atendimentos por vez.`;
  return null;
}

/** Aloca (ou realoca, tirando quem estava) o mesmo profissional em vários atendimentos. */
export async function alocarEmMassa(pedidoIds: string[], profissionalId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "LOGISTICA")) return { ok: false, erro: "Só a logística aloca profissionais." };
  const ids = Array.from(new Set(pedidoIds));
  const invalido = validarIds(ids);
  if (invalido) return { ok: false, erro: invalido };
  if (!profissionalId) return { ok: false, erro: "Escolha o profissional." };

  const nomes = await rotulos(ids);
  const atuais = await prisma.pedido.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, profissionalId: true, data: true, horaInicio: true },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
  });

  let feitos = 0;
  const falhas: string[] = [];
  for (const p of atuais) {
    const nome = nomes.get(p.id) ?? p.id;
    if (p.profissionalId === profissionalId) {
      feitos++;
      continue;
    }
    if (!["SOLICITADO", "CONFIRMADO", "ALOCADO"].includes(p.status)) {
      falhas.push(`${nome}: já está ${p.status.toLowerCase()}, não dá para alocar.`);
      continue;
    }
    if (p.status === "ALOCADO") {
      const saiu = await desalocarPedido(p.id, "Realocação em massa pela logística");
      if (!saiu.ok) {
        falhas.push(`${nome}: ${saiu.erro}`);
        continue;
      }
    }
    const r = await alocarPedido(p.id, profissionalId);
    if (r.ok) feitos++;
    else falhas.push(`${nome}: ${r.erro}`);
  }
  return resumo(feitos, "alocado(s)", falhas);
}

/** Tira o profissional de vários atendimentos de uma vez; eles voltam para "a alocar". */
export async function desalocarEmMassa(pedidoIds: string[], motivo: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "LOGISTICA")) return { ok: false, erro: "Só a logística desaloca profissionais." };
  const ids = Array.from(new Set(pedidoIds));
  const invalido = validarIds(ids);
  if (invalido) return { ok: false, erro: invalido };
  if (!motivo.trim()) return { ok: false, erro: "Informe o motivo." };

  const nomes = await rotulos(ids);
  const alocados = await prisma.pedido.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true },
  });

  let feitos = 0;
  const falhas: string[] = [];
  for (const p of alocados) {
    if (p.status !== "ALOCADO") continue;
    const r = await desalocarPedido(p.id, motivo.trim());
    if (r.ok) feitos++;
    else falhas.push(`${nomes.get(p.id) ?? p.id}: ${r.erro}`);
  }
  if (feitos === 0 && falhas.length === 0) return { ok: false, erro: "Nenhum dos marcados tem profissional alocado." };
  return resumo(feitos, "desalocado(s)", falhas);
}
