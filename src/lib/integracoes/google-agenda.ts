/**
 * Sincronização com o Google Agenda da equipe (Fase 4).
 *
 * Só o agendamento CONFIRMADO vira evento — solicitação do portal ainda não é
 * compromisso, e poluir a agenda com pedido que pode ser recusado tira a
 * confiança de quem olha a agenda para saber onde estar.
 *
 * O id do evento fica gravado no pedido: é ele que permite ATUALIZAR o evento
 * num reagendamento em vez de criar um segundo, que é como a agenda de uma
 * equipe vira um campo minado de horário fantasma.
 */

import { prisma } from "@/lib/prisma";
import { instanteDoAtendimento } from "@/lib/data";

function configurado(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_AGENDA_ID
  );
}

export async function sincronizarEvento(pedidoId: string): Promise<void> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: {
      id: true,
      numero: true,
      data: true,
      horaInicio: true,
      duracaoMin: true,
      googleEventoId: true,
      clinica: { select: { nome: true, endereco: true } },
      servico: { select: { nome: true } },
      profissional: { select: { nome: true } },
    },
  });
  if (!pedido) return;

  if (!configurado()) {
    // Registra a intenção para que a Fase 4 tenha o que reprocessar, em vez
    // de perder silenciosamente os eventos criados antes da integração.
    await prisma.sincronizacaoExterna.create({
      data: {
        sistema: "GOOGLE_AGENDA",
        entidade: "Pedido",
        entidadeId: pedido.id,
        acao: pedido.googleEventoId ? "atualizar-evento" : "criar-evento",
        sucesso: false,
        erro: "Integração não configurada (Fase 4).",
      },
    });
    return;
  }

  const inicio = instanteDoAtendimento(pedido.data, pedido.horaInicio);
  const fim = new Date(inicio.getTime() + pedido.duracaoMin * 60 * 1000);

  // A chamada HTTP à API do Google entra na Fase 4, junto com a conta de
  // serviço. O formato do evento já está fechado com a equipe:
  void {
    summary: `${pedido.servico.nome} — ${pedido.clinica.nome} (pedido ${pedido.numero})`,
    location: pedido.clinica.endereco ?? undefined,
    description: pedido.profissional ? `Profissional: ${pedido.profissional.nome}` : undefined,
    start: inicio.toISOString(),
    end: fim.toISOString(),
  };
}
