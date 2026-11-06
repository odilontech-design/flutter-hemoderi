import type { CobrancaCartao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isoDeData } from "@/lib/data";
import { statusDoEvento, statusDoPagamento, transicaoPermitida, type StatusCartao } from "@/lib/asaas-status";

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

async function chamar<T>(caminho: string, metodo: "GET" | "POST" | "DELETE", corpo?: unknown): Promise<T> {
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
    const falha = new Error(`Asaas ${resposta.status}: ${detalhe}`) as Error & { recusaAsaas?: string };
    // 400 = o Asaas recusou os dados (valor mínimo, documento inválido…): a
    // descrição vem em português e serve para quem está pagando entender.
    if (resposta.status === 400 && detalhe) falha.recusaAsaas = detalhe;
    throw falha;
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

  // Clicar duas vezes (ou voltar e clicar de novo) não abre uma segunda
  // cobrança dos mesmos atendimentos: reaproveita o link ainda válido. Duas
  // cobranças abertas é como o cliente acaba pagando em duplicidade.
  const chave = [...d.pedidoIds].sort().join(",");
  const recentes = await prisma.cobrancaCartao.findMany({
    where: {
      clinicaId: clinica.id,
      status: "PENDENTE",
      parcelas,
      valorTotalCentavos: total,
      linkPagamento: { not: null },
      criadaEm: { gte: new Date(Date.now() - 2 * 24 * 3600 * 1000) },
    },
    orderBy: { criadaEm: "desc" },
  });
  const igual = recentes.find((c) => [...c.pedidoIds].sort().join(",") === chave);
  if (igual?.linkPagamento) return { ok: true, link: igual.linkPagamento };

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
    const recusa = (erro as { recusaAsaas?: string }).recusaAsaas;
    if (recusa) return { ok: false, erro: `O Asaas não aceitou a cobrança: ${recusa.slice(0, 200)}` };
    return { ok: false, erro: "Não foi possível abrir o pagamento com cartão agora. Tente de novo em instantes ou fale com a central." };
  }
}

/** Produção ou sandbox, pelo endereço configurado. */
export function ambienteAsaas(): "produção" | "sandbox" {
  return base().includes("sandbox") ? "sandbox" : "produção";
}

/** A chave e o endereço estão certos? Uma consulta que não mexe em nada. */
export async function testarConexaoAsaas(): Promise<{ ok: true; ambiente: string } | { ok: false; erro: string }> {
  if (!asaasConfigurado()) return { ok: false, erro: "A chave ASAAS_API_KEY não está configurada na Vercel." };
  try {
    await chamar("/customers?limit=1", "GET");
    return { ok: true, ambiente: ambienteAsaas() };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Falhou." };
  }
}

/**
 * Põe a cobrança no estado novo, se a regra permitir. Pagar baixa os
 * atendimentos; pagar duas vezes pelos mesmos atendimentos marca a duplicidade
 * (dinheiro a devolver). Devolve se algo mudou.
 */
async function aplicarStatus(c: CobrancaCartao, novo: StatusCartao, origem: string, quando = new Date()): Promise<boolean> {
  if (!transicaoPermitida(c.status, novo)) return false;
  if (novo === "PAGA") {
    const pedidos = await prisma.pedido.findMany({
      where: { id: { in: c.pedidoIds } },
      select: { pixPagoEm: true, cartaoPagoEm: true },
    });
    const jaEstavamPagos = pedidos.length > 0 && pedidos.every((p) => p.pixPagoEm || p.cartaoPagoEm);
    await prisma.cobrancaCartao.update({
      where: { id: c.id },
      data: { status: "PAGA", pagoEm: quando, ultimoEvento: origem, duplicada: jaEstavamPagos },
    });
    await prisma.pedido.updateMany({ where: { id: { in: c.pedidoIds }, cartaoPagoEm: null }, data: { cartaoPagoEm: quando } });
    return true;
  }
  await prisma.cobrancaCartao.update({ where: { id: c.id }, data: { status: novo, ultimoEvento: origem } });
  return true;
}

async function acharCobranca(pagamento: { id?: string; installment?: string | null }): Promise<CobrancaCartao | null> {
  const ou = [
    ...(pagamento.id ? [{ asaasId: pagamento.id }] : []),
    ...(pagamento.installment ? [{ parcelamentoId: pagamento.installment }] : []),
  ];
  return ou.length ? prisma.cobrancaCartao.findFirst({ where: { OR: ou } }) : null;
}

/**
 * Aplica um aviso do webhook. A conta do Asaas pode ter cobranças que não são
 * do sistema, então aviso de cobrança desconhecida é ignorado sem registro. Os
 * que são nossos ficam em EventoAsaas: o mesmo evento reenviado não é aplicado
 * de novo e o resultado (ou o erro) aparece na tela de integrações.
 */
