import { test } from "node:test";
import assert from "node:assert/strict";
import { planoDoDia, turnosDisponiveis } from "../src/lib/disponibilidade-dia";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const terca = d("2026-11-10"); // terça
const manhaSemanal = { diaSemana: 2, horaInicio: "08:00", horaFim: "12:00" };
const integralSemanal = { diaSemana: 2, horaInicio: "00:00", horaFim: "23:59" };

test("dia sem padrão: marcar a tarde abre uma janela só da tarde", () => {
  const plano = planoDoDia([], terca, ["TARDE"]);
  assert.deepEqual(plano.abrir.map((t) => t.chave), ["TARDE"]);
  assert.equal(plano.fechar.length, 0);
});

test("padrão de manhã: desmarcar tudo fecha a manhã", () => {
  const plano = planoDoDia([manhaSemanal], terca, []);
  assert.deepEqual(plano.fechar.map((t) => t.chave), ["MANHA"]);
  assert.equal(plano.abrir.length, 0);
});

test("padrão de dia inteiro: só a manhã fecha a tarde", () => {
  const plano = planoDoDia([integralSemanal], terca, ["MANHA"]);
  assert.deepEqual(plano.fechar.map((t) => t.chave), ["TARDE"]);
});

test("dia inteiro marcado abre manhã e tarde", () => {
  assert.deepEqual(planoDoDia([], terca, ["INTEGRAL"]).abrir.map((t) => t.chave), ["MANHA", "TARDE"]);
});

test("turnos disponíveis descontam a ausência do dia", () => {
  assert.deepEqual(turnosDisponiveis([integralSemanal], [], terca), ["MANHA", "TARDE"]);
  assert.deepEqual(turnosDisponiveis([integralSemanal], [{ horaInicio: "13:00", horaFim: "18:00" }], terca), ["MANHA"]);
  assert.deepEqual(turnosDisponiveis([integralSemanal], [{ horaInicio: null, horaFim: null }], terca), []);
});
