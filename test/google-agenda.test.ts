import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agendaAlvo,
  deveTerEvento,
  montarEvento,
  planejar,
  type PedidoParaAgenda,
} from "../src/lib/integracoes/google-evento";

const PEDIDO: PedidoParaAgenda = {
  numero: 412,
  data: new Date("2026-09-14T00:00:00.000Z"),
  horaInicio: "14:00",
  duracaoMin: 90,
  status: "ALOCADO",
  pacienteNome: "Maria S.",
  observacoes: "Levar o aparelho menor.",
  clinica: { nome: "Clínica Santa Rita", endereco: "Rua A, 100", cidade: "São Paulo" },
  servico: { nome: "Aplicação de toxina" },
  profissional: { nome: "Ana Ribeiro", googleAgendaId: "ana@gmail.com" },
};

// ── O que vira evento ────────────────────────────────────────────────────────

test("solicitação ainda não é compromisso e não vai para a agenda", () => {
  assert.equal(deveTerEvento("SOLICITADO"), false);
});

test("cancelado sai da agenda", () => {
  assert.equal(deveTerEvento("CANCELADO"), false);
});

test("confirmado, alocado, realizado e falta ficam na agenda", () => {
  for (const status of ["CONFIRMADO", "ALOCADO", "REALIZADO", "FALTOU"]) {
    assert.equal(deveTerEvento(status), true, status);
  }
});

// ── Em qual agenda ──────────────────────────────────────────────────────────

test("vai para a agenda do profissional quando ele conectou a dele", () => {
  assert.equal(agendaAlvo(PEDIDO, "operacao@hemoderi.com.br"), "ana@gmail.com");
});

test("cai na agenda da operação quando o profissional não conectou", () => {
  const sem = { ...PEDIDO, profissional: { nome: "Ana", googleAgendaId: null } };
  assert.equal(agendaAlvo(sem, "operacao@hemoderi.com.br"), "operacao@hemoderi.com.br");
});

test("sem profissional e sem agenda da operação não há para onde escrever", () => {
  assert.equal(agendaAlvo({ ...PEDIDO, profissional: null }, null), null);
});

// ── O plano ─────────────────────────────────────────────────────────────────

test("nada publicado e nada a publicar: não faz nada", () => {
  assert.deepEqual(
    planejar({ eventoId: null, agendaId: null }, { agendaId: null, deveExistir: true }),
    { acao: "nada" }
  );
});

test("primeira sincronização cria", () => {
  assert.deepEqual(
    planejar({ eventoId: null, agendaId: null }, { agendaId: "ana@gmail.com", deveExistir: true }),
    { acao: "criar", agendaId: "ana@gmail.com" }
  );
});

test("reagendar ATUALIZA o evento, não cria um segundo", () => {
  assert.deepEqual(
    planejar({ eventoId: "ev1", agendaId: "ana@gmail.com" }, { agendaId: "ana@gmail.com", deveExistir: true }),
    { acao: "atualizar", agendaId: "ana@gmail.com", eventoId: "ev1" }
  );
});

test("trocar o profissional move o evento de agenda", () => {
  assert.deepEqual(
    planejar({ eventoId: "ev1", agendaId: "ana@gmail.com" }, { agendaId: "bruno@gmail.com", deveExistir: true }),
    { acao: "mover", de: { agendaId: "ana@gmail.com", eventoId: "ev1" }, paraAgendaId: "bruno@gmail.com" }
  );
});

test("cancelar apaga da agenda em que o evento está", () => {
  assert.deepEqual(
    planejar({ eventoId: "ev1", agendaId: "ana@gmail.com" }, { agendaId: "ana@gmail.com", deveExistir: false }),
    { acao: "apagar", agendaId: "ana@gmail.com", eventoId: "ev1" }
  );
});

test("cancelar o que nunca foi publicado não tenta apagar nada", () => {
  assert.deepEqual(
    planejar({ eventoId: null, agendaId: null }, { agendaId: "ana@gmail.com", deveExistir: false }),
    { acao: "nada" }
  );
});

test("perder o destino apaga o evento em vez de deixar horário fantasma", () => {
  assert.deepEqual(
    planejar({ eventoId: "ev1", agendaId: "ana@gmail.com" }, { agendaId: null, deveExistir: true }),
    { acao: "apagar", agendaId: "ana@gmail.com", eventoId: "ev1" }
  );
});

test("evento com id mas sem agenda registrada é tratado como inexistente", () => {
  // Pedido sincronizado antes de googleAgendaId existir: sem saber a agenda,
  // o id sozinho não é endereçável. Publicar de novo é melhor que travar.
  assert.deepEqual(
    planejar({ eventoId: "antigo", agendaId: null }, { agendaId: "ana@gmail.com", deveExistir: true }),
    { acao: "criar", agendaId: "ana@gmail.com" }
  );
});

// ── O evento ────────────────────────────────────────────────────────────────

test("o horário sai no fuso de São Paulo, não em UTC cru", () => {
  const evento = montarEvento(PEDIDO);
  assert.equal(evento.start.timeZone, "America/Sao_Paulo");
  // 14:00 em São Paulo (UTC-3) são 17:00 UTC — o dia NÃO pode escorregar.
  assert.equal(evento.start.dateTime, "2026-09-14T17:00:00.000Z");
});

test("o fim respeita a duração congelada do pedido", () => {
  const evento = montarEvento(PEDIDO);
  assert.equal(evento.end.dateTime, "2026-09-14T18:30:00.000Z");
});

test("o título é o que se lê na visão de semana do celular", () => {
  assert.equal(montarEvento(PEDIDO).summary, "Aplicação de toxina — Clínica Santa Rita");
});

test("o nome do paciente não vai para o título", () => {
  assert.doesNotMatch(montarEvento(PEDIDO).summary, /Maria/);
  assert.match(montarEvento(PEDIDO).description ?? "", /Maria S\./);
});

test("o número do pedido entra na descrição, para cruzar com o sistema", () => {
  assert.match(montarEvento(PEDIDO).description ?? "", /Pedido nº 412/);
});

test("sem endereço o evento não inventa um local vazio", () => {
  const sem = { ...PEDIDO, clinica: { nome: "X", endereco: null, cidade: null } };
  assert.equal(montarEvento(sem).location, undefined);
});
