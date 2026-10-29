/**
 * Integração Pix via API do Bradesco (substitui a do Santander, decisão do
 * André em 27/10: "problemas recorrentes com o atendimento gerencial").
 *
 * A API segue o padrão Pix do Banco Central (cobrança imediata `cob`) e é
 * autenticada por OAuth2 (client_credentials) sobre TLS mútuo: o certificado
 * digital A1 da empresa acompanha TODA chamada, a do token inclusive.
 *
 * ─── Fluxo ────────────────────────────────────────────────────────────────
 * 1. A fatura é fechada e o cupom, se houver, aplicado.
 * 2. O pós-venda gera a cobrança (gerarCobrancaPixFatura).
 *    → PUT /v2/cob/{txid}: o Bradesco devolve o copia-e-cola (pixCopiaECola).
 *    → Gravado em CobrancaPix.
 * 3. A equipe envia o código à clínica.
 * 4. O pagamento chega pelo webhook (/api/bradesco/webhook) ou pelo botão
 *    "Atualizar status" — nos dois casos o sistema CONFERE no Bradesco antes de
 *    baixar a fatura; o aviso sozinho não baixa nada.
 *
 * ─── Variáveis de ambiente (na Vercel) ─────────────────────────────────────
 *   BRADESCO_CLIENT_ID            credencial OAuth2 do aplicativo
 *   BRADESCO_CLIENT_SECRET        segredo OAuth2
 *   BRADESCO_CHAVE_PIX            chave Pix da Hemoderi (recebedora)
 *   BRADESCO_CERTIFICADO_PFX      o certificado A1 (.pfx/.p12) em Base64
 *   BRADESCO_CERTIFICADO_SENHA    a senha do .pfx
 *     — ou, no lugar das duas acima, o par em PEM:
 *   BRADESCO_CERTIFICADO          certificado (PEM, com \n escapado ou literal)
 *   BRADESCO_CHAVE_PRIVADA        chave privada (PEM)
 *   BRADESCO_AMBIENTE             "homologacao" (padrão) ou "producao"
 *   BRADESCO_WEBHOOK_SEGREDO      texto aleatório que vai na URL do webhook
 *   BRADESCO_URL_API / BRADESCO_URL_TOKEN   (opcionais) sobrescrevem os endereços
 *
 * Nada disso vai por chat, e-mail ou commit: só nas variáveis da Vercel.
 * Sem elas, toda tentativa é gravada como falha em SincronizacaoExterna e a
 * operação segue — o mesmo padrão do PipeDrive.
 */

import https from "node:https";
import tls from "node:tls";
import forge from "node-forge";
import { prisma } from "@/lib/prisma";

// ─── Configuração ─────────────────────────────────────────────────────────

const HOSTS = {
  homologacao: "https://qrpix-h.bradesco.com.br",
  producao: "https://qrpix.bradesco.com.br",
} as const;

type Ambiente = keyof typeof HOSTS;

function ambiente(): Ambiente {
  return process.env.BRADESCO_AMBIENTE === "producao" ? "producao" : "homologacao";
}

export function urlsDoBradesco(): { token: string; api: string } {
  const base = HOSTS[ambiente()];
  return {
    token: process.env.BRADESCO_URL_TOKEN?.trim() || `${base}/auth/server/oauth/token`,
    api: (process.env.BRADESCO_URL_API?.trim() || `${base}/v2`).replace(/\/$/, ""),
  };
}

/** PEM colado em variável de ambiente costuma perder as quebras de linha. */
function pem(valor: string): string {
  return valor.includes("\\n") ? valor.replace(/\\n/g, "\n") : valor;
}

/**
 * Abre o .pfx com o próprio Node e, se ele recusar ("Unsupported PKCS12 PFX
 * data"), converte para PEM em JavaScript puro. Os .pfx das autoridades
 * brasileiras costumam vir com cifras antigas (RC2-40, 3DES) que o OpenSSL 3
 * do Node não abre sem a opção "legacy" — e ligar essa opção no servidor é
 * pior do que ler o arquivo com uma biblioteca.
 */
export function pfxParaPem(pfx: Buffer, senha?: string): { cert: string; key: string } {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString("binary")));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha ?? "");

  const chaves = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];
  const certificados = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const chave = chaves[0]?.key;
  if (!chave) throw new Error("O .pfx não tem chave privada.");

  // O certificado da empresa é o que casa com a chave; os demais são a cadeia.
  const modulo = (chave as { n?: { toString(base: number): string } }).n?.toString(16);
  const todos = certificados.map((c) => c.cert).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const proprio = todos.find((c) => (c.publicKey as { n?: { toString(base: number): string } }).n?.toString(16) === modulo) ?? todos[0];
  if (!proprio) throw new Error("O .pfx não tem certificado.");
  const cadeia = todos.filter((c) => c !== proprio);

  return {
    cert: [proprio, ...cadeia].map((c) => forge.pki.certificateToPem(c)).join("\n"),
    key: forge.pki.privateKeyToPem(chave),
  };
}

