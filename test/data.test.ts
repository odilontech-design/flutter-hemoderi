import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dataMinimaAgendamentoPublico,
  dentroDoPrazoDeCancelamento,
  diasDoIntervalo,
  formatarDiaEData,
  gradeDoMes,
  isoDeData,
  nomeDoProfissionalVisivel,
  proximosDias,
} from "../src/lib/data";

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

test("proximosDias começa em hoje e soma dia a dia", () => {
  const agora = new Date("2026-09-21T10:00:00-03:00"); // 21/09 em SP
  const dias = proximosDias(7, agora);
  assert.equal(dias.length, 7);
  assert.equal(isoDeData(dias[0]), "2026-09-21");
  assert.equal(isoDeData(dias[6]), "2026-09-27");
});

test("formatarDiaEData dá o nome do dia sem '-feira', mais a data curta", () => {
  assert.equal(formatarDiaEData(new Date("2026-09-21T00:00:00Z")), "Segunda, 21/09");
  assert.equal(formatarDiaEData(new Date("2026-09-26T00:00:00Z")), "Sábado, 26/09");
  assert.equal(formatarDiaEData(new Date("2026-09-27T00:00:00Z")), "Domingo, 27/09");
});

test("diasDoIntervalo lista cada dia, incluindo as duas pontas", () => {
  const dias = diasDoIntervalo(new Date("2026-09-21T00:00:00Z"), new Date("2026-09-23T00:00:00Z"));
  assert.deepEqual(dias?.map(isoDeData), ["2026-09-21", "2026-09-22", "2026-09-23"]);
});

test("diasDoIntervalo de um único dia devolve só ele", () => {
  const dias = diasDoIntervalo(new Date("2026-09-21T00:00:00Z"), new Date("2026-09-21T00:00:00Z"));
  assert.deepEqual(dias?.map(isoDeData), ["2026-09-21"]);
});

test("diasDoIntervalo recusa fim antes do início", () => {
  const dias = diasDoIntervalo(new Date("2026-09-22T00:00:00Z"), new Date("2026-09-21T00:00:00Z"));
  assert.equal(dias, null);
});

test("diasDoIntervalo recusa período maior que um ano", () => {
  const dias = diasDoIntervalo(new Date("2026-09-21T00:00:00Z"), new Date("2028-09-21T00:00:00Z"));
  assert.equal(dias, null);
});

test("gradeDoMes fecha em semanas completas, múltiplas de 7", () => {
  const grade = gradeDoMes("2026-09");
  assert.equal(grade.length % 7, 0);
});

test("gradeDoMes começa com dias nulos até o primeiro dia do mês cair no lugar certo da semana", () => {
  const grade = gradeDoMes("2026-09");
  const primeiroDia = new Date(Date.UTC(2026, 8, 1));
  const nulosNoComeco = primeiroDia.getUTCDay();
  for (let i = 0; i < nulosNoComeco; i++) assert.equal(grade[i], null);
  assert.equal(isoDeData(grade[nulosNoComeco] as Date), "2026-09-01");
});

test("gradeDoMes contém todos os dias do mês, na ordem", () => {
  const grade = gradeDoMes("2026-09");
  const dias = grade.filter((d): d is Date => d !== null).map((d) => isoDeData(d));
  assert.equal(dias.length, 30);
  assert.equal(dias[0], "2026-09-01");
  assert.equal(dias[29], "2026-09-30");
});
