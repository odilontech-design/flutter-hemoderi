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
  clinica: {
    nome: string;
    endereco: string | null;
    cidade: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    uf?: string | null;
    cep?: string | null;
  };
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
    // Ata de 27/10: lembrete de 2h só na agenda de quem atende; a agenda da
    // operação (equipe interna) fica sem notificações, para não receber
    // dezenas de alertas por dia.
    reminders: {
      useDefault: false,
      overrides: pedido.profissional?.googleAgendaId ? [{ method: "popup", minutes: 120 }] : [],
    },
  };
}

/** "11/11/2026" a partir do dia do atendimento (meia-noite UTC). */
function diaBR(data: Date): string {
  const [a, m, d] = data.toISOString().slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** "08:00" + 45 min = "08:45". */
function somarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(":").map(Number);
  const total = (h * 60 + (m || 0) + minutos) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "Rua X, 560 – conj 82 – Bela Vista, São Paulo/SP – CEP 01323-000". */
function enderecoCompleto(c: PedidoParaAgenda["clinica"]): string {
  const rua = [c.endereco, c.numero].filter(Boolean).join(", ");
  const cidade = [c.cidade, c.uf].filter(Boolean).join("/");
  const cep = c.cep ? `CEP ${c.cep}` : null;
  return [rua, c.complemento, [c.bairro, cidade].filter(Boolean).join(", "), cep].filter((p) => p && p.length > 0).join(" – ");
}

export type PedidoParaEquipe = PedidoParaAgenda & {
  doutorNome?: string | null;
  valorServicoCentavos?: number;
  formaPagamento?: string | null;
  procedimentoPaciente?: string | null;
};

/**
 * A ficha que a logística preenchia à mão na agenda (pedido da Joyce,
 * 10/11): os mesmos campos, na mesma ordem. O que o sistema sabe vem
 * preenchido; o que só a equipe sabe depois do atendimento (pagamento, sinais
 * vitais, orçamento, início e fim) fica em branco para digitar no evento.
 */
export function fichaDoAtendimento(pedido: PedidoParaEquipe): string {
  const fim = somarMinutos(pedido.horaInicio, pedido.duracaoMin);
  const valor = (pedido.valorServicoCentavos ?? 0) > 0 ? ((pedido.valorServicoCentavos ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  const sedacao = /seda/i.test(pedido.servico.nome);
  return [
    `Data: ${diaBR(pedido.data)}`,
    `Horário: ${pedido.horaInicio} às ${fim}`,
    `Endereço completo com CEP: ${enderecoCompleto(pedido.clinica)}`,
    `Nome da Clínica: ${pedido.clinica.nome}`,
    `Cirurgião: ${pedido.doutorNome ?? ""}`,
    `Paciente: ${pedido.pacienteNome ?? ""}`,
    `Procedimento que será realizado no paciente: ${pedido.procedimentoPaciente ?? ""}`,
    `Serviços Hemoderi: ${pedido.servico.nome}`,
    `Profissional Hemoderi: ${pedido.profissional?.nome ?? "a alocar"}`,
    `Valor = ${valor}`,
    "Pagamento (Sim/Não) =",
    `Forma de Pagamento: ${pedido.formaPagamento ?? ""}`,
    ...(sedacao ? ["FC=", "Sato2=", "PA =", "Destro"] : []),
    "Orçamento =",
    "PG=",
    "início=",
    "fim=",
    `Obs: ${pedido.observacoes ?? ""}`,
    "",
    `Pedido nº ${pedido.numero} · Dilon Saúde | Operações — Hemoderi`,
  ].join("\n");
}

/**
 * O evento na agenda da equipe: o título no formato que a equipe já usava à
 * mão ("Dr. Fulano · serviço · profissional"), sem lembrete — são dezenas por
 * dia — e a descrição na ficha da logística.
 *
 * A ficha só é escrita AO CRIAR. Depois a equipe digita nela (sinais vitais,
 * pagamento, início e fim), e o Google PATCH preserva o que não é enviado:
 * ao atualizar, só título, horário e local acompanham o sistema. Reescrever a
 * descrição a cada "marcar realizado" apagaria o que foi anotado.
 */
export function montarEventoDaEquipe(pedido: PedidoParaEquipe, criando = true): EventoGoogle {
  const evento = montarEvento(pedido);
  const titulo = [pedido.doutorNome || pedido.clinica.nome, pedido.servico.nome, pedido.profissional?.nome ?? "a alocar"].join(" · ");
  const { description: _descricao, ...resto } = evento;
  void _descricao;
  return {
    ...resto,
    summary: titulo,
    ...(criando ? { description: fichaDoAtendimento(pedido) } : {}),
    reminders: { useDefault: false, overrides: [] },
  };
}
