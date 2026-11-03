import { prisma } from "@/lib/prisma";
import { isoDeData } from "@/lib/data";

/**
 * Cartão de crédito pelo Asaas (ata de 03/11): à vista ou parcelado em até
 * 12x, com os juros do parcelamento por conta do cliente. O Pix continua pelo
 * Bradesco, que não cobra tarifa.
 *
 * O sistema cria a cobrança e manda o cliente para a página de pagamento do
 * Asaas — o número do cartão nunca passa por aqui (o Asaas guarda o cartão,
 * dentro das regras de segurança dele). A confirmação chega pelo webhook
 * (/api/asaas/webhook).
 *
 * Variáveis (na Vercel, nunca no chat):
 *   ASAAS_API_KEY — a chave de API ("Remodere Dyon", gerada em 03/11).
 *   ASAAS_URL — opcional; padrão produção. Sandbox: https://api-sandbox.asaas.com/v3
 *   ASAAS_WEBHOOK_TOKEN — o token que o Asaas manda no cabeçalho do webhook.
 *   ASAAS_JUROS_PARCELAS — acréscimo total, em %, para 1 a 12 parcelas,
 *     separado por vírgula ("0,4.5,5.6,..."). Sem ela, não há acréscimo.
 */

const TEMPO_LIMITE_MS = 20_000;

export function asaasConfigurado(): boolean {
  return Boolean(process.env.ASAAS_API_KEY?.trim());
}

function base(): string {
  return (process.env.ASAAS_URL?.trim() || "https://api.asaas.com/v3").replace(/\/$/, "");
}