let certificadoEmCache: { chave: string; valor: { cert: string; key: string } } | null = null;

/** O certificado do TLS mútuo, em qualquer dos dois formatos aceitos. */
export function certificadoDoBradesco(): { pfx: Buffer; passphrase?: string } | { cert: string; key: string } | null {
  const pfx = process.env.BRADESCO_CERTIFICADO_PFX?.trim();
  if (pfx) {
    const senha = process.env.BRADESCO_CERTIFICADO_SENHA;
    const bytes = Buffer.from(pfx, "base64");
    return { pfx: bytes, passphrase: senha };
  }
  const cert = process.env.BRADESCO_CERTIFICADO?.trim();
  const key = process.env.BRADESCO_CHAVE_PRIVADA?.trim();
  if (cert && key) return { cert: pem(cert), key: pem(key) };
  return null;
}

/**
 * O que vai de fato para o TLS: o par PEM. Para o .pfx, tenta o caminho do
 * Node e cai para a conversão quando ele recusa — o resultado fica em cache.
 */
export function certificadoParaTls(): { cert: string; key: string } | { pfx: Buffer; passphrase?: string } | null {
  const bruto = certificadoDoBradesco();
  if (!bruto || !("pfx" in bruto)) return bruto;
  const chave = `${bruto.pfx.length}:${bruto.passphrase ?? ""}`;
  if (certificadoEmCache?.chave === chave) return certificadoEmCache.valor;
  try {
    // Prova que o Node abre: o createSecureContext é o mesmo caminho do https.request.
    tls.createSecureContext({ pfx: bruto.pfx, passphrase: bruto.passphrase });
    return bruto;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    if (/mac verify failure|bad decrypt|wrong password/i.test(mensagem)) throw new Error("Senha do certificado (.pfx) incorreta.");
    const valor = pfxParaPem(bruto.pfx, bruto.passphrase);
    certificadoEmCache = { chave, valor };
    return valor;
  }
}

export function configuradoBradesco(): boolean {
  return Boolean(
    process.env.BRADESCO_CLIENT_ID &&
      process.env.BRADESCO_CLIENT_SECRET &&
      process.env.BRADESCO_CHAVE_PIX &&
      certificadoDoBradesco()
  );
}

// ─── HTTP com TLS mútuo ───────────────────────────────────────────────────

type RespostaHttp = { status: number; corpo: string };

/**
 * O `fetch` do Node não leva certificado de cliente; `https.request` leva.
 * Uma função só, para o certificado nunca ficar de fora de nenhuma chamada.
 */
function chamar(
  url: string,
  opcoes: { metodo: string; cabecalhos?: Record<string, string>; corpo?: string }
): Promise<RespostaHttp> {
  let certificado;
  try {
    certificado = certificadoParaTls();
  } catch (erro) {
    return Promise.reject(erro);
  }
  if (!certificado) return Promise.reject(new Error("Certificado digital do Bradesco não configurado."));
  return new Promise((resolver, rejeitar) => {
    const requisicao = https.request(
      url,
      {
        method: opcoes.metodo,
        headers: {
          ...opcoes.cabecalhos,
          ...(opcoes.corpo ? { "Content-Length": Buffer.byteLength(opcoes.corpo) } : {}),
        },
        timeout: 20_000,
        ...certificado,
      },
      (resposta) => {
        const partes: Buffer[] = [];
        resposta.on("data", (p: Buffer) => partes.push(p));
        resposta.on("end", () => resolver({ status: resposta.statusCode ?? 0, corpo: Buffer.concat(partes).toString("utf8") }));
      }
    );
    requisicao.on("timeout", () => requisicao.destroy(new Error("O Bradesco não respondeu a tempo.")));
    requisicao.on("error", rejeitar);
    if (opcoes.corpo) requisicao.write(opcoes.corpo);
    requisicao.end();
  });
}

// ─── OAuth2 ───────────────────────────────────────────────────────────────

let tokenCache: { token: string; expiraEm: number } | null = null;

/** Só para os testes. */
export function esquecerTokenDoBradesco(): void {
  tokenCache = null;
}

