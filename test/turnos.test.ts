import { test } from "node:test";
import assert from "node:assert/strict";
import { rotuloDaJanela, TURNOS, turnoDaJanela, turnoPorChave } from "../src/lib/turnos";

test("os três turnos que a operação usa", () => {
  assert.deepEqual(TURNOS.map((t) => t.chave), ["MANHA", "TARDE", "INTEGRAL"]);
});

test("o dia inteiro cobre as 24 horas — quem corta é o horário da operação", () => {
  const integral = turnoPorChave("INTEGRAL");
  assert.equal(integral?.horaInicio, "00:00");
  assert.equal(integral?.horaFim, "23:59");
});

test("janela gravada é reconhecida como turno", () => {
  assert.equal(turnoDaJanela("08:00", "12:00")?.chave, "MANHA");
  assert.equal(turnoDaJanela("13:00", "18:00")?.chave, "TARDE");
});

test("janela fora do padrão continua aparecendo com o horário cru", () => {
  // Declarações feitas antes desta mudança não podem sumir da tela.
  assert.equal(turnoDaJanela("09:30", "11:00"), undefined);
  assert.equal(rotuloDaJanela("09:30", "11:00"), "09:30 às 11:00");
});

test("janela de turno aparece pelo nome", () => {
  assert.equal(rotuloDaJanela("08:00", "12:00"), "Manhã");
});
