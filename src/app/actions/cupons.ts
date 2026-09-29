"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirResponsavel, registrarAuditoria } from "@/lib/sessao";
import { normalizarCodigo, validarCupom } from "@/lib/cupom";
import type { Resultado } from "./pedidos";

// ─── CRUD de cupom (responsável) ──────────────────────────────────────────

export async function salvarCupom(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await exigirResponsavel();

  const id = String(dados.get("id") ?? "").trim();
  const codigo = normalizarCodigo(String(dados.get("codigo") ?? ""));
  const descricao = String(dados.get("descricao") ?? "").trim() || null;
  const tipo = String(dados.get("tipo") ?? "PERCENTUAL") as "PERCENTUAL" | "VALOR_FIXO";
  const valorTexto = String(dados.get("valor") ?? "").replace(",", ".");

  if (!codigo) return { ok: false, erro: "Informe o código do cupom." };
  if (!/^[A-Z0-9]+$/.test(codigo)) return { ok: false, erro: "O código deve conter apenas letras e números, sem espaço." };

  const valor = Number(valorTexto);
  if (!valor || valor <= 0) return { ok: false, erro: "O valor do desconto deve ser maior que zero." };

  if (tipo === "PERCENTUAL" && valor > 100) {
    return { ok: false, erro: "O percentual não pode passar de 100%." };
  }
  // VALOR_FIXO: o formulário manda em reais, converte para centavos.
  const valorFinal = tipo === "VALOR_FIXO" ? Math.round(valor * 100) : valor;

  const servicoIdsRaw = String(dados.get("servicoIds") ?? "").trim();
  const servicoIds = servicoIdsRaw ? servicoIdsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const validoAteRaw = String(dados.get("validoAte") ?? "").trim();
  const validoAte = validoAteRaw ? new Date(validoAteRaw + "T23:59:59.000Z") : null;

  const limiteUsosRaw = String(dados.get("limiteUsos") ?? "").trim();
  const limiteUsos = limiteUsosRaw ? Number(limiteUsosRaw) : null;
  if (limiteUsos !== null && (limiteUsos < 1 || !Number.isInteger(limiteUsos))) {
    return { ok: false, erro: "O limite de usos deve ser um número inteiro maior que zero." };
  }

  const comum = { codigo, descricao, tipo, valor: valorFinal, servicoIds, validoAte, limiteUsos };

  try {
    if (id) {
      await prisma.cupomDesconto.update({ where: { id }, data: comum });
    } else {
      await prisma.cupomDesconto.create({ data: comum });
    }
  } catch {
    return { ok: false, erro: "Já existe um cupom com esse código." };
  }

  await registrarAuditoria(sessao.usuarioId, "CupomDesconto", id || codigo, id ? "editar" : "criar");
  revalidatePath("/painel/cupons");
  return { ok: true };
}

export async function alternarCupom(id: string, ativo: boolean): Promise<Resultado> {
  const sessao = await exigirResponsavel();
  await prisma.cupomDesconto.update({ where: { id }, data: { ativo } });
  await registrarAuditoria(sessao.usuarioId, "CupomDesconto", id, ativo ? "ativar" : "desativar");
  revalidatePath("/painel/cupons");
  return { ok: true };
}

export async function excluirCupom(id: string): Promise<Resultado> {
  const sessao = await exigirResponsavel();
  const usos = await prisma.aplicacaoCupom.count({ where: { cupomId: id } });
  if (usos > 0) {
    return { ok: false, erro: `Não é possível excluir: este cupom já foi usado ${usos} vez(es). Desative-o em vez de excluir.` };
  }
  await prisma.cupomDesconto.delete({ where: { id } });
  await registrarAuditoria(sessao.usuarioId, "CupomDesconto", id, "excluir");
  revalidatePath("/painel/cupons");
  return { ok: true };
}

// ─── Aplicação de cupom numa fatura (pós-venda / responsável) ─────────────

export async function aplicarCupomNaFatura(faturaId: string, codigoDigitado: string): Promise<Resultado> {
  const sessao = await exigirResponsavel();
  const codigo = normalizarCodigo(codigoDigitado);
  if (!codigo) return { ok: false, erro: "Informe o código do cupom." };

  const cupom = await prisma.cupomDesconto.findUnique({ where: { codigo } });
  if (!cupom) return { ok: false, erro: "Cupom não encontrado." };

  const fatura = await prisma.fatura.findUnique({
    where: { id: faturaId },
    include: { pedidos: { select: { servicoId: true } } },
  });
  if (!fatura) return { ok: false, erro: "Fatura não encontrada." };
  if (fatura.status !== "ABERTA") return { ok: false, erro: "Só é possível aplicar cupom em fatura aberta." };

  const servicoIdsDaFatura = [...new Set(fatura.pedidos.map((p) => p.servicoId))];

  const resultado = validarCupom(cupom, {
    valorCentavos: fatura.valorCentavos,
    descontoCentavos: fatura.descontoCentavos,
    servicoIds: servicoIdsDaFatura,
  });

  if (!resultado.valido) return { ok: false, erro: resultado.motivo };

  await prisma.$transaction(async (tx) => {
    await tx.aplicacaoCupom.create({
      data: {
        cupomId: cupom.id,
        faturaId: fatura.id,
        descontoCentavos: resultado.descontoCentavos,
        aplicadoPorId: sessao.usuarioId,
      },
    });
    await tx.fatura.update({
      where: { id: fatura.id },
      data: { descontoCentavos: { increment: resultado.descontoCentavos } },
    });
    await tx.cupomDesconto.update({
      where: { id: cupom.id },
      data: { usosRealizados: { increment: 1 } },
    });
  });

  await registrarAuditoria(
    sessao.usuarioId,
    "Fatura",
    fatura.id,
    "aplicar-cupom",
    `Cupom ${cupom.codigo}: -R$ ${(resultado.descontoCentavos / 100).toFixed(2)}`
  );

  revalidatePath("/painel/financeiro");
  revalidatePath("/painel/cupons");
  return { ok: true };
}
