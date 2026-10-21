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
 *     O domínio é o subdomínio da conta ("hemoderi-5c2c36"); o endereço
 *     inteiro também é aceito (lib/integracoes/pipedrive-url.ts).
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
import {
  descreverErroPipedrive,
  mensagemDeHttpPipedrive,
  subdominioDoPipedrive,
  urlDaApiPipedrive,
} from "./pipedrive-url";

/** Sem resposta em 15 s, desiste: a criação do pedido não pode ficar esperando. */
const TEMPO_LIMITE_MS = 15_000;

export function pipedriveConfigurado(): boolean {
  return Boolean(process.env.PIPEDRIVE_API_TOKEN?.trim() && subdominioDoPipedrive(process.env.PIPEDRIVE_DOMINIO));
}
const configurado = pipedriveConfigurado;

function urlBase(caminho: string): string {
  return urlDaApiPipedrive(
    subdominioDoPipedrive(process.env.PIPEDRIVE_DOMINIO) ?? "",
    process.env.PIPEDRIVE_API_TOKEN ?? "",
    caminho
  );
}

async function chamar(caminho: string, metodo: "GET" | "POST" | "PUT", corpo?: unknown): Promise<unknown> {
  const resposta = await fetch(urlBase(caminho), {
    method: metodo,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    cache: "no-store",
  });
  const json = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(mensagemDeHttpPipedrive(resposta.status, json));
  return json;
}

/**
 * Confere token e domínio sem escrever nada: lê o usuário dono do token. É o
 * botão "testar conexão" da tela de integrações.
 */
export async function testarConexao(): Promise<{ ok: true; descricao: string } | { ok: false; erro: string }> {
  if (!configurado()) {
    return { ok: false, erro: "Faltam PIPEDRIVE_API_TOKEN e/ou PIPEDRIVE_DOMINIO (só o subdomínio da conta)." };
  }
  try {
    const json = (await chamar("/users/me", "GET")) as {
      data?: { name?: string; company_name?: string; company_domain?: string };
    };
    const d = json.data ?? {};
    return { ok: true, descricao: `Conectado como ${d.name ?? "?"} em ${d.company_name ?? "?"} (${d.company_domain ?? "?"}).` };
  } catch (erro) {
    return { ok: false, erro: descreverErroPipedrive(erro) };
  }
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
    const json = (await chamar("/deals", "POST", corpo)) as { data?: { id?: number } } | null;
    const negocioId = json?.data?.id;
    if (!negocioId) throw new Error("Resposta do PipeDrive sem id do negócio.");

    await prisma.pedido.update({ where: { id: pedido.id }, data: { pipedriveNegocioId: String(negocioId) } });
    await registrarSincronizacao(pedido.id, "criar-negocio", true, String(negocioId));
  } catch (erro) {
    await registrarSincronizacao(
      pedido.id,
      "criar-negocio",
      false,
      undefined,
      descreverErroPipedrive(erro)
    );
  }
}

/**
 * Marca o negócio como GANHO quando o atendimento é realizado (14/09).
 *
 * Se o negócio nunca chegou a nascer — a criação lá atrás falhou, ou o pedido
 * é anterior à integração — tenta criá-lo agora antes de marcar. Era esta a
 * "falha no registro" que a ata de 28/09 mandou revisar: um pedido realizado
 * cujo negócio não existia fazia esta função sair em silêncio, e o ganho
 * simplesmente não acontecia sem deixar rastro. Agora, ou o negócio é criado
 * e marcado, ou a lacuna fica gravada para a tela de integrações mostrar.
 */
export async function marcarNegocioGanho(pedidoId: string): Promise<void> {
  let pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { id: true, pipedriveNegocioId: true },
  });
  if (!pedido) return;

  // Sem negócio e com integração ligada: cria agora (idempotente) e relê.
  if (!pedido.pipedriveNegocioId && configurado()) {
    await criarNegocio(pedido.id);
    pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { id: true, pipedriveNegocioId: true },
    });
  }
  if (!pedido) return;

  if (!pedido.pipedriveNegocioId) {
    // Registra a lacuna em vez de sair calado: sem isto, um "ganho" que não
    // aconteceu ficava invisível. Configurada mas ainda sem negócio quer
    // dizer que a criação falhou — a tela de integrações pega os dois casos.
    await registrarSincronizacao(
      pedido.id,
      "marcar-ganho",
      false,
      undefined,
      configurado() ? "Sem negócio no PipeDrive para marcar como ganho." : "Integração não configurada."
    );
    return;
  }

  try {
    await chamar(`/deals/${pedido.pipedriveNegocioId}`, "PUT", { status: "won" });

    await registrarSincronizacao(pedido.id, "marcar-ganho", true, pedido.pipedriveNegocioId);
  } catch (erro) {
    await registrarSincronizacao(
      pedido.id,
      "marcar-ganho",
      false,
      pedido.pipedriveNegocioId,
      descreverErroPipedrive(erro)
    );
  }
}
