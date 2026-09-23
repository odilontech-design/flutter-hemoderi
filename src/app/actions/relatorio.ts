"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { ajudaCustoEmCentavos, camposClinicosEmBranco, CAMPOS_CLINICOS } from "@/lib/relatorio";
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

  // Campos clínicos: obrigatórios, mas "não se aplica" conta como resposta
  // (ata de 21/09). Só são exigidos quando houve atendimento — num "não
  // compareceu" não existe sinal vital para medir.
  const clinicos = Object.fromEntries(
    CAMPOS_CLINICOS.map((campo) => [campo.nome, String(dados.get(campo.nome) ?? "").trim() || null])
  ) as Record<string, string | null>;

  if (compareceu) {
    const faltando = camposClinicosEmBranco(clinicos);
    if (faltando.length > 0) {
      const nomes = faltando.map((c) => c.rotulo).join(", ");
      return {
        ok: false,
        erro: `Falta preencher: ${nomes}. Use "não se aplica" no que não foi medido neste atendimento.`,
      };
    }
  }

  const ajudaCustoCentavos = ajudaCustoEmCentavos(String(dados.get("ajudaCusto") ?? ""));
  if (ajudaCustoCentavos === undefined) {
    return { ok: false, erro: "Ajuda de custo: use só números, como 150,00." };
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
    ...clinicos,
    // O que a pessoa executou além do contratado — a membrana que virou
    // stickybone. Declarado aqui, validado pelo pós-venda na aprovação.
    servicosAdicionais: String(dados.get("servicosAdicionais") ?? "").trim() || null,
    ajudaCustoCentavos,
    ajudaCustoJustificativa: String(dados.get("ajudaCustoJustificativa") ?? "").trim() || null,
    // A chave confirmada no ato pode ser diferente da do cadastro (conta
    // nova, chave trocada). É a que vale para ESTE repasse: conferir agora
    // evita o pagamento devolvido três dias depois.
    chavePixConfirmada: String(dados.get("chavePixConfirmada") ?? "").trim() || null,
  };

  await prisma.relatorioAtendimento.upsert({
    where: { pedidoId: pedido.id },
    // Update de verdade, não vazio: reenviar é corrigir, e um upsert que
    // ignora a correção devolve "salvo" sem ter salvo nada.
    //
    // A correção derruba as conferências que o pós-venda já tinha feito: o
    // que foi validado era o texto anterior. Manter o "serviço conferido" em
    // cima de um serviço reescrito é pior que não ter conferência nenhuma,
    // porque parece conferido.
    update: {
      ...conteudo,
      ...localizacao,
      servicoValidadoEm: null,
      valorValidadoEm: null,
      ajudaCustoValidadaEm: null,
    },
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
