"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirInterno, registrarAuditoria } from "@/lib/sessao";
import { perfilPermite } from "@/lib/papeis";
import { proximoNumeroDePedido } from "@/lib/numero-pedido";
import { codigoDoPedido } from "@/lib/numeracao";
import { alocarPedido, cancelarPedido, type Resultado } from "./pedidos";

/**
 * Mais de um profissional no mesmo atendimento (pedido da Joyce, 05/11).
 *
 * Cada profissional extra vira um pedido de APOIO ligado ao principal: mesma
 * clínica, serviço, data, horário e local, valor zero para a clínica. Assim
 * ele tem tudo o que um profissional tem — aviso de alocação, aceite,
 * check-in, relatório, repasse e evento na agenda — sem duplicar a cobrança.
 * Mudanças no principal (horário, local, cancelamento) seguem para os apoios
 * (lib/apoio.ts).
 */

const STATUS_QUE_ACEITAM = ["SOLICITADO", "CONFIRMADO", "ALOCADO"];

function atualizar(pedidoId: string) {
  revalidatePath("/painel/pedidos");
  revalidatePath(`/painel/pedidos/${pedidoId}`);
  revalidatePath("/painel/agenda");
}

export async function adicionarProfissional(pedidoId: string, profissionalId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "LOGISTICA")) return { ok: false, erro: "Só a logística aloca profissionais." };
  if (!profissionalId) return { ok: false, erro: "Escolha o profissional." };

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, select: { apoioDeId: true } });
  if (!pedido) return { ok: false, erro: "Agendamento não encontrado." };
  const principalId = pedido.apoioDeId ?? pedidoId;
  const principal = await prisma.pedido.findUnique({
    where: { id: principalId },
    include: { clinica: { select: { nome: true } }, apoios: { where: { status: { not: "CANCELADO" } }, select: { profissionalId: true } } },
  });
  if (!principal) return { ok: false, erro: "Agendamento não encontrado." };
  if (!STATUS_QUE_ACEITAM.includes(principal.status)) {
    return { ok: false, erro: "Só dá para adicionar profissional em agendamento ainda não realizado nem cancelado." };
  }
  if (principal.profissionalId === profissionalId || principal.apoios.some((a) => a.profissionalId === profissionalId)) {
    return { ok: false, erro: "Esse profissional já está neste atendimento." };
  }

  const codigo = codigoDoPedido(principal.numero, principal.clinica.nome, principal.data);
  const apoio = await prisma.$transaction(async (tx) =>
    tx.pedido.create({
      data: {
        numero: await proximoNumeroDePedido(tx),
        apoioDeId: principal.id,
        clinicaId: principal.clinicaId,
        servicoId: principal.servicoId,
        modalidade: principal.modalidade,
        enderecoId: principal.enderecoId,
        quantidade: principal.quantidade,
        data: principal.data,
        horaInicio: principal.horaInicio,
        duracaoMin: principal.duracaoMin,
        status: "CONFIRMADO",
        origem: "INTERNO",
        valorServicoCentavos: 0,
        valorManual: true,
        pacienteNome: principal.pacienteNome,
        doutorNome: principal.doutorNome,
        procedimentoPaciente: principal.procedimentoPaciente,
        contatoClinica: principal.contatoClinica,
        observacoes: `Profissional adicional do ${codigo}.`,
        criadoPorId: sessao.usuarioId,
      },
      select: { id: true, numero: true },
    })
  );

  const alocado = await alocarPedido(apoio.id, profissionalId);
  if (!alocado.ok) {
    // Não deixa uma vaga solta quando a pessoa escolhida não pode: desfaz.
    await prisma.pedido.delete({ where: { id: apoio.id } });
    return { ok: false, erro: alocado.erro };
  }
  await registrarAuditoria(sessao.usuarioId, "Pedido", principal.id, "adicionar-profissional", `apoio nº ${apoio.numero}`);
  atualizar(principal.id);
  return { ok: true, avisos: ["Profissional adicionado ao atendimento e avisado.", ...(alocado.avisos ?? [])] };
}

export async function removerProfissionalAdicional(apoioId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "LOGISTICA")) return { ok: false, erro: "Só a logística mexe na equipe do atendimento." };
  const apoio = await prisma.pedido.findUnique({
    where: { id: apoioId },
    select: { apoioDeId: true, status: true, relatorio: { select: { id: true } } },
  });
  if (!apoio?.apoioDeId) return { ok: false, erro: "Este não é um profissional adicional." };
  if (apoio.relatorio || !STATUS_QUE_ACEITAM.includes(apoio.status)) {
    return { ok: false, erro: "O atendimento já aconteceu: não dá mais para tirar o profissional." };
  }
  const r = await cancelarPedido(apoioId, "Profissional adicional retirado pela logística");
  if (r.ok) {
    await registrarAuditoria(sessao.usuarioId, "Pedido", apoio.apoioDeId, "remover-profissional", apoioId);
    atualizar(apoio.apoioDeId);
  }
  return r.ok ? { ok: true, avisos: ["Profissional retirado do atendimento e avisado."] } : r;
}
