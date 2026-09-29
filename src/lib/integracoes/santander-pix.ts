/**
 * Integração Pix via API do Santander.
 *
 * Decisão do André: todas as cobranças da Hemoderi serão via Pix pelo
 * Santander. A API segue o padrão BACEN Pix Cobrança com Vencimento (cobv),
 * autenticada por OAuth2 + mTLS (certificado digital).
 *
 * ─── Fluxo ────────────────────────────────────────────────────────────────
 * 1. A fatura é fechada (fecharFatura).
 * 2. Cupom é aplicado se houver (aplicarCupomNaFatura).
 * 3. O pós-venda gera a cobrança Pix (gerarCobrancaPix).
 *    → Chama a API do Santander, que devolve txid + QR Code + copia-e-cola.
 *    → Grava em CobrancaPix.
 * 4. A equipe envia o QR/link para a clínica (WhatsApp).
 * 5. Webhook ou consulta confirma o pagamento → atualiza status.
 *
 * ─── Configuração necessária (variáveis de ambiente) ──────────────────────
 *   SANTANDER_CLIENT_ID       — Credencial OAuth2 da aplicação
 *   SANTANDER_CLIENT_SECRET   — Segredo OAuth2
 *   SANTANDER_CERTIFICADO     — Caminho ou conteúdo do certificado .pem (mTLS)
 *   SANTANDER_CHAVE_PRIVADA   — Caminho ou conteúdo da chave privada .pem
 *   SANTANDER_CHAVE_PIX       — Chave Pix da Hemoderi (recebedora)
 *   SANTANDER_AMBIENTE        — "sandbox" ou "producao" (default: sandbox)
 *
 * A integração está pronta para funcionar assim que as credenciais estiverem
 * no ambiente. Sem elas, toda tentativa é gravada como falha em
 * SincronizacaoExterna e a operação segue — o mesmo padrão do PipeDrive.
 */

import { prisma } from "@/lib/prisma";

// ─── Configuração ─────────────────────────────────────────────────────────

const URLS = {
  sandbox: {
    auth: "https://trust-sandbox.api.santander.com.br/auth/oauth/v2/token",
    pix: "https://trust-sandbox.api.santander.com.br/collection_bill_management/v2",
  },
  producao: {
    auth: "https://trust.api.santander.com.br/auth/oauth/v2/token",
    pix: "https://trust.api.santander.com.br/collection_bill_management/v2",
  },
} as const;

type Ambiente = keyof typeof URLS;

function ambiente(): Ambiente {
  const env = process.env.SANTANDER_AMBIENTE ?? "sandbox";
  return env === "producao" ? "producao" : "sandbox";
}

export function configuradoSantander(): boolean {
  return Boolean(
    process.env.SANTANDER_CLIENT_ID &&
    process.env.SANTANDER_CLIENT_SECRET &&
    process.env.SANTANDER_CHAVE_PIX
  );
}

function urls() {
  return URLS[ambiente()];
}

// ─── OAuth2 ───────────────────────────────────────────────────────────────

let tokenCache: { token: string; expiraEm: number } | null = null;

async function obterToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiraEm) return tokenCache.token;

  const resposta = await fetch(urls().auth, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SANTANDER_CLIENT_ID!,
      client_secret: process.env.SANTANDER_CLIENT_SECRET!,
    }),
  });

  if (!resposta.ok) {
    throw new Error(`OAuth Santander HTTP ${resposta.status}: ${await resposta.text()}`);
  }

  const json = (await resposta.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: json.access_token,
    expiraEm: Date.now() + (json.expires_in - 60) * 1000,
  };

  return tokenCache.token;
}

// ─── Gerador de txid ──────────────────────────────────────────────────────

/**
 * Gera um txid no formato BACEN: 26–35 caracteres alfanuméricos.
 * Formato: HEM + timestamp base36 + random chars = ~30 chars.
 */
export function gerarTxid(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const falta = Math.max(26 - 3 - ts.length, 15);
  const rand = Array.from({ length: falta }, () =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]
  ).join("");
  return `HEM${ts}${rand}`.slice(0, 35);
}

// ─── Criar cobrança ───────────────────────────────────────────────────────

type DadosCobranca = {
  faturaId: string;
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
  erro?: string
): Promise<void> {
  await prisma.sincronizacaoExterna.create({
    data: {
      sistema: "SANTANDER",
      entidade: "Fatura",
      entidadeId,
      acao,
      sucesso,
      referencia,
      erro,
    },
  });
}

