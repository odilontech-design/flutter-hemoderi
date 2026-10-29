"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirInterno, registrarAuditoria } from "@/lib/sessao";
import { perfilPermite } from "@/lib/papeis";
import { criarCobrancaPix, consultarCobranca, registrarWebhook, testarConexao } from "@/lib/integracoes/bradesco-pix";
import { exigirAdministradorTecnico, exigirClinica } from "@/lib/sessao";
import QRCode from "qrcode";
import type { Resultado } from "./pedidos";

/**
 * Gera uma cobrança Pix para uma fatura.
 *
 * Chamada pelo pós-venda (Stephanie) na esteira do faturamento, depois que
 * a fatura está fechada e o cupom (se houver) já foi aplicado.
 */
export async function gerarCobrancaPixFatura(faturaId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "POS_VENDA")) {
    return { ok: false, erro: "Só o pós-venda ou o responsável gera cobrança Pix." };
  }

  const fatura = await prisma.fatura.findUnique({
    where: { id: faturaId },
    include: {
      clinica: { select: { nome: true, cnpj: true } },
      cobrancas: { where: { status: "ATIVA" }, select: { id: true } },
    },
  });
  if (!fatura) return { ok: false, erro: "Fatura não encontrada." };
  if (fatura.status !== "ABERTA") return { ok: false, erro: "Só se gera cobrança para fatura aberta." };
  if (fatura.cobrancas.length > 0) {
    return { ok: false, erro: "Já existe uma cobrança ativa para esta fatura. Cancele-a antes de gerar outra." };
  }

  const valorLiquido = fatura.valorCentavos - fatura.descontoCentavos;
  if (valorLiquido <= 0) {
    return { ok: false, erro: "O valor líquido da fatura é zero — não há o que cobrar." };
  }

  const resultado = await criarCobrancaPix({
    faturaId: fatura.id,
    valorCentavos: valorLiquido,
    vencimento: fatura.vencimento,
    descricao: `Hemoderi - Fatura ${fatura.numero}`,
    devedorNome: fatura.clinica.nome,
    devedorCnpj: fatura.clinica.cnpj ?? undefined,
  });

  if (!resultado.ok) {
    return { ok: false, erro: resultado.erro ?? "Erro ao gerar cobrança no Bradesco." };
  }

  await registrarAuditoria(
    sessao.usuarioId,
    "Fatura",
    faturaId,
    "gerar-pix",
    `txid: ${resultado.txid}`
  );

  revalidatePath("/painel/financeiro");
  return { ok: true };
}

/**
 * Consulta o status de uma cobrança Pix e atualiza o banco.
 */
export async function consultarCobrancaPix(cobrancaId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "POS_VENDA")) {
    return { ok: false, erro: "Só o pós-venda ou o responsável consulta cobranças." };
  }

  const cobranca = await prisma.cobrancaPix.findUnique({
    where: { id: cobrancaId },
    select: { txid: true },
  });
  if (!cobranca) return { ok: false, erro: "Cobrança não encontrada." };

  const resultado = await consultarCobranca(cobranca.txid);

  if (!resultado.ok) {
    return { ok: false, erro: resultado.erro ?? "Erro ao consultar o Bradesco." };
  }

  await registrarAuditoria(
    sessao.usuarioId,
    "CobrancaPix",
    cobrancaId,
    "consultar-status",
    `status: ${resultado.status}`
  );

  revalidatePath("/painel/financeiro");

  if (resultado.pago) {
    return { ok: true };
  }
  return { ok: true };
}

/**
 * Cancela uma cobrança Pix ativa.
 */
export async function cancelarCobrancaPix(cobrancaId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "POS_VENDA")) {
    return { ok: false, erro: "Só o pós-venda ou o responsável cancela cobranças." };
  }

  const cobranca = await prisma.cobrancaPix.findUnique({
    where: { id: cobrancaId },
    select: { id: true, status: true },
  });
  if (!cobranca) return { ok: false, erro: "Cobrança não encontrada." };
  if (cobranca.status !== "ATIVA") {
    return { ok: false, erro: "Só se cancela cobrança com status ativa." };
  }

  await prisma.cobrancaPix.update({
    where: { id: cobrancaId },
    data: { status: "CANCELADA" },
  });

  await registrarAuditoria(sessao.usuarioId, "CobrancaPix", cobrancaId, "cancelar");
  revalidatePath("/painel/financeiro");
  return { ok: true };
}

/** Tela Integrações: o certificado e as credenciais estão certos? */
export async function testarConexaoBradesco(): Promise<Resultado> {
  await exigirAdministradorTecnico();
  const r = await testarConexao();
  return r.ok ? { ok: true, avisos: ["Conexão com o Bradesco funcionando (token obtido)."] } : { ok: false, erro: r.erro ?? "Falhou." };
}

