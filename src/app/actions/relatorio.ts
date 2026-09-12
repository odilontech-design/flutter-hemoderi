"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { registrarResultado, type Resultado } from "./pedidos";

/**
 * O relatório pós-atendimento — a peça central do portal do profissional.
 *
 * Ele fecha o pedido e destrava o repasse na mesma ação. Separar "enviar
 * relatório" de "marcar como realizado" criaria a situação que a operação
 * quer eliminar: atendimento feito, relatório na mão de alguém e ninguém
 * sabendo se pode pagar.
 */
export async function enviarRelatorio(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await exigirProfissional();

  const pedidoId = String(dados.get("pedidoId") ?? "");
  const compareceu = String(dados.get("compareceu") ?? "sim") === "sim";

  // O pedido precisa ser DESTE profissional. Sem esse filtro, trocar o id no
  // formulário fecharia o atendimento de outra pessoa.
  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId, profissionalId: sessao.profissionalId },
    select: { id: true, status: true },
  });
  if (!pedido) return { ok: false, erro: "Atendimento não encontrado na sua agenda." };
  if (pedido.status !== "ALOCADO") return { ok: false, erro: "Este atendimento já foi finalizado." };

  const quantidade = Number(dados.get("quantidade") ?? 1);

  await prisma.relatorioAtendimento.upsert({
    where: { pedidoId: pedido.id },
    update: {},
    create: {
      pedidoId: pedido.id,
      profissionalId: sessao.profissionalId,
      compareceu,
      inicioReal: String(dados.get("inicioReal") ?? "") || null,
      fimReal: String(dados.get("fimReal") ?? "") || null,
      quantidade: Number.isFinite(quantidade) && quantidade > 0 ? Math.trunc(quantidade) : 1,
      intercorrencia: String(dados.get("intercorrencia") ?? "") === "sim",
      observacoes: String(dados.get("observacoes") ?? "") || null,
    },
  });

  const resultado = await registrarResultado(pedido.id, compareceu, sessao.usuarioId);
  revalidatePath("/profissional");
  return resultado;
}