export async function aplicarEventoAsaas(corpo: {
  id?: string;
  event?: string;
  payment?: { id?: string; installment?: string | null };
}): Promise<{ resultado: string }> {
  if (!corpo.event || !corpo.payment) return { resultado: "ignorado" };
  const cobranca = await acharCobranca(corpo.payment);
  if (!cobranca) return { resultado: "ignorado" };

  let registro: { id: string } | null = null;
  try {
    registro = await prisma.eventoAsaas.create({
      data: { eventoId: corpo.id ?? null, tipo: corpo.event, asaasId: corpo.payment.id ?? null, cobrancaId: cobranca.id, resultado: "recebido" },
      select: { id: true },
    });
  } catch (erro) {
    if ((erro as { code?: string }).code === "P2002") return { resultado: "repetido" };
    throw erro;
  }

  let resultado = "sem efeito";
  let falha: string | null = null;
  try {
    const novo = statusDoEvento(corpo.event);
    if (novo && (await aplicarStatus(cobranca, novo, corpo.event))) resultado = novo;
  } catch (erro) {
    falha = erro instanceof Error ? erro.message.slice(0, 300) : "erro";
    resultado = "erro";
  }
  await prisma.eventoAsaas.update({ where: { id: registro.id }, data: { resultado, erro: falha } });
  if (falha) throw new Error(falha);
  return { resultado };
}

/** Baixa a cobrança e os atendimentos dela. Idempotente. (Usada pelas conferências e testes.) */
export async function confirmarPagamentoCartao(pagamento: { id?: string; installment?: string | null }, quando = new Date()): Promise<boolean> {
  const cobranca = await acharCobranca(pagamento);
  if (!cobranca) return false;
  await aplicarStatus(cobranca, "PAGA", "conferência", quando);
  return true;
}

/**
 * Pergunta ao Asaas como a cobrança está e acerta o sistema. É o que cobre um
 * webhook que não chegou (token errado, fora do ar na hora): a mesma regra
 * dos eventos.
 */
export async function conferirCobrancaNoAsaas(
  id: string
): Promise<{ ok: true; status: string; mudou: boolean } | { ok: false; erro: string }> {
  const cobranca = await prisma.cobrancaCartao.findUnique({ where: { id } });
  if (!cobranca) return { ok: false, erro: "Cobrança não encontrada." };
  if (!asaasConfigurado()) return { ok: false, erro: "A chave do Asaas não está configurada." };
  try {
    const pagamento = await chamar<{ status?: string; deleted?: boolean }>(`/payments/${cobranca.asaasId}`, "GET");
    const novo = statusDoPagamento(pagamento);
    const mudou = novo ? await aplicarStatus(cobranca, novo, "conferência") : false;
    return { ok: true, status: novo ?? cobranca.status, mudou };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Falhou." };
  }
}

/** Confere até `limite` cobranças em aberto, as mais antigas primeiro. */
export async function conferirEmAberto(limite = 30): Promise<{ conferidas: number; acertadas: number; falhas: string[] }> {
  const abertas = await prisma.cobrancaCartao.findMany({
    where: { status: { in: ["PENDENTE", "VENCIDA", "RECUSADA"] } },
    orderBy: { atualizadaEm: "asc" },
    take: limite,
    select: { id: true },
  });
  let acertadas = 0;
  const falhas: string[] = [];
  for (const { id } of abertas) {
    const r = await conferirCobrancaNoAsaas(id);
    if (!r.ok) falhas.push(r.erro);
    else if (r.mudou) acertadas++;
    // Sem mudança, ainda assim marca a conferência: a fila anda para as próximas.
    else await prisma.cobrancaCartao.update({ where: { id }, data: { atualizadaEm: new Date() } });
  }
  return { conferidas: abertas.length, acertadas, falhas };
}

/** Cancela no Asaas uma cobrança que ainda não foi paga, para o cliente não pagar um link velho. */
export async function cancelarCobrancaNoAsaas(id: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const cobranca = await prisma.cobrancaCartao.findUnique({ where: { id } });
  if (!cobranca) return { ok: false, erro: "Cobrança não encontrada." };
  if (!["PENDENTE", "VENCIDA", "RECUSADA"].includes(cobranca.status)) {
    return { ok: false, erro: "Só dá para cancelar uma cobrança que ainda não foi paga." };
  }
  if (!asaasConfigurado()) return { ok: false, erro: "A chave do Asaas não está configurada." };
  try {
    await chamar(cobranca.parcelamentoId ? `/installments/${cobranca.parcelamentoId}` : `/payments/${cobranca.asaasId}`, "DELETE");
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Falhou." };
  }
  await aplicarStatus(cobranca, "CANCELADA", "cancelada pela equipe");
  return { ok: true };
}
