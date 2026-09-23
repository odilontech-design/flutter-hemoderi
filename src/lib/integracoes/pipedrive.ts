/**
 * PipeDrive.
 *
 * Por decisão do cliente (14/09), o PipeDrive continua sendo a fonte central
 * do histórico comercial — este sistema não replica funil nem contatos. Duas
 * escritas, e só essas: criar o negócio quando o pedido nasce (21/09,
 * "automatizar a criação de negócios entre as plataformas") e marcar como
 * GANHO quando o atendimento é realizado.
 *
 * Escrever menos aqui é a decisão, não uma etapa faltando: duas fontes
 * editáveis do mesmo dado comercial divergem em semanas.
 *
 * A CONFIGURAR (Andre Miguel, ata de 21/09 — "criar funil de teste e
 * coletar as chaves de API"):
 *   PIPEDRIVE_API_TOKEN, PIPEDRIVE_DOMINIO — sem os dois, toda chamada vira
 *     um registro em SincronizacaoExterna e a operação segue sem travar.
 *   PIPEDRIVE_CAMPO_NUMERO_PEDIDO — a chave (hash) do campo personalizado
 *     onde o número do pedido deve entrar (pergunta 36 do questionário
 *     técnico). Sem ela, o número ainda aparece no TÍTULO do negócio — só
 *     não fica num campo pesquisável separado.
 *   PIPEDRIVE_ID_FUNIL, PIPEDRIVE_ID_ETAPA — funil e etapa onde o negócio
 *     deve nascer. Sem eles, o PipeDrive usa o funil e a etapa padrão da
 *     conta, o que é uma orfandade inofensiva até o funil de teste existir.
 */

import { prisma } from "@/lib/prisma";
import { codigoDoPedido } from "@/lib/numeracao";

function configurado(): boolean {
  return Boolean(process.env.PIPEDRIVE_API_TOKEN && process.env.PIPEDRIVE_DOMINIO);
}

function urlBase(caminho: string): string {
  const dominio = process.env.PIPEDRIVE_DOMINIO;
  const token = process.env.PIPEDRIVE_API_TOKEN;
  return `https://${dominio}.pipedrive.com/api/v1${caminho}?api_token=${token}`;
}

async function registrarSincronizacao(
  pedidoId: string,
  acao: string,
  sucesso: boolean,
  referencia?: string,
  erro?: string
): Promise<void> {
  await prisma.sincronizacaoExterna.create({
    data: { sistema: "PIPEDRIVE", entidade: "Pedido", entidadeId: pedidoId, acao, sucesso, referencia, erro },
  });
}

/**
 * Cria o negócio no PipeDrive quando o pedido nasce no sistema.
 *
 * Idempotente por `pipedriveNegocioId`: um pedido só ganha um negócio uma
 * vez. Chamado logo depois de `criarPedido` e `solicitarPedido` — o mesmo
 * ponto onde a mensagem de confirmação e o evento do Google Agenda já
 * nascem, e pelo mesmo motivo: é side-effect de fora, nunca pode derrubar a
 * criação do pedido em si.
 */
export async function criarNegocio(pedidoId: string): Promise<void> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: {
      id: true,
      numero: true,
      data: true,
      valorServicoCentavos: true,
      pipedriveNegocioId: true,
      clinica: { select: { nome: true } },
      servico: { select: { nome: true } },
    },
  });
  if (!pedido || pedido.pipedriveNegocioId) return;

  const titulo = `${codigoDoPedido(pedido.numero, pedido.clinica.nome, pedido.data)} — ${pedido.servico.nome}`;

  if (!configurado()) {
    await registrarSincronizacao(pedido.id, "criar-negocio", false, undefined, "Integração não configurada.");
    return;
  }

  const campoNumero = process.env.PIPEDRIVE_CAMPO_NUMERO_PEDIDO;
  const idFunil = process.env.PIPEDRIVE_ID_FUNIL;
  const idEtapa = process.env.PIPEDRIVE_ID_ETAPA;

  const corpo: Record<string, unknown> = {
    title: titulo,
    value: pedido.valorServicoCentavos / 100,
    currency: "BRL",
  };
  // Campos personalizados do PipeDrive são endereçados pela própria chave
  // hash no corpo do negócio — não existe um envelope "custom_fields": {}.
  if (campoNumero) corpo[campoNumero] = String(pedido.numero);
  if (idFunil) corpo.pipeline_id = Number(idFunil);
  if (idEtapa) corpo.stage_id = Number(idEtapa);

  try {
    const resposta = await fetch(urlBase("/deals"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    const json = (await resposta.json()) as { data?: { id?: number } };
    const negocioId = json.data?.id;
    if (!negocioId) throw new Error("Resposta do PipeDrive sem id do negócio.");

    await prisma.pedido.update({ where: { id: pedido.id }, data: { pipedriveNegocioId: String(negocioId) } });
    await registrarSincronizacao(pedido.id, "criar-negocio", true, String(negocioId));
  } catch (erro) {
    await registrarSincronizacao(
      pedido.id,
      "criar-negocio",
      false,
      undefined,
      erro instanceof Error ? erro.message : String(erro)
    );
  }
}

/** Marca o negócio como GANHO quando o atendimento é realizado (14/09). */
export async function marcarNegocioGanho(pedidoId: string): Promise<void> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { id: true, pipedriveNegocioId: true },
  });
  if (!pedido?.pipedriveNegocioId) return;

  if (!configurado()) {
    await registrarSincronizacao(
      pedido.id,
      "marcar-ganho",
      false,
      pedido.pipedriveNegocioId,
      "Integração não configurada."
    );
    return;
  }

  try {
    const resposta = await fetch(urlBase(`/deals/${pedido.pipedriveNegocioId}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "won" }),
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    await registrarSincronizacao(pedido.id, "marcar-ganho", true, pedido.pipedriveNegocioId);
  } catch (erro) {
    await registrarSincronizacao(
      pedido.id,
      "marcar-ganho",
      false,
      pedido.pipedriveNegocioId,
      erro instanceof Error ? erro.message : String(erro)
    );
  }
}
