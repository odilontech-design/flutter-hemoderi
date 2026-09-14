"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { registrarResultado, type Resultado } from "./pedidos";

/**
 * O relatório pós-atendimento — a peça central do portal do profissional.
 *
 * Ele fecha o pedido e registra o que aconteceu de fato. O repasse, porém,
 * não nasce daqui: desde a ata de 14/09, ele depende de a equipe APROVAR o
 * relatório (ver aprovarRelatorio em actions/financeiro). Em campo o
 * procedimento muda — membrana que virou stickbone, quantidade diferente do
 * combinado —, e pagar antes de alguém conferir é pagar o que a clínica
 * ainda vai contestar.
 *
 * O relatório continua EDITÁVEL enquanto não for aprovado: é o profissional
 * corrigindo o que digitou errado, não reabrindo um pagamento.
 */
export async function enviarRelatorio(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await exigirProfissional();

  const pedidoId = String(dados.get("pedidoId") ?? "");
  const compareceu = String(dados.get("compareceu") ?? "sim") === "sim";

  // O pedido precisa ser DESTE profissional. Sem esse filtro, trocar o id no
  // formulário fecharia o atendimento de outra pessoa.
  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId, profissionalId: sessao.profissionalId },
    select: { id: true, status: true, relatorio: { select: { aprovadoEm: true } } },
  });
  if (!pedido) return { ok: false, erro: "Atendimento não encontrado na sua agenda." };

  // Reenvio corrige o que foi digitado errado — a não ser que a equipe já
  // tenha aprovado: dali em diante o relatório virou base de pagamento, e
  // mexer nele sozinho seria mexer no próprio repasse.
  const jaAprovado = pedido.relatorio?.aprovadoEm != null;
  if (jaAprovado) {
    return {
      ok: false,
      erro: "Este relatório já foi aprovado pela equipe. Fale com a central para qualquer correção.",
    };
  }
  if (pedido.status !== "ALOCADO" && !pedido.relatorio) {
    return { ok: false, erro: "Este atendimento já foi finalizado." };
  }

  const quantidade = Number(dados.get("quantidade") ?? 1);

  // Vem do navegador, no momento do envio — pode faltar (permissão negada,
  // sem GPS, formulário enviado de um jeito que não passou por lá). Nulo é
  // um estado normal aqui, não um erro: confirma presença quando dá, nunca
  // trava o relatório quando não dá.
  const latitude = Number(dados.get("latitude"));
  const longitude = Number(dados.get("longitude"));
  const precisaoMetros = Number(dados.get("precisaoMetros"));
  const localizacao =
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude, precisaoMetros: Number.isFinite(precisaoMetros) ? precisaoMetros : null }
      : { latitude: null, longitude: null, precisaoMetros: null };

  const conteudo = {
    compareceu,
    inicioReal: String(dados.get("inicioReal") ?? "") || null,
    fimReal: String(dados.get("fimReal") ?? "") || null,
    quantidade: Number.isFinite(quantidade) && quantidade > 0 ? Math.trunc(quantidade) : 1,
    intercorrencia: String(dados.get("intercorrencia") ?? "") === "sim",
    observacoes: String(dados.get("observacoes") ?? "") || null,
    // A chave confirmada no ato pode ser diferente da do cadastro (conta
    // nova, chave trocada). É a que vale para ESTE repasse: conferir agora
    // evita o pagamento devolvido três dias depois.
    chavePixConfirmada: String(dados.get("chavePixConfirmada") ?? "").trim() || null,
  };

  await prisma.relatorioAtendimento.upsert({
    where: { pedidoId: pedido.id },
    // Update de verdade, não vazio: reenviar é corrigir, e um upsert que
    // ignora a correção devolve "salvo" sem ter salvo nada.
    update: { ...conteudo, ...localizacao },
    create: { pedidoId: pedido.id, profissionalId: sessao.profissionalId, ...conteudo, ...localizacao },
  });

  // Só fecha o pedido na primeira vez; correção não reabre a esteira.
  const resultado =
    pedido.status === "ALOCADO"
      ? await registrarResultado(pedido.id, compareceu, sessao.usuarioId)
      : { ok: true as const };

  revalidatePath("/profissional");
  revalidatePath("/painel/financeiro");
  return resultado;
}
