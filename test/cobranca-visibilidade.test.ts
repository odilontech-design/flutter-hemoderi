import { test } from "node:test";
import assert from "node:assert/strict";
import { duracaoEfetiva, quantidadeEfetiva, quantidadeValida, totalDoItem } from "../src/lib/cobranca";
import { servicoVisivel } from "../src/lib/visibilidade";

const LIGHT_TOUCH = { permiteQuantidade: true, quantidadeMaxima: 32 };
const PRF = { permiteQuantidade: false, quantidadeMaxima: null };

test("serviço sem quantidade variável é sempre 1 — PRF é um por paciente", () => {
  assert.equal(quantidadeEfetiva(PRF, 3), 1);
  assert.equal(quantidadeValida(PRF, 1), true);
  assert.equal(quantidadeValida(PRF, 2), false);
});

test("quantidade variável respeita o mínimo de 1 e o máximo cadastrado", () => {
  assert.equal(quantidadeEfetiva(LIGHT_TOUCH, 6), 6);
  assert.equal(quantidadeEfetiva(LIGHT_TOUCH, 0), 1);
  assert.equal(quantidadeEfetiva(LIGHT_TOUCH, -4), 1);
  assert.equal(quantidadeEfetiva(LIGHT_TOUCH, "abc"), 1);
  assert.equal(quantidadeEfetiva(LIGHT_TOUCH, 99), 32);
  assert.equal(quantidadeEfetiva({ permiteQuantidade: true, quantidadeMaxima: null }, 99), 99);
});

test("quantidade fracionada ou acima do máximo não é válida", () => {
  assert.equal(quantidadeValida(LIGHT_TOUCH, 2.5), false);
  assert.equal(quantidadeValida(LIGHT_TOUCH, 33), false);
  assert.equal(quantidadeValida(LIGHT_TOUCH, 32), true);
});

test("o total é o preço unitário vezes a quantidade, em centavos inteiros", () => {
  assert.equal(totalDoItem(45_000, 6), 270_000);
  assert.equal(totalDoItem(45_000, 1), 45_000);
});

test("cobrado por hora com quantidade, a agenda reserva as horas contratadas", () => {
  const porHora = { duracaoMin: 60, unidadeCobranca: "HORA" as const, permiteQuantidade: true };
  assert.equal(duracaoEfetiva(porHora, 3), 180);
  const porDente = { duracaoMin: 60, unidadeCobranca: "PACIENTE" as const, permiteQuantidade: true };
  assert.equal(duracaoEfetiva(porDente, 6), 60, "dente não estica o tempo reservado");
});

test("serviço sem restrição é de todos", () => {
  assert.equal(servicoVisivel({ perfis: [], ufsIndisponiveis: [] }, { perfis: [], uf: "SP" }), true);
});

test("laser CO2 some para o Rio de Janeiro, e continua em São Paulo", () => {
  const co2 = { perfis: [], ufsIndisponiveis: ["RJ"] };
  assert.equal(servicoVisivel(co2, { perfis: ["ODONTOLOGIA"], uf: "rj" }), false);
  assert.equal(servicoVisivel(co2, { perfis: ["ODONTOLOGIA"], uf: "SP" }), true);
});

test("serviço de curso só aparece para quem tem perfil de curso", () => {
  const prfCurso = { perfis: ["CURSO" as const], ufsIndisponiveis: [] };
  assert.equal(servicoVisivel(prfCurso, { perfis: ["ODONTOLOGIA"], uf: "SP" }), false);
  assert.equal(servicoVisivel(prfCurso, { perfis: ["ODONTOLOGIA", "CURSO"], uf: "SP" }), true);
  assert.equal(servicoVisivel(prfCurso, { perfis: [], uf: "SP" }), false, "legado sem perfil não ganha o que é restrito");
});
