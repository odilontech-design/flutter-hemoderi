"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirInterno, registrarAuditoria } from "@/lib/sessao";
import { slugLivre } from "./cadastros";
import type { Resultado } from "./pedidos";

/**
 * Vínculos entre pessoas (doutores) e clínicas, para corrigir o que veio
 * torto do CRM (ata de 20/10: a Dra. Ana Laura e a Dra. Maristela Lobo
 * apareceram como da Mandic). Três correções: tirar a pessoa da clínica,
 * mover para outra clínica, ou separar numa clínica própria (pré-cadastro com
 * o nome dela) — o caso de quem atende por conta própria.
 */

function atualizar(...clinicaIds: string[]) {
  for (const id of clinicaIds) revalidatePath(`/painel/clinicas/${id}`);
  revalidatePath("/painel/clinicas");
}

export async function buscarClinicasParaVinculo(termo: string): Promise<{ id: string; nome: string; cidade: string | null }[]> {
  await exigirInterno();
  const t = termo.trim();
  if (t.length < 2) return [];
  return prisma.clinica.findMany({
    where: { nome: { contains: t, mode: "insensitive" } },
    orderBy: [{ ativa: "desc" }, { nome: "asc" }],
    take: 10,
    select: { id: true, nome: true, cidade: true },
  });
}

export async function desvincularPessoa(clinicaId: string, pessoaId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  const r = await prisma.vinculoPessoaClinica.deleteMany({ where: { clinicaId, pessoaId } });
  if (r.count === 0) return { ok: false, erro: "Vínculo não encontrado." };
  await registrarAuditoria(sessao.usuarioId, "Clinica", clinicaId, "desvincular-pessoa", pessoaId);
  atualizar(clinicaId);
  return { ok: true };
}

export async function moverPessoa(deClinicaId: string, pessoaId: string, paraClinicaId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (deClinicaId === paraClinicaId) return { ok: false, erro: "Escolha outra clínica." };
  const destino = await prisma.clinica.findUnique({ where: { id: paraClinicaId }, select: { nome: true } });
  if (!destino) return { ok: false, erro: "Clínica de destino não encontrada." };
  await prisma.$transaction([
    prisma.vinculoPessoaClinica.deleteMany({ where: { clinicaId: deClinicaId, pessoaId } }),
    prisma.vinculoPessoaClinica.upsert({
      where: { pessoaId_clinicaId: { pessoaId, clinicaId: paraClinicaId } },
      update: {},
      create: { pessoaId, clinicaId: paraClinicaId },
    }),
  ]);
  await registrarAuditoria(sessao.usuarioId, "Clinica", deClinicaId, "mover-pessoa", `${pessoaId} → ${destino.nome}`);
  atualizar(deClinicaId, paraClinicaId);
  return { ok: true };
}

export async function separarEmClinicaPropria(deClinicaId: string, pessoaId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  const pessoa = await prisma.pessoaCliente.findUnique({
    where: { id: pessoaId },
    select: { nome: true, telefone: true, email: true, conselho: true, registroConselho: true },
  });
  if (!pessoa) return { ok: false, erro: "Pessoa não encontrada." };
  const nova = await prisma.$transaction(async (tx) => {
    const clinica = await tx.clinica.create({
      data: {
        nome: pessoa.nome,
        slug: await slugLivre(pessoa.nome),
        telefone: pessoa.telefone,
        email: pessoa.email,
        conselho: pessoa.conselho,
        registroConselho: pessoa.registroConselho,
        preCadastro: true,
        ativa: false,
        observacoes: "Separada de outra clínica pela equipe (vínculo do CRM corrigido).",
      },
      select: { id: true },
    });
    await tx.vinculoPessoaClinica.deleteMany({ where: { clinicaId: deClinicaId, pessoaId } });
    await tx.vinculoPessoaClinica.create({ data: { pessoaId, clinicaId: clinica.id } });
    return clinica;
  });
  await registrarAuditoria(sessao.usuarioId, "Clinica", nova.id, "separar-pessoa", `de ${deClinicaId}`);
  atualizar(deClinicaId, nova.id);
  return { ok: true };
}