async function chamar<T>(caminho: string, metodo: "GET" | "POST", corpo?: unknown): Promise<T> {
  const resposta = await fetch(`${base()}${caminho}`, {
    method: metodo,
    headers: {
      access_token: process.env.ASAAS_API_KEY!.trim(),
      "Content-Type": "application/json",
      "User-Agent": "Hemoderi-Operacoes",
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  const texto = await resposta.text();
  if (!resposta.ok) {
    let detalhe = texto.slice(0, 300);
    try {
      const json = JSON.parse(texto) as { errors?: { description?: string }[] };
      detalhe = json.errors?.map((e) => e.description).filter(Boolean).join(" ") || detalhe;
    } catch {
      // resposta sem JSON: fica o texto
    }
    throw new Error(`Asaas ${resposta.status}: ${detalhe}`);
  }
  return (texto ? JSON.parse(texto) : {}) as T;
}

/** Acréscimo total (%) por número de parcelas, de ASAAS_JUROS_PARCELAS. */
export function tabelaDeJuros(texto = process.env.ASAAS_JUROS_PARCELAS ?? ""): number[] {
  const valores = texto.split(",").map((v) => Number(v.trim().replace(",", ".")));
  return Array.from({ length: 12 }, (_, i) => (Number.isFinite(valores[i]) && valores[i] > 0 ? valores[i] : 0));
}

/** O total que o cliente paga em `parcelas` vezes, com o acréscimo da tabela. */
export function totalComJuros(valorCentavos: number, parcelas: number, tabela: number[]): number {
  const n = Math.min(Math.max(Math.trunc(parcelas), 1), 12);
  return Math.round(valorCentavos * (1 + (tabela[n - 1] ?? 0) / 100));
}

async function clienteAsaas(c: { id: string; nome: string; documento: string; email: string | null; telefone: string | null }): Promise<string> {
  const documento = c.documento.replace(/\D/g, "");
  const busca = await chamar<{ data?: { id: string }[] }>(`/customers?cpfCnpj=${documento}`, "GET");
  if (busca.data?.[0]?.id) return busca.data[0].id;
  const criado = await chamar<{ id: string }>("/customers", "POST", {
    name: c.nome.slice(0, 100),
    cpfCnpj: documento,
    ...(c.email ? { email: c.email } : {}),
    ...(c.telefone ? { mobilePhone: c.telefone.replace(/\D/g, "") } : {}),
    externalReference: c.id,
  });
  return criado.id;
}

/** Cria a cobrança no Asaas e devolve o link da página de pagamento. */
export async function criarCobrancaCartao(d: {
  clinicaId: string;
  pedidoIds: string[];
  valorCentavos: number;
  parcelas: number;
  descricao: string;
}): Promise<{ ok: true; link: string } | { ok: false; erro: string }> {
  if (!asaasConfigurado()) return { ok: false, erro: "Pagamento com cartão ainda não está disponível." };
  const clinica = await prisma.clinica.findUnique({
    where: { id: d.clinicaId },
    select: { id: true, nome: true, cnpj: true, email: true, telefone: true, financeiroNome: true, financeiroDocumento: true, financeiroEmail: true, financeiroTelefone: true },
  });
  if (!clinica) return { ok: false, erro: "Clínica não encontrada." };
  const documento = (clinica.financeiroNome ? clinica.financeiroDocumento : clinica.cnpj) ?? "";
  if (documento.replace(/\D/g, "").length < 11) {
    return { ok: false, erro: "Para pagar com cartão, cadastre o CNPJ ou CPF de quem paga em Configurações." };
  }
  const parcelas = Math.min(Math.max(Math.trunc(d.parcelas), 1), 12);
  const total = totalComJuros(d.valorCentavos, parcelas, tabelaDeJuros());

  try {
    const cliente = await clienteAsaas({
      id: clinica.id,
      nome: clinica.financeiroNome || clinica.nome,
      documento,
      email: clinica.financeiroEmail || clinica.email,
      telefone: clinica.financeiroTelefone || clinica.telefone,
    });
    const pagamento = await chamar<{ id: string; invoiceUrl?: string; installment?: string | null }>("/payments", "POST", {
      customer: cliente,
      billingType: "CREDIT_CARD",
      dueDate: isoDeData(new Date(Date.now() + 3 * 24 * 3600 * 1000)),
      description: d.descricao.slice(0, 500),
      externalReference: d.pedidoIds.join(",").slice(0, 100),
      ...(parcelas > 1 ? { installmentCount: parcelas, totalValue: total / 100 } : { value: total / 100 }),
    });
    if (!pagamento.invoiceUrl) throw new Error("O Asaas não devolveu o link de pagamento.");
    await prisma.cobrancaCartao.create({
      data: {
        clinicaId: clinica.id,
        asaasId: pagamento.id,
        parcelamentoId: pagamento.installment ?? null,
        pedidoIds: d.pedidoIds,
        valorCentavos: d.valorCentavos,
        valorTotalCentavos: total,
        parcelas,
        linkPagamento: pagamento.invoiceUrl,
      },
    });
    return { ok: true, link: pagamento.invoiceUrl };
  } catch (erro) {
    console.error("asaas: criar cobrança", erro);
    return { ok: false, erro: "Não foi possível abrir o pagamento com cartão agora. Tente de novo em instantes ou fale com a central." };
  }
}

/** Eventos do Asaas que confirmam o pagamento (cartão aprovado). */
export const EVENTOS_DE_PAGAMENTO = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"];

/** Baixa a cobrança e os atendimentos dela. Idempotente. */
export async function confirmarPagamentoCartao(pagamento: { id?: string; installment?: string | null }, quando = new Date()): Promise<boolean> {
  const cobranca = await prisma.cobrancaCartao.findFirst({
    where: { OR: [...(pagamento.id ? [{ asaasId: pagamento.id }] : []), ...(pagamento.installment ? [{ parcelamentoId: pagamento.installment }] : [])] },
  });
  if (!cobranca) return false;
  if (cobranca.status !== "PAGA") {
    await prisma.cobrancaCartao.update({ where: { id: cobranca.id }, data: { status: "PAGA", pagoEm: quando } });
    await prisma.pedido.updateMany({ where: { id: { in: cobranca.pedidoIds }, cartaoPagoEm: null }, data: { cartaoPagoEm: quando } });
  }
  return true;
}
