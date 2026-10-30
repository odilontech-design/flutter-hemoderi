/**
 * O contrato com a API de integração do Dilon Zap
 * (`POST /api/integracao/mensagens`, chave `Bearer dz_...`). Regras puras, sem
 * banco, para os testes cobrirem; quem envia é `despacharPendentes`.
 *
 * O Dilon Zap não envia direto: põe a mensagem na fila de saída dele, no
 * número geral da empresa, e respeita os contatos que pediram para não
 * receber. "Aceita" aqui é "entrou na fila de lá", não "entregue".
 */

import type { TipoMensagem } from "@prisma/client";

export type CorpoDilonZap = {
  /** Dígitos com DDI e DDD — o Dilon Zap monta o contato do WhatsApp a partir deles. */
  telefone: string;
  /** Usado só se o contato ainda não existir lá; nome editado pela equipe não é sobrescrito. */
  nome?: string;
  mensagem: string;
  /** Rastreio nos dois lados: o id da mensagem na fila do Hemoderi. */
  referencia: string;
};

export function corpoParaDilonZap(mensagem: {
  id: string;
  destinatario: string;
  texto: string;
  nome?: string | null;
}): CorpoDilonZap {
  return {
    telefone: mensagem.destinatario,
    ...(mensagem.nome ? { nome: mensagem.nome.slice(0, 120) } : {}),
    mensagem: mensagem.texto,
    referencia: `hemoderi:${mensagem.id}`,
  };
}

/**
 * O que fazer com a resposta.
 *
 *   - `enviada`: entrou na fila do Dilon Zap.
 *   - `falha`: problema DESTA mensagem (telefone inválido, contato que pediu
 *     para não receber). Fica como FALHA, visível para a equipe.
 *   - `parar`: problema da INTEGRAÇÃO (chave errada, fora do plano, nenhum
 *     número conectado, Dilon Zap fora do ar). A mensagem continua PENDENTE e
 *     a rodada para ali — marcar as 50 como falha por causa de um número
 *     desconectado só daria trabalho de reenvio depois.
 */
export type Desfecho = { resultado: "enviada" } | { resultado: "falha" | "parar"; erro: string };

export function interpretarResposta(status: number, corpo: unknown): Desfecho {
  const erroDeLa =
    corpo && typeof corpo === "object" && "error" in corpo
      ? typeof (corpo as { error: unknown }).error === "string"
        ? ((corpo as { error: string }).error as string)
        : JSON.stringify((corpo as { error: unknown }).error)
      : null;
  const detalhe = (texto: string) => `Dilon Zap: ${erroDeLa ?? texto} (HTTP ${status})`;

  if (status >= 200 && status < 300) return { resultado: "enviada" };
  if (status === 401) return { resultado: "parar", erro: detalhe("chave de API inválida") };
  if (status === 403) return { resultado: "parar", erro: detalhe("integração fora do plano") };
  if (status === 409) {
    // Dois 409 bem diferentes: número desconectado é da integração; contato
    // que optou por não receber é desta mensagem e não vai mudar sozinho.
    if (erroDeLa && /optou/i.test(erroDeLa)) return { resultado: "falha", erro: detalhe("contato bloqueado") };
    return { resultado: "parar", erro: detalhe("nenhum número conectado") };
  }
  // 404 sem corpo do Dilon Zap é página que não existe: endereço errado em
  // WHATSAPP_API_URL, não problema desta mensagem (revisão de 25/10 — as três
  // primeiras mensagens reais caíram como FALHA por isso).
  if (status === 404 && !erroDeLa) {
    return { resultado: "parar", erro: detalhe("endereço da API não encontrado — confira WHATSAPP_API_URL") };
  }
  if (status >= 400 && status < 500) return { resultado: "falha", erro: detalhe("mensagem recusada") };
  return { resultado: "parar", erro: detalhe("serviço indisponível") };
}

/**
 * Mensagem que perdeu o sentido não sai (ata de 14/10, antes de ligar a
 * integração): confirmação, alocação e lembrete de um atendimento que já
 * passou, ou aviso de resultado com mais de dois dias, chegariam como
 * informação velha — pior que não chegar.
 */
const VALIDADE_RESULTADO_MS = 2 * 24 * 60 * 60 * 1000;

/** Aviso de atraso só faz sentido no dia: depois de 6 horas do horário, não sai. */
const VALIDADE_ATRASO_MS = 6 * 60 * 60 * 1000;

export function mensagemVencida(params: {
  tipo: TipoMensagem;
  criadaEm: Date;
  /** Início do atendimento; null quando a mensagem não é de um pedido. */
  inicioDoAtendimento: Date | null;
  agora: Date;
}): boolean {
  // Feedback e cobrança de relatório são DEPOIS do atendimento, por natureza:
  // valem como o aviso de resultado, por dois dias desde que a equipe mandou.
  if (params.tipo === "RESULTADO" || params.tipo === "FEEDBACK" || params.tipo === "COBRANCA_RELATORIO") {
    return params.agora.getTime() - params.criadaEm.getTime() > VALIDADE_RESULTADO_MS;
  }
  if (params.tipo === "ATRASO" || params.tipo === "LEMBRETE_CHEGADA") {
    if (!params.inicioDoAtendimento) return false;
    return params.agora.getTime() - params.inicioDoAtendimento.getTime() > VALIDADE_ATRASO_MS;
  }
  if (!params.inicioDoAtendimento) return false;
  return params.inicioDoAtendimento.getTime() <= params.agora.getTime();
}

const CAMINHO_DA_API = "/api/integracao/mensagens";

/**
 * O endpoint a partir do que foi colado em WHATSAPP_API_URL: aceita só o
 * endereço do Dilon Zap ("https://zap.dilontech.com.br") ou o endpoint
 * completo, com ou sem barra no fim.
 */
export function urlDoDilonZap(valor: string | undefined | null): string | null {
  const limpo = (valor ?? "").trim().replace(/\/+$/, "");
  if (!limpo) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`);
  } catch {
    return null;
  }
  const caminho = url.pathname.replace(/\/+$/, "");
  if (!caminho.endsWith(CAMINHO_DA_API)) url.pathname = `${caminho}${CAMINHO_DA_API}`;
  return url.toString();
}

/** "fetch failed" com a causa de verdade (endereço inexistente, recusa, tempo). */
export function descreverErroDeRede(erro: unknown): string {
  if (!(erro instanceof Error)) return String(erro);
  if (erro.name === "TimeoutError" || erro.name === "AbortError") return "sem resposta a tempo";
  const causa = (erro as Error & { cause?: { code?: string; hostname?: string } }).cause;
  if (causa?.code === "ENOTFOUND") return `endereço não encontrado (${causa.hostname ?? "?"}) — confira WHATSAPP_API_URL`;
  return causa?.code ? `${erro.message} (${causa.code})` : erro.message;
}
