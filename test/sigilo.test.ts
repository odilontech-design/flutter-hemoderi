import { test } from "node:test";
import assert from "node:assert/strict";
import { localRevelado } from "../src/lib/sigilo";

const DIA = new Date("2026-09-20T00:00:00.000Z");

test("atendimento distante ainda não mostra a clínica", () => {
  // 20/09 às 14:00 em São Paulo, visto do dia 18.
  const agora = new Date("2026-09-18T12:00:00.000Z");
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
