import { test } from "node:test";
import assert from "node:assert/strict";
import { localRevelado, agendadoDeUltimaHora, localVisivel } from "../src/lib/sigilo";

const DIA = new Date("2026-09-20T00:00:00.000Z");

test("atendimento distante ainda não mostra a clínica", () => {
  // 20/09 (domingo) às 14:00 em São Paulo, visto da quinta 17/09: a janela só
  // abre na sexta (a de sábado cai em fim de semana, ata de 29/10).
  const agora = new Date("2026-09-17T12:00:00.000Z");
  assert.equal(localRevelado(DIA, "14:00", 24, agora), false);
});

test("dentro da janela, a clínica aparece", () => {
  const agora = new Date("2026-09-19T18:00:00.000Z");
  assert.equal(localRevelado(DIA, "14:00", 24, agora), true);
});

test("atendimento que já começou fica sempre visível", () => {
  // É o dado que ele precisa para preencher o relatório e conferir o que
  // vai receber — esconder o passado não protege nada.
  const agora = new Date("2026-09-20T20:00:00.000Z");
  assert.equal(localRevelado(DIA, "14:00", 24, agora), true);
});

test("janela zero revela na hora — a operação pode desligar o sigilo", () => {
  const agora = new Date("2026-09-01T00:00:00.000Z");
  assert.equal(localRevelado(DIA, "14:00", 0, agora), false);
  assert.equal(localRevelado(DIA, "14:00", 24 * 365, agora), true);
});

test("agendamento do portal com até 24h de antecedência abre o local desde a alocação", () => {
  const data = new Date("2026-11-10T00:00:00Z");
  const base = { data, horaInicio: "10:00" };
  const agora = new Date("2026-11-04T12:00:00Z"); // bem antes da janela de revelação
  // Pedido da clínica feito 5h antes do horário: já é de última hora.
  const urgente = { ...base, origem: "PORTAL_CLINICA", criadoEm: new Date("2026-11-10T08:00:00Z") };
  assert.equal(agendadoDeUltimaHora(urgente), true);
  assert.equal(localVisivel(urgente, 24, agora), true);
  // Feito com folga: o sigilo normal vale.
  const folgado = { ...base, origem: "PORTAL_CLINICA", criadoEm: new Date("2026-11-01T12:00:00Z") };
  assert.equal(localVisivel(folgado, 24, agora), false);
  // Pedido da equipe não entra nessa regra, mesmo feito em cima da hora.
  const daEquipe = { ...base, origem: "INTERNO", criadoEm: new Date("2026-11-10T08:00:00Z") };
  assert.equal(localVisivel(daEquipe, 24, agora), false);
});

test("fora de São Paulo o local aparece desde a alocação", () => {
  const data = new Date("2026-11-20T00:00:00.000Z");
  const longe = new Date("2026-11-10T12:00:00.000Z");
  assert.equal(localRevelado(data, "09:00", 24, longe, "RJ"), true);
  assert.equal(localRevelado(data, "09:00", 24, longe, "SP"), false);
  assert.equal(localRevelado(data, "09:00", 24, longe, null), false);
});

test("atendimento de segunda: o local abre na sexta, não no domingo", () => {
  const segunda = new Date("2026-11-09T00:00:00.000Z"); // 09/11/2026, segunda-feira
  // Sexta 06/11 às 07h (Brasília) — ainda cedo; às 09h já abriu.
  assert.equal(localRevelado(segunda, "09:00", 24, new Date("2026-11-06T10:00:00.000Z"), "SP"), false);
  assert.equal(localRevelado(segunda, "09:00", 24, new Date("2026-11-06T12:00:00.000Z"), "SP"), true);
});

test("atendimento no meio da semana segue a janela normal de 24h", () => {
  const quarta = new Date("2026-11-11T00:00:00.000Z");
  assert.equal(localRevelado(quarta, "09:00", 24, new Date("2026-11-10T11:00:00.000Z"), "SP"), false); // terça 08h
  assert.equal(localRevelado(quarta, "09:00", 24, new Date("2026-11-10T13:00:00.000Z"), "SP"), true); // terça 10h
});

test("feriado pega a abertura: após Sexta-feira Santa o local abre na quinta", () => {
  const sabado = new Date("2026-04-04T00:00:00.000Z");
  const segundaDepois = new Date("2026-04-06T00:00:00.000Z"); // abertura no domingo de Páscoa → quinta 02/04
  assert.equal(localRevelado(segundaDepois, "09:00", 24, new Date("2026-04-02T10:00:00.000Z"), "SP"), false);
  assert.equal(localRevelado(segundaDepois, "09:00", 24, new Date("2026-04-02T12:00:00.000Z"), "SP"), true);
  assert.ok(sabado);
});
