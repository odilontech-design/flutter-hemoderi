import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarAtraso, houveAtraso, minutosDeAtraso, TOLERANCIA_MINUTOS } from "../src/lib/atraso";

/** 10/03/2026, um dia qualquer — a data em si não importa, a hora sim. */
const DIA = new Date("2026-03-10T00:00:00.000Z");
/** O combinado: 14:00 no fuso de São Paulo. */
const combinado = (hora: string) => new Date(`2026-03-10T${hora}:00-03:00`);

test("chegada na hora não é atraso", () => {
  assert.equal(minutosDeAtraso(DIA, "14:00", combinado("14:00")), 0);
  assert.equal(houveAtraso(DIA, "14:00", combinado("14:00")), false);
});

test("chegada adiantada devolve minutos negativos, não zero", () => {
  // Zerar esconderia quem chega cedo, que é informação boa.
  assert.equal(minutosDeAtraso(DIA, "14:00", combinado("13:45")), -15);
  assert.equal(houveAtraso(DIA, "14:00", combinado("13:45")), false);
});

test("dentro da tolerância não entra no relatório", () => {
  // Trânsito e elevador não são problema de operação: sem essa folga o
  // relatório listaria quase todo atendimento e ninguém o abriria.
  assert.equal(houveAtraso(DIA, "14:00", combinado("14:10")), false);
  assert.equal(minutosDeAtraso(DIA, "14:00", combinado("14:10")), TOLERANCIA_MINUTOS);
});

test("um minuto além da tolerância já é atraso", () => {
  assert.equal(houveAtraso(DIA, "14:00", combinado("14:11")), true);
});

test("atraso longo é contado inteiro", () => {
  assert.equal(minutosDeAtraso(DIA, "14:00", combinado("15:20")), 80);
  assert.equal(houveAtraso(DIA, "14:00", combinado("15:20")), true);
});

test("sem check-in não há atraso — não dá para afirmar que atrasou", () => {
  assert.equal(houveAtraso(DIA, "14:00", null), false);
});

test("o atraso é medido no fuso da operação, não em UTC", () => {
  // 14:00 em São Paulo é 17:00Z. Se a conta usasse UTC cru, uma chegada
  // pontual apareceria como três horas de atraso.
  assert.equal(minutosDeAtraso(DIA, "14:00", new Date("2026-03-10T17:00:00.000Z")), 0);
});

test("até uma hora, o formato é em minutos", () => {
  assert.equal(formatarAtraso(11), "11 min");
  assert.equal(formatarAtraso(59), "59 min");
});

test("acima de uma hora vira hora e minuto — quem lê não faz conta", () => {
  assert.equal(formatarAtraso(60), "1h");
  assert.equal(formatarAtraso(80), "1h20");
  assert.equal(formatarAtraso(125), "2h05");
});
