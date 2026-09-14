"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirClinica, registrarAuditoria } from "@/lib/sessao";
import { LIMITE_COMENTARIO, notaValida } from "@/lib/avaliacao";
import type { Resultado } from "./pedidos";

/**
 * Avaliação do atendimento pela clínica contratante.
 *
 * Quem avalia é sempre a clínica dona do pedido, e só depois de REALIZADO:
 * nota antes do atendimento é palpite, e nota de pedido alheio é o mesmo
 * furo de escopo que o resto do sistema fecha pegando a clínica da sessão em
 * vez de um campo do formulário.
 */
export async function avaliarAtendimento(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await exigirClinica();

  const pedidoId = String(dados.get("pedidoId") ?? "");
  const notaBruta = String(dados.get("nota") ?? "");
  const comentario = String(dados.get("comentario") ?? "").trim();

  if (!notaValida(notaBruta)) return { ok: false, erro: "Escolha de 1 a 5 estrelas." };
  const nota = Number(notaBruta);

  if (comentario.length > LIMITE_COMENTARIO) {
    return { ok: false, erro: `O comentário passa de ${LIMITE_COMENTARIO} caracteres.` };
  }

  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { id: true, numero: true, clinicaId: true, status: true, profissionalId: true },
  });

  // Pedido de outra clínica responde igual a pedido inexistente: dizer "esse
  // não é seu" confirma para quem está testando id que o pedido existe.
  if (!pedido || pedido.clinicaId !== sessao.clinicaId) {
    return { ok: false, erro: "Atendimento não encontrado." };
  }
  if (pedido.status !== "REALIZADO") {
    return { ok: false, erro: "Só é possível avaliar um atendimento já realizado." };
  }
  // Sem profissional não há quem avaliar. Não acontece num pedido realizado
  // pelo caminho normal, mas a média por profissional depende deste campo e
  // um nulo aqui viraria uma avaliação órfã que ninguém consegue ler.
  if (!pedido.profissionalId) {
    return { ok: false, erro: "Este atendimento não tem profissional registrado." };
  }

  const comum = {
    nota,
    comentario: comentario || null,
    profissionalId: pedido.profissionalId,
    clinicaId: pedido.clinicaId,
    criadoPorId: sessao.usuarioId,
  };

  // Upsert porque a clínica pode corrigir: errar a estrela no celular é
  // comum demais para virar registro permanente. O @updatedAt do schema
  // guarda quando mudou, então a correção fica visível para a equipe.
  await prisma.avaliacao.upsert({
    where: { pedidoId: pedido.id },
    create: { pedidoId: pedido.id, ...comum },
    update: comum,
  });

  await registrarAuditoria(
    sessao.usuarioId,
    "Pedido",
    pedido.id,
    "avaliar",
    `nº ${pedido.numero} · ${nota} estrela(s)`
  );

  revalidatePath("/portal");
  revalidatePath("/painel");
  revalidatePath("/painel/pedidos");
  revalidatePath("/painel/profissionais");
  return { ok: true };
}
