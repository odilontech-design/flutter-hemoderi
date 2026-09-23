import { test } from "node:test";
import assert from "node:assert/strict";
import { dataMinimaAgendamentoPublico, dentroDoPrazoDeCancelamento, nomeDoProfissionalVisivel } from "../src/lib/data";

// Instantes em UTC que caem em horários redondos no fuso de operação
// (America/Sao_Paulo, -03:00 o ano todo).
const ANTES_DAS_18H = new Date("2026-09-21T20:00:00Z"); // 17:00 em SP
const AS_18H_EM_PONTO = new Date("2026-09-21T21:00:00Z"); // 18:00 em SP
const DEPOIS_DAS_18H = new Date("2026-09-21T21:01:00Z"); // 18:01 em SP

test("antes das 18h, a data mínima é amanhã", () => {
  assert.equal(dataMinimaAgendamentoPublico(ANTES_DAS_18H), "2026-09-22");
});

test("às 18h em ponto, amanhã ainda vale — 'até às 18h' inclui a hora cheia", () => {
  assert.equal(dataMinimaAgendamentoPublico(AS_18H_EM_PONTO), "2026-09-22");
});

test("depois das 18h, a data mínima pula para depois de amanhã", () => {
  assert.equal(dataMinimaAgendamentoPublico(DEPOIS_DAS_18H), "2026-09-23");
});

test("hoje nunca é uma data aceita, em nenhum dos dois casos", () => {
  const hoje = "2026-09-21";
  assert.notEqual(dataMinimaAgendamentoPublico(ANTES_DAS_18H), hoje);
  assert.notEqual(dataMinimaAgendamentoPublico(DEPOIS_DAS_18H), hoje);
});

test("cancelamento com mais de 30 minutos de antecedência é permitido", () => {
  const agora = new Date("2026-09-21T14:00:00-03:00");
  const data = new Date("2026-09-21T00:00:00Z");
  assert.equal(dentroDoPrazoDeCancelamento(data, "14:31", agora), true);
});

test("cancelamento com exatos 30 minutos ainda é permitido", () => {
  const agora = new Date("2026-09-21T14:00:00-03:00");
  const data = new Date("2026-09-21T00:00:00Z");
  assert.equal(dentroDoPrazoDeCancelamento(data, "14:30", agora), true);
});

test("cancelamento com menos de 30 minutos é recusado", () => {
  const agora = new Date("2026-09-21T14:00:00-03:00");
  const data = new Date("2026-09-21T00:00:00Z");
  assert.equal(dentroDoPrazoDeCancelamento(data, "14:29", agora), false);
});

test("atendimento que já passou nunca está dentro do prazo", () => {
  const agora = new Date("2026-09-21T14:00:00-03:00");
  const data = new Date("2026-09-21T00:00:00Z");
  assert.equal(dentroDoPrazoDeCancelamento(data, "10:00", agora), false);
});

test("nome do profissional fica oculto a mais de 24h do atendimento", () => {
  const agora = new Date("2026-09-20T10:00:00-03:00");
  const data = new Date("2026-09-21T00:00:00Z");
  assert.equal(nomeDoProfissionalVisivel(data, "10:01", agora), false);
});

test("nome do profissional aparece a partir de exatas 24h de antecedência", () => {
  const agora = new Date("2026-09-20T10:00:00-03:00");
  const data = new Date("2026-09-21T00:00:00Z");
  assert.equal(nomeDoProfissionalVisivel(data, "10:00", agora), true);
});

test("nome do profissional de um atendimento que já passou continua visível", () => {
  const agora = new Date("2026-09-21T14:00:00-03:00");
  const data = new Date("2026-09-21T00:00:00Z");
  assert.equal(nomeDoProfissionalVisivel(data, "10:00", agora), true);
});
