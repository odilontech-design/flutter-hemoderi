import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMPOS_AGENDAMENTO, divergiu } from "../src/lib/relatorio";

test("o procedimento realizado no paciente é um dos campos que o profissional confirma no relatório", () => {
  const campo = CAMPOS_AGENDAMENTO.find((c) => c.nome === "procedimentoInformado");
  assert.ok(campo);
  assert.equal(campo.rotulo, "Procedimento realizado no paciente");
});

test("procedimento igual ao agendado (mesmo sem acento ou caixa) não é divergência", () => {
  assert.equal(divergiu("Enxerto ósseo", "enxerto osseo "), false);
});

test("procedimento diferente do agendado, ou preenchido onde estava vazio, é divergência", () => {
  assert.equal(divergiu("Implante dentário", "Enxerto ósseo"), true);
  assert.equal(divergiu(null, "Implante dentário"), true);
});
