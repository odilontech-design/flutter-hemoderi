"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirClinica, registrarAuditoria } from "@/lib/sessao";
import { LIMITE_TEXTO_NPS, notaNpsValida } from "@/lib/nps";
import type { Resultado } from "./pedidos";

/**
 * Resposta da clínica à pesquisa de NPS.
 *
 * A pesquisa nasce pela rotina (`/api/rotinas/nps`), não por escolha da
 * clínica — ela só responde a que já existe. Por isso não há "criar", só
 * "responder": o mesmo formato de `avaliarAtendimento`, mas aqui a resposta
 * é definitiva (a pesquisa mede um período que já passou; não faz sentido
 * "corrigir a nota" de uma janela fechada como faz sentido corrigir a
 * estrela de um atendimento).
 */
export async function responderNps(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await exigirClinica();

  const pesquisaId = String(dados.get("pesquisaId") ?? "");
  const notaBruta = String(dados.get("nota") ?? "");
  const pontosPositivos = String(dados.get("pontosPositivos") ?? "").trim();
  const expectativasNaoAtendidas = String(dados.get("expectativasNaoAtendidas") ?? "").trim();
  const sugestoes = String(dados.get("sugestoes") ?? "").trim();

  if (!notaNpsValida(notaBruta)) return { ok: false, erro: "Escolha uma nota de 0 a 10." };
  const nota = Number(notaBruta);

  for (const [rotulo, texto] of [
    ["pontos positivos", pontosPositivos],
    ["expectativas não atendidas", expectativasNaoAtendidas],
    ["sugestões", sugestoes],
  ] as const) {
    if (texto.length > LIMITE_TEXTO_NPS) {
      return { ok: false, erro: `O campo de ${rotulo} passa de ${LIMITE_TEXTO_NPS} caracteres.` };
    }
  }

  const pesquisa = await prisma.pesquisaNps.findUnique({
    where: { id: pesquisaId },
    select: { id: true, clinicaId: true, respondidaEm: true },
  });

  // Pesquisa de outra clínica responde igual a inexistente — mesmo cuidado
  // de escopo do resto do sistema: nunca confirmar que o id existe para
  // quem não é dono dele.
  if (!pesquisa || pesquisa.clinicaId !== sessao.clinicaId) {
    return { ok: false, erro: "Pesquisa não encontrada." };
  }
  if (pesquisa.respondidaEm) {
    return { ok: false, erro: "Esta pesquisa já foi respondida." };
  }

  await prisma.pesquisaNps.update({
    where: { id: pesquisa.id },
    data: {
      nota,
      pontosPositivos: pontosPositivos || null,
      expectativasNaoAtendidas: expectativasNaoAtendidas || null,
      sugestoes: sugestoes || null,
      respondidaEm: new Date(),
    },
  });

  await registrarAuditoria(sessao.usuarioId, "PesquisaNps", pesquisa.id, "nps-respondido", `nota ${nota}`);

  revalidatePath("/portal");
  return { ok: true };
}
