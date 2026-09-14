import { instanteDoAtendimento } from "../data";
import type { EventoGoogle } from "./google-api";

/**
 * A decisão da sincronização com o Google Agenda: o que publicar e o que
 * fazer com o que já está publicado.
 *
 * Separado de google-agenda.ts porque aqui não entra banco nem rede — e é
 * justamente essa parte que precisa de prova. "Reagendar cria um segundo
 * evento" e "trocar o profissional deixa o compromisso na agenda de quem
 * saiu" são erros que só aparecem na agenda de alguém, semanas depois, se
 * ninguém testar a regra antes.
 */

const FUSO = "America/Sao_Paulo";

/** O que a sincronização precisa saber de um pedido. */
export type PedidoParaAgenda = {
  numero: number;
  data: Date;
  horaInicio: string;
  duracaoMin: number;
  status: string;
  pacienteNome: string | null;
  observacoes: string | null;
  clinica: { nome: string; endereco: string | null; cidade: string | null };
  servico: { nome: string };
  profissional: { nome: string; googleAgendaId: string | null } | null;
};

/**
 * Um atendimento vira compromisso a partir de CONFIRMADO.
 *
 * SOLICITADO fica de fora porque ainda é pedido, não compromisso: encher a
 * agenda de alguém com horário que pode ser recusado é como a pessoa para de
 * confiar no que está marcado ali. CANCELADO sai da agenda. REALIZADO e
 * FALTOU ficam: já aconteceram, e apagar o passado só tira o histórico de
 * quem quer conferir onde esteve.
 */
export function deveTerEvento(status: string): boolean {
  return status !== "SOLICITADO" && status !== "CANCELADO";
}

/**
 * Em qual agenda este atendimento deve estar. Null = nenhuma configurada, e
 * aí a integração simplesmente não tem para onde escrever.
 */
export function agendaAlvo(pedido: PedidoParaAgenda, agendaPadrao: string | null): string | null {
  return pedido.profissional?.googleAgendaId || agendaPadrao;
}

export type EstadoDoEvento = { eventoId: string | null; agendaId: string | null };
export type PlanoAgenda =
  | { acao: "nada" }
  | { acao: "criar"; agendaId: string }
  | { acao: "atualizar"; agendaId: string; eventoId: string }
  | { acao: "mover"; de: { agendaId: string; eventoId: string }; paraAgendaId: string }
  | { acao: "apagar"; agendaId: string; eventoId: string };

/**
 * O que fazer, dado onde o evento está e onde ele deveria estar.
 *
 * "mover" existe porque o id de um evento só é endereçável junto com a agenda
 * que o contém: trocar o profissional de um atendimento não atualiza o evento,
 * apaga da agenda de quem saiu e cria na de quem entrou. Sem isso, o
 * profissional antigo ficaria com um compromisso que não é mais dele — e o
 * novo, sem nenhum.
 */
export function planejar(
  atual: EstadoDoEvento,
  alvo: { agendaId: string | null; deveExistir: boolean }
): PlanoAgenda {
  const existe = atual.eventoId && atual.agendaId;

  if (!alvo.deveExistir || !alvo.agendaId) {
    // Sem destino (ninguém conectou agenda) mas com evento publicado: ele
    // precisa sair. Um evento que o sistema não consegue mais atualizar é
    // pior que evento nenhum — vira horário fantasma.
    return existe
      ? { acao: "apagar", agendaId: atual.agendaId!, eventoId: atual.eventoId! }
      : { acao: "nada" };
  }

  if (!existe) return { acao: "criar", agendaId: alvo.agendaId };

  return atual.agendaId === alvo.agendaId
    ? { acao: "atualizar", agendaId: alvo.agendaId, eventoId: atual.eventoId! }
    : {
        acao: "mover",
        de: { agendaId: atual.agendaId!, eventoId: atual.eventoId! },
        paraAgendaId: alvo.agendaId,
      };
}

/**
 * O evento como ele aparece na agenda de quem vai atender.
 *
 * O título carrega serviço e clínica porque é a única linha que a pessoa lê
 * na visão de semana do celular; o número do pedido entra para a equipe
 * conseguir cruzar com o sistema quando alguém liga perguntando. O nome do
 * paciente fica na descrição, não no título: identificação de paciente não
 * precisa aparecer na tela de bloqueio de ninguém.
 */
export function montarEvento(pedido: PedidoParaAgenda): EventoGoogle {
  const inicio = instanteDoAtendimento(pedido.data, pedido.horaInicio);
  const fim = new Date(inicio.getTime() + pedido.duracaoMin * 60 * 1000);

  const endereco = [pedido.clinica.endereco, pedido.clinica.cidade].filter(Boolean).join(" — ");

  const descricao = [
    `Pedido nº ${pedido.numero} · ${pedido.status}`,
    `Clínica: ${pedido.clinica.nome}`,
    pedido.pacienteNome ? `Paciente: ${pedido.pacienteNome}` : null,
    pedido.observacoes ? `Observações: ${pedido.observacoes}` : null,
    "",
    "Agendado pelo Dilon Saúde | Operações — Hemoderi.",
  ]
    .filter((linha) => linha !== null)
    .join("\n");

  return {
    summary: `${pedido.servico.nome} — ${pedido.clinica.nome}`,
    description: descricao,
    location: endereco || undefined,
    start: { dateTime: inicio.toISOString(), timeZone: FUSO },
    end: { dateTime: fim.toISOString(), timeZone: FUSO },
  };
}
