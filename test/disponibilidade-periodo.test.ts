import { test } from "node:test";
import assert from "node:assert/strict";
import { janelaValeNaData, janelasDoDia } from "../src/lib/agenda";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
// 2026-11-10 é terça (getUTCDay = 2).
const terca = { diaSemana: 2, horaInicio: "08:00", horaFim: "12:00" };

test("sem período, a janela vale toda semana", () => {
  assert.equal(janelaValeNaData(terca, d("2026-11-10")), true);
  assert.equal(janelaValeNaData(terca, d("2027-03-02")), true);
});

test("com período, vale só entre as datas, inclusive nas pontas", () => {
  const j = { ...terca, dataInicio: d("2026-11-10"), dataFim: d("2026-11-24") };
  assert.equal(janelaValeNaData(j, d("2026-11-03")), false);
  assert.equal(janelaValeNaData(j, d("2026-11-10")), true);
  assert.equal(janelaValeNaData(j, d("2026-11-24")), true);
  assert.equal(janelaValeNaData(j, d("2026-12-01")), false);
});

test("o dia da semana continua valendo dentro do período", () => {
  const j = { ...terca, dataInicio: d("2026-11-09"), dataFim: d("2026-11-30") };
  assert.equal(janelaValeNaData(j, d("2026-11-11")), false); // quarta
});

test("janelasDoDia com data respeita o período; com número, só o dia da semana", () => {
  const j = { ...terca, dataInicio: d("2026-11-10"), dataFim: d("2026-11-17") };
  assert.equal(janelasDoDia([j], d("2026-11-24")).length, 0);
  assert.equal(janelasDoDia([j], d("2026-11-17")).length, 1);
  assert.equal(janelasDoDia([j], 2).length, 1);
});
