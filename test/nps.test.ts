import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIMITE_ATENDIMENTOS_MULTIPLOS,
  elegivelParaNps,
  elegivelParaPrimeiraPesquisa,
  faixaDaNota,
  notaNpsValida,
  scoreNps,
} from "../src/lib/nps";

test("só quem NÃO teve múltiplos atendimentos entra na pesquisa", () => {
  assert.equal(elegivelParaNps(0), true);
  assert.equal(elegivelParaNps(1), true);
  assert.equal(elegivelParaNps(LIMITE_ATENDIMENTOS_MULTIPLOS), false);
  assert.equal(elegivelParaNps(5), false);
});

test("a primeira pesquisa é obrigatória a partir de 1 atendimento — sem teto de volume", () => {
  assert.equal(elegivelParaPrimeiraPesquisa(0), false, "nada a perguntar sem nenhum atendimento");
  assert.equal(elegivelParaPrimeiraPesquisa(1), true);
  assert.equal(elegivelParaPrimeiraPesquisa(5), true, "diferente de elegivelParaNps, volume alto não desqualifica");
});

test("nota aceita inteiro de 0 a 10", () => {
  assert.equal(notaNpsValida(0), true);
  assert.equal(notaNpsValida(10), true);
  assert.equal(notaNpsValida(-1), false);
  assert.equal(notaNpsValida(11), false);
  assert.equal(notaNpsValida(7.5), false);
  assert.equal(notaNpsValida("8"), true, "o formulário manda texto");
  assert.equal(notaNpsValida(""), false);
  assert.equal(notaNpsValida(null), false);
});

test("faixa clássica: 0-6 detrator, 7-8 neutro, 9-10 promotor", () => {
  assert.equal(faixaDaNota(0), "DETRATOR");
  assert.equal(faixaDaNota(6), "DETRATOR");
  assert.equal(faixaDaNota(7), "NEUTRO");
  assert.equal(faixaDaNota(8), "NEUTRO");
  assert.equal(faixaDaNota(9), "PROMOTOR");
  assert.equal(faixaDaNota(10), "PROMOTOR");
});

test("sem resposta o score é nulo, não zero", () => {
  assert.equal(scoreNps([]), null);
});

test("score é % promotor menos % detrator", () => {
  assert.equal(scoreNps([9, 9, 9, 9]), 100, "todo mundo promotor");
  assert.equal(scoreNps([0, 0, 0, 0]), -100, "todo mundo detrator");
  assert.equal(scoreNps([7, 8]), 0, "só neutro não move o score");
  assert.equal(scoreNps([9, 0]), 0, "um promotor e um detrator se cancelam");
  assert.equal(scoreNps([9, 9, 0, 7]), 25, "2 promotores, 1 detrator, 1 neutro em 4");
});