async function obterToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiraEm) return tokenCache.token;

  const basic = Buffer.from(`${process.env.BRADESCO_CLIENT_ID}:${process.env.BRADESCO_CLIENT_SECRET}`).toString("base64");
  const resposta = await chamar(urlsDoBradesco().token, {
    metodo: "POST",
    cabecalhos: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    corpo: "grant_type=client_credentials",
  });
  if (resposta.status < 200 || resposta.status >= 300) {
    throw new Error(`OAuth Bradesco HTTP ${resposta.status}: ${resposta.corpo.slice(0, 300)}`);
  }
  const json = JSON.parse(resposta.corpo) as { access_token: string; expires_in?: number };
  tokenCache = { token: json.access_token, expiraEm: Date.now() + ((json.expires_in ?? 300) - 30) * 1000 };
  return tokenCache.token;
}

async function api(caminho: string, metodo: string, corpo?: unknown): Promise<RespostaHttp> {
  const token = await obterToken();
  return chamar(`${urlsDoBradesco().api}${caminho}`, {
    metodo,
    cabecalhos: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    corpo: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

/** "Testar conexão": pede um token. Prova certificado, client_id e segredo de uma vez. */
export async function testarConexao(): Promise<{ ok: boolean; erro?: string }> {
  if (!configuradoBradesco()) return { ok: false, erro: "Faltam variáveis BRADESCO_* na Vercel (credenciais, chave Pix e certificado)." };
  try {
    tokenCache = null;
    await obterToken();
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
}

// ─── txid ─────────────────────────────────────────────────────────────────

/**
 * Gera um txid no formato do Banco Central: 26–35 caracteres alfanuméricos.
 * Formato: HEM + timestamp base36 + aleatórios.
 */
export function gerarTxid(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const falta = Math.max(26 - 3 - ts.length, 15);
  const rand = Array.from({ length: falta }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]).join("");
  return `HEM${ts}${rand}`.slice(0, 35);
}

/** Quanto tempo a cobrança vale: até o vencimento e mais 30 dias (em segundos). */
export function expiracaoEmSegundos(vencimento: Date, agora: Date = new Date()): number {
  const fimDoVencimento = Date.UTC(vencimento.getUTCFullYear(), vencimento.getUTCMonth(), vencimento.getUTCDate(), 23, 59, 59);
  const segundos = Math.round((fimDoVencimento - agora.getTime()) / 1000) + 30 * 24 * 3600;
  return Math.max(3600, segundos);
}

// ─── Criar cobrança ───────────────────────────────────────────────────────

type DadosCobranca = {
  /** A cobrança é de uma fatura OU de um agendamento (pedido + grupo da visita). */
  faturaId?: string;
  pedidoId?: string;
  grupoId?: string | null;
  valorCentavos: number;
  vencimento: Date;
  descricao: string;
  devedorNome: string;
  devedorCnpj?: string;
};

async function registrarSincronizacao(
  entidadeId: string,
  acao: string,
  sucesso: boolean,
  referencia?: string,
  erro?: string,
  entidade = "Fatura"
): Promise<void> {
  await prisma.sincronizacaoExterna.create({
    data: { sistema: "BRADESCO", entidade, entidadeId, acao, sucesso, referencia, erro: erro?.slice(0, 500) },
  });
}

const alvoDaCobranca = (d: { faturaId?: string; pedidoId?: string }) => d.faturaId ?? d.pedidoId ?? "—";
const entidadeDaCobranca = (d: { faturaId?: string }) => (d.faturaId ? "Fatura" : "Pedido");

/** Cria a cobrança Pix (cob) no Bradesco e grava em CobrancaPix. */
export async function criarCobrancaPix(dados: DadosCobranca): Promise<{
  ok: boolean;
  txid?: string;
  qrCode?: string;
  copiaECola?: string;
  erro?: string;
}> {
  if (!configuradoBradesco()) {
    await registrarSincronizacao(alvoDaCobranca(dados), "criar-cobranca", false, undefined, "Integração Bradesco não configurada.", entidadeDaCobranca(dados));
    return { ok: false, erro: "Integração Bradesco não configurada." };
  }

  const txid = gerarTxid();
  const chavePix = process.env.BRADESCO_CHAVE_PIX!;
  const documento = dados.devedorCnpj?.replace(/\D/g, "");

  try {
    const resposta = await api(`/cob/${txid}`, "PUT", {
      calendario: { expiracao: expiracaoEmSegundos(dados.vencimento) },
      ...(documento && (documento.length === 14 || documento.length === 11)
        ? { devedor: { [documento.length === 14 ? "cnpj" : "cpf"]: documento, nome: dados.devedorNome.slice(0, 200) } }
        : {}),
      valor: { original: (dados.valorCentavos / 100).toFixed(2) },
      chave: chavePix,
      solicitacaoPagador: dados.descricao.slice(0, 140),
    });
    if (resposta.status < 200 || resposta.status >= 300) {
      throw new Error(`HTTP ${resposta.status}: ${resposta.corpo.slice(0, 300)}`);
    }

    const json = JSON.parse(resposta.corpo) as { pixCopiaECola?: string; location?: string };
    const copiaECola = json.pixCopiaECola;

    await prisma.cobrancaPix.create({
      data: {
        faturaId: dados.faturaId ?? null,
        pedidoId: dados.pedidoId ?? null,
        grupoId: dados.grupoId ?? null,
        txid,
        valorCentavos: dados.valorCentavos,
        chavePix,
        vencimento: dados.vencimento,
        qrCode: copiaECola,
        copiaECola,
      },
    });
    await registrarSincronizacao(alvoDaCobranca(dados), "criar-cobranca", true, txid, undefined, entidadeDaCobranca(dados));
    return { ok: true, txid, copiaECola };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await registrarSincronizacao(alvoDaCobranca(dados), "criar-cobranca", false, undefined, mensagem, entidadeDaCobranca(dados));
    return { ok: false, erro: mensagem };
  }
}

// ─── Consultar status ─────────────────────────────────────────────────────

/**
 * Consulta a cobrança no Bradesco e, se foi paga, baixa a cobrança e a fatura.
 * É também o que o webhook chama: o aviso do banco só diz "olhe o txid X" —
 * quem decide que está pago é a consulta.
 */
export async function consultarCobranca(txid: string): Promise<{
  ok: boolean;
  status?: string;
  pago?: boolean;
  erro?: string;
}> {
  if (!configuradoBradesco()) return { ok: false, erro: "Integração Bradesco não configurada." };

  try {
    const resposta = await api(`/cob/${txid}`, "GET");
    if (resposta.status < 200 || resposta.status >= 300) throw new Error(`HTTP ${resposta.status}: ${resposta.corpo.slice(0, 200)}`);

    const json = JSON.parse(resposta.corpo) as { status: string; pix?: Array<{ endToEndId: string; horario: string }> };
    const pagamento = json.status === "CONCLUIDA" ? json.pix?.[0] : undefined;

    if (pagamento) {
      const pagoEm = new Date(pagamento.horario);
      const cobranca = await prisma.cobrancaPix.findUnique({
        where: { txid },
        select: { id: true, faturaId: true, pedidoId: true, grupoId: true, status: true },
      });
      if (cobranca && cobranca.status !== "CONCLUIDA") {
        await prisma.cobrancaPix.update({ where: { txid }, data: { status: "CONCLUIDA", endToEndId: pagamento.endToEndId, pagoEm } });
        if (cobranca.faturaId) {
          await prisma.fatura.update({ where: { id: cobranca.faturaId }, data: { status: "PAGA", pagaEm: pagoEm } });
        }
        // Pix do agendamento: todos os serviços da visita ficam como pagos.
        if (cobranca.pedidoId) {
          await prisma.pedido.updateMany({
            where: cobranca.grupoId ? { grupoId: cobranca.grupoId } : { id: cobranca.pedidoId },
            data: { pixPagoEm: pagoEm },
          });
        }
        await registrarSincronizacao(cobranca.id, "pagamento-confirmado", true, pagamento.endToEndId, undefined, "CobrancaPix");
      }
    }
    return { ok: true, status: json.status, pago: Boolean(pagamento) };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
}

// ─── Webhook ──────────────────────────────────────────────────────────────

/**
 * Cadastra no Bradesco o endereço que recebe o aviso de pagamento (PUT
 * /webhook/{chave}). O segredo vai na própria URL: o Bradesco não assina o
 * aviso, e a conferência de cada txid é feita por consulta.
 */
export async function registrarWebhook(urlPublica: string): Promise<{ ok: boolean; erro?: string }> {
  if (!configuradoBradesco()) return { ok: false, erro: "Integração Bradesco não configurada." };
  const segredo = process.env.BRADESCO_WEBHOOK_SEGREDO?.trim();
  if (!segredo) return { ok: false, erro: "Defina BRADESCO_WEBHOOK_SEGREDO na Vercel antes de registrar o aviso." };
  try {
    const url = `${urlPublica.replace(/\/$/, "")}/api/bradesco/webhook?segredo=${encodeURIComponent(segredo)}`;
    const resposta = await api(`/webhook/${encodeURIComponent(process.env.BRADESCO_CHAVE_PIX!)}`, "PUT", { webhookUrl: url });
    if (resposta.status < 200 || resposta.status >= 300) throw new Error(`HTTP ${resposta.status}: ${resposta.corpo.slice(0, 200)}`);
    await registrarSincronizacao("webhook", "registrar-webhook", true, undefined, undefined, "Integracao");
    return { ok: true };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await registrarSincronizacao("webhook", "registrar-webhook", false, undefined, mensagem, "Integracao");
    return { ok: false, erro: mensagem };
  }
}