/**
 * Cria uma cobrança Pix (cobv) via API do Santander.
 *
 * Retorna os dados do QR Code ou grava a falha para reprocessamento.
 */
export async function criarCobrancaPix(dados: DadosCobranca): Promise<{
  ok: boolean;
  txid?: string;
  qrCode?: string;
  copiaECola?: string;
  erro?: string;
}> {
  if (!configuradoSantander()) {
    await registrarSincronizacao(
      dados.faturaId,
      "criar-cobranca",
      false,
      undefined,
      "Integração Santander não configurada."
    );
    return { ok: false, erro: "Integração Santander não configurada." };
  }

  const txid = gerarTxid();
  const chavePix = process.env.SANTANDER_CHAVE_PIX!;
  const vencimento = dados.vencimento.toISOString().split("T")[0]; // YYYY-MM-DD

  try {
    const token = await obterToken();

    // Criar cobrança com vencimento (COBV)
    const resposta = await fetch(`${urls().pix}/cobv/${txid}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        calendario: {
          dataDeVencimento: vencimento,
          validadeAposVencimento: 30, // dias após vencimento que ainda aceita pagamento
        },
        devedor: {
          cnpj: dados.devedorCnpj ?? undefined,
          nome: dados.devedorNome,
        },
        valor: {
          original: (dados.valorCentavos / 100).toFixed(2),
        },
        chave: chavePix,
        solicitacaoPagador: dados.descricao.slice(0, 140),
      }),
    });

    if (!resposta.ok) {
      const corpo = await resposta.text();
      throw new Error(`HTTP ${resposta.status}: ${corpo.slice(0, 300)}`);
    }

    const json = (await resposta.json()) as {
      txid: string;
      pixCopiaECola?: string;
      location?: string;
    };

    // Buscar o QR Code
    let qrCode: string | undefined;
    let copiaECola = json.pixCopiaECola;

    if (json.location) {
      try {
        const qrResp = await fetch(`${json.location}/qrcode`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (qrResp.ok) {
          const qrJson = (await qrResp.json()) as { qrcode?: string; imagemQrcode?: string };
          qrCode = qrJson.imagemQrcode;
          copiaECola = copiaECola ?? qrJson.qrcode;
        }
      } catch {
        // QR Code é bônus — a cobrança existe sem ele.
      }
    }

    // Gravar no banco
    await prisma.cobrancaPix.create({
      data: {
        faturaId: dados.faturaId,
        txid,
        valorCentavos: dados.valorCentavos,
        chavePix,
        vencimento: dados.vencimento,
        qrCode: copiaECola,
        copiaECola,
        imagemQrUrl: qrCode,
      },
    });

    await registrarSincronizacao(dados.faturaId, "criar-cobranca", true, txid);

    return { ok: true, txid, qrCode, copiaECola };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await registrarSincronizacao(dados.faturaId, "criar-cobranca", false, undefined, mensagem);

    return { ok: false, erro: mensagem };
  }
}

// ─── Consultar status ─────────────────────────────────────────────────────

/**
 * Consulta o status de uma cobrança no Santander e atualiza o banco.
 */
export async function consultarCobranca(txid: string): Promise<{
  ok: boolean;
  status?: string;
  pago?: boolean;
  erro?: string;
}> {
  if (!configuradoSantander()) {
    return { ok: false, erro: "Integração Santander não configurada." };
  }

  try {
    const token = await obterToken();
    const resposta = await fetch(`${urls().pix}/cobv/${txid}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    const json = (await resposta.json()) as {
      status: string;
      pix?: Array<{ endToEndId: string; horario: string }>;
    };

    const pago = json.status === "CONCLUIDA" && json.pix && json.pix.length > 0;

    if (pago) {
      const pagamento = json.pix![0];
      await prisma.cobrancaPix.update({
        where: { txid },
        data: {
          status: "CONCLUIDA",
          endToEndId: pagamento.endToEndId,
          pagoEm: new Date(pagamento.horario),
        },
      });

      // Também baixa a fatura automaticamente
      const cobranca = await prisma.cobrancaPix.findUnique({
        where: { txid },
        select: { faturaId: true },
      });
      if (cobranca) {
        await prisma.fatura.update({
          where: { id: cobranca.faturaId },
          data: { status: "PAGA", pagaEm: new Date(pagamento.horario) },
        });
      }
    }

    return { ok: true, status: json.status, pago };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
}
