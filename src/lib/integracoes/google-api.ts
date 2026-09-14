import { createSign } from "node:crypto";

/**
 * O mínimo do Google para publicar um evento: assinar um JWT de conta de
 * serviço, trocar por um token e chamar a API de Agenda.
 *
 * Sem SDK de propósito. O `googleapis` traz o catálogo inteiro das APIs do
 * Google para usar três endpoints, e numa função serverless isso é peso de
 * cold start a cada chamada. O que a integração precisa cabe aqui: RS256 com
 * o crypto do Node, um POST de token e três chamadas REST.
 *
 * Este arquivo é o ÚNICO ponto que fala com a rede. Toda a decisão (o que
 * publicar, onde, criar ou mover) mora em google-agenda.ts, sem rede — é o
 * que permite testar a regra sem depender do Google estar de pé.
 */

const ESCOPO = "https://www.googleapis.com/auth/calendar.events";
const URL_TOKEN = "https://oauth2.googleapis.com/token";
const URL_AGENDA = "https://www.googleapis.com/calendar/v3/calendars";

/** Uma hora é o máximo que o Google concede; pede-se o máximo. */
const VIDA_DO_TOKEN_S = 3600;
/** Renova antes de expirar: um token que vence no meio da chamada vira 401. */
const FOLGA_S = 120;

export function integracaoConfigurada(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

/** A agenda usada quando o profissional não conectou a dele. Pode não existir. */
export function agendaDaOperacao(): string | null {
  return process.env.GOOGLE_AGENDA_ID || null;
}

function base64url(dados: Buffer | string): string {
  return Buffer.from(dados)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * A chave privada chega do ambiente com "\n" literal.
 *
 * Painéis de variáveis de ambiente (Vercel incluída) guardam o valor em uma
 * linha; colar a chave PEM sem converter é o erro nº 1 desta integração, e o
 * erro que o Google devolve ("error:1E08010C:DECODER routines") não diz isso
 * em lugar nenhum.
 */
export function normalizarChave(bruta: string): string {
  return bruta.replace(/\\n/g, "\n");
}

function chavePrivada(): string {
  return normalizarChave(process.env.GOOGLE_PRIVATE_KEY ?? "");
}

let tokenEmCache: { valor: string; expiraEm: number } | null = null;

/**
 * Token de acesso da conta de serviço, guardado em memória enquanto vale.
 *
 * Uma instância serverless atende várias requisições antes de morrer, e sem o
 * cache toda alocação de pedido pagaria uma ida ao Google só para pedir
 * permissão de falar com o Google.
 */
/**
 * O JWT que prova para o Google que somos a conta de serviço.
 *
 * Exportado para ter teste: é a peça que não dá para verificar olhando. Uma
 * assinatura montada errado devolve só "invalid_grant" do Google, sem dizer o
 * que está errado, e depurar isso contra a produção do Google é o pior lugar
 * possível para descobrir que faltava um traço no base64url.
 */
export function montarAssertion(
  clienteEmail: string,
  chavePem: string,
  agora = Math.floor(Date.now() / 1000)
): string {
  const cabecalho = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = base64url(
    JSON.stringify({
      iss: clienteEmail,
      scope: ESCOPO,
      aud: URL_TOKEN,
      iat: agora,
      exp: agora + VIDA_DO_TOKEN_S,
    })
  );
  const assinatura = base64url(
    createSign("RSA-SHA256").update(`${cabecalho}.${corpo}`).sign(chavePem)
  );
  return `${cabecalho}.${corpo}.${assinatura}`;
}

export async function obterToken(): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  if (tokenEmCache && tokenEmCache.expiraEm > agora + FOLGA_S) return tokenEmCache.valor;

  const assertion = montarAssertion(
    process.env.GOOGLE_CLIENT_EMAIL ?? "",
    chavePrivada(),
    agora
  );

  const resposta = await fetch(URL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const dados = (await resposta.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!resposta.ok || !dados.access_token) {
    throw new Error(
      `Google recusou a conta de serviço: ${dados.error_description ?? dados.error ?? resposta.status}`
    );
  }

  tokenEmCache = { valor: dados.access_token, expiraEm: agora + VIDA_DO_TOKEN_S };
  return dados.access_token;
}

/** Só para os testes: esquece o token guardado entre um caso e outro. */
export function esquecerToken(): void {
  tokenEmCache = null;
}

export type EventoGoogle = {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
};

/**
 * As três operações que a sincronização usa.
 *
 * O 404 ao apagar é sucesso, não erro: o evento já não estava lá (alguém
 * apagou na mão, ou a agenda foi trocada). Tratar como falha faria a operação
 * tentar de novo para sempre um evento que não existe.
 */
export type TransporteAgenda = {
  criar(agendaId: string, evento: EventoGoogle): Promise<string>;
  atualizar(agendaId: string, eventoId: string, evento: EventoGoogle): Promise<void>;
  apagar(agendaId: string, eventoId: string): Promise<void>;
};

async function chamar(caminho: string, metodo: string, corpo?: unknown): Promise<Response> {
  const token = await obterToken();
  return fetch(`${URL_AGENDA}/${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(corpo ? { "Content-Type": "application/json" } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
}

async function erroDe(resposta: Response, oQue: string): Promise<Error> {
  const texto = await resposta.text().catch(() => "");
  // A mensagem do Google vem aninhada e comprida; o que ajuda a equipe é o
  // status mais o começo do texto — 403 quase sempre é "a agenda não foi
  // compartilhada com a conta de serviço", e 404 é id de agenda errado.
  return new Error(`${oQue} falhou (HTTP ${resposta.status}): ${texto.slice(0, 300)}`);
}

export const transporteGoogle: TransporteAgenda = {
  async criar(agendaId, evento) {
    const resposta = await chamar(`${encodeURIComponent(agendaId)}/events`, "POST", evento);
    if (!resposta.ok) throw await erroDe(resposta, "Criar evento");
    const dados = (await resposta.json()) as { id?: string };
    if (!dados.id) throw new Error("Google criou o evento mas não devolveu id.");
    return dados.id;
  },

  async atualizar(agendaId, eventoId, evento) {
    const resposta = await chamar(
      `${encodeURIComponent(agendaId)}/events/${encodeURIComponent(eventoId)}`,
      "PATCH",
      evento
    );
    if (!resposta.ok) throw await erroDe(resposta, "Atualizar evento");
  },

  async apagar(agendaId, eventoId) {
    const resposta = await chamar(
      `${encodeURIComponent(agendaId)}/events/${encodeURIComponent(eventoId)}`,
      "DELETE"
    );
    // 410 = já estava cancelado. Junto com o 404, é o caso de "não está mais
    // lá", que é exatamente o estado que se queria alcançar.
    if (!resposta.ok && resposta.status !== 404 && resposta.status !== 410) {
      throw await erroDe(resposta, "Apagar evento");
    }
  },
};
