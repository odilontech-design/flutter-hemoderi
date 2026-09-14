"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { dataDeISO, paraMinutos } from "@/lib/data";
import type { Resultado } from "./pedidos";

/**
 * A agenda que o profissional declara. É a peça que permite a operação sair
 * do telefonema: sem disponibilidade declarada, alocar 1.500 atendimentos por
 * mês significa 1.500 ligações perguntando "você pode?".
 */
export async function adicionarDisponibilidade(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await exigirProfissional();

  const diaSemana = Number(dados.get("diaSemana"));
  const horaInicio = String(dados.get("horaInicio") ?? "");
  const horaFim = String(dados.get("horaFim") ?? "");

  if (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6) {
    return { ok: false, erro: "Dia da semana inválido." };
  }
  if (!horaInicio || !horaFim || paraMinutos(horaFim) <= paraMinutos(horaInicio)) {
    return { ok: false, erro: "O fim precisa ser depois do início." };
  }

  await prisma.disponibilidade.create({
    data: { profissionalId: sessao.profissionalId, diaSemana, horaInicio, horaFim },
  });

  revalidatePath("/profissional/disponibilidade");
  return { ok: true };
}

export async function removerDisponibilidade(id: string): Promise<Resultado> {
  const sessao = await exigirProfissional();
  await prisma.disponibilidade.deleteMany({ where: { id, profissionalId: sessao.profissionalId } });
  revalidatePath("/profissional/disponibilidade");
  return { ok: true };
}

/**
 * Ausência pontual. Não mexe em atendimento já alocado de propósito: quem já
 * assumiu um compromisso precisa avisar a central, e cancelar sozinho pelo
 * app deixaria a clínica sem profissional sem ninguém ficar sabendo.
 */
export async function marcarAusencia(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await exigirProfissional();

  const dataISO = String(dados.get("data") ?? "");
  if (!dataISO) return { ok: false, erro: "Informe a data." };

  const horaInicio = String(dados.get("horaInicio") ?? "") || null;
  const horaFim = String(dados.get("horaFim") ?? "") || null;
  if (horaInicio && horaFim && paraMinutos(horaFim) <= paraMinutos(horaInicio)) {
    return { ok: false, erro: "O fim precisa ser depois do início." };
  }

  const data = dataDeISO(dataISO);

  const jaAlocado = await prisma.pedido.count({
    where: { profissionalId: sessao.profissionalId, data, status: "ALOCADO" },
  });

  await prisma.bloqueio.create({
    data: {
      profissionalId: sessao.profissionalId,
      data,
      horaInicio,
      horaFim,
      motivo: String(dados.get("motivo") ?? "") || null,
    },
  });

  revalidatePath("/profissional/disponibilidade");
  return {
    ok: true,
    avisos: jaAlocado
      ? [`Você tem ${jaAlocado} atendimento(s) já alocado(s) nesse dia. Avise a central — eles continuam na sua agenda.`]
      : [],
  };
}

export async function removerAusencia(id: string): Promise<Resultado> {
  const sessao = await exigirProfissional();
  await prisma.bloqueio.deleteMany({ where: { id, profissionalId: sessao.profissionalId } });
  revalidatePath("/profissional/disponibilidade");
  return { ok: true };
}

/**
 * Conecta (ou desconecta) a agenda do Google do profissional.
 *
 * Quem informa é o próprio profissional, no portal dele — não a equipe. Quem
 * compartilha a agenda com a conta de serviço é ele, dentro da conta Google
 * dele; digitar o endereço aqui é só dizer ao sistema onde escrever, e é ele
 * quem sabe qual conta usou.
 *
 * Só guarda o endereço; não valida contra o Google. Uma agenda não
 * compartilhada devolve 403 na primeira publicação, e isso aparece no rastro
 * de sincronização — validar aqui exigiria uma ida ao Google no meio de um
 * formulário, para dar a mesma resposta mais tarde.
 */
export async function salvarAgendaDoGoogle(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await exigirProfissional();

  const agenda = String(dados.get("googleAgendaId") ?? "").trim();
  // Um id de agenda do Google é um endereço de e-mail (a conta, ou o id longo
  // de uma agenda secundária, que também termina em @group.calendar.google.com).
  if (agenda && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agenda)) {
    return { ok: false, erro: "O endereço da agenda deve ser um e-mail (o da sua conta Google)." };
  }

  await prisma.profissional.update({
    where: { id: sessao.profissionalId },
    data: { googleAgendaId: agenda || null },
  });

  revalidatePath("/profissional/disponibilidade");
  return { ok: true };
}