/** Cadastra no Bradesco o endereço que avisa quando um Pix é pago. */
export async function registrarAvisoDePagamentoBradesco(): Promise<Resultado> {
  await exigirAdministradorTecnico();
  const base = process.env.NEXTAUTH_URL?.trim() || "https://app.hemoderi.com.br";
  const r = await registrarWebhook(base);
  return r.ok ? { ok: true, avisos: ["Aviso de pagamento cadastrado no Bradesco."] } : { ok: false, erro: r.erro ?? "Falhou." };
}

export type PixDoAgendamento = {
  ok: boolean;
  erro?: string;
  valorCentavos?: number;
  copiaECola?: string;
  /** O QR Code já como imagem (data URL). */
  imagem?: string;
  pago?: boolean;
  pagoEm?: string;
};

const STATUS_QUE_PAGAM = ["CONFIRMADO", "ALOCADO", "REALIZADO"];

/**
 * O Pix do agendamento no portal da clínica (pedido de 29/10): quem escolheu
 * Pix como forma de pagamento paga pelo QR Code, sem esperar a fatura.
 *
 * Uma cobrança por VISITA (todos os serviços juntos). `gerar: false` só
 * consulta — é o que o "já paguei" e a verificação automática chamam. Reusa a
 * cobrança ativa quando o valor não mudou, para a clínica ver sempre o mesmo
 * código; mudou o valor, gera outra.
 */
export async function pixDoAgendamento(pedidoId: string, gerar: boolean): Promise<PixDoAgendamento> {
  const sessao = await exigirClinica();

  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId, clinicaId: sessao.clinicaId },
    select: { id: true, grupoId: true, clinica: { select: { nome: true, cnpj: true } } },
  });
  if (!pedido) return { ok: false, erro: "Agendamento não encontrado." };

  const membros = await prisma.pedido.findMany({
    where: { clinicaId: sessao.clinicaId, ...(pedido.grupoId ? { grupoId: pedido.grupoId } : { id: pedido.id }) },
    select: { id: true, status: true, formaPagamento: true, valorServicoCentavos: true, pixPagoEm: true },
  });
  const ativos = membros.filter((m) => m.status !== "CANCELADO");
  if (ativos.length === 0) return { ok: false, erro: "Este agendamento foi cancelado." };
  if (ativos.some((m) => m.formaPagamento !== "Pix")) return { ok: false, erro: "A forma de pagamento deste agendamento não é Pix." };

  const pagoEm = ativos.find((m) => m.pixPagoEm)?.pixPagoEm;
  if (pagoEm) return { ok: true, pago: true, pagoEm: pagoEm.toISOString() };

  if (!ativos.every((m) => STATUS_QUE_PAGAM.includes(m.status))) {
    return { ok: false, erro: "O Pix fica disponível depois que a central confirmar o agendamento." };
  }
  const valorCentavos = ativos.reduce((soma, m) => soma + m.valorServicoCentavos, 0);
  if (valorCentavos <= 0) return { ok: false, erro: "O valor ainda está sob consulta: a central informa o valor antes do pagamento." };

  const primeiro = ativos[0];
  const filtro = { pedidoId: primeiro.id, status: "ATIVA" as const };
  let cobranca = await prisma.cobrancaPix.findFirst({ where: filtro, orderBy: { criadaEm: "desc" } });

  // Já foi paga, ou o valor mudou: confere antes de decidir.
  if (cobranca) {
    const consulta = await consultarCobranca(cobranca.txid);
    if (consulta.ok && consulta.pago) {
      const agora = await prisma.pedido.findFirst({ where: { id: primeiro.id }, select: { pixPagoEm: true } });
      return { ok: true, pago: true, pagoEm: (agora?.pixPagoEm ?? new Date()).toISOString() };
    }
    if (cobranca.valorCentavos !== valorCentavos) {
      await prisma.cobrancaPix.update({ where: { id: cobranca.id }, data: { status: "CANCELADA" } });
      cobranca = null;
    }
  }

  if (!cobranca) {
    if (!gerar) return { ok: true, pago: false, valorCentavos };
    const criada = await criarCobrancaPix({
      pedidoId: primeiro.id,
      grupoId: pedido.grupoId,
      valorCentavos,
      vencimento: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      descricao: `Hemoderi - Agendamento ${pedido.clinica.nome}`,
      devedorNome: pedido.clinica.nome,
      devedorCnpj: pedido.clinica.cnpj ?? undefined,
    });
    if (!criada.ok || !criada.copiaECola) {
      return { ok: false, erro: "Não foi possível gerar o Pix agora. Tente de novo em instantes ou fale com a central." };
    }
    return {
      ok: true,
      pago: false,
      valorCentavos,
      copiaECola: criada.copiaECola,
      imagem: await QRCode.toDataURL(criada.copiaECola, { margin: 1, width: 280 }),
    };
  }

  const copiaECola = cobranca.copiaECola ?? cobranca.qrCode;
  if (!copiaECola) return { ok: false, erro: "O código Pix desta cobrança não está disponível. Fale com a central." };
  return {
    ok: true,
    pago: false,
    valorCentavos,
    copiaECola,
    imagem: await QRCode.toDataURL(copiaECola, { margin: 1, width: 280 }),
  };
}
