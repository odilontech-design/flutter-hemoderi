import { test } from "node:test";
import assert from "node:assert/strict";
import { descricaoDoPreco, duracaoEfetiva, quantidadeEfetiva, quantidadeMinimaDe, quantidadeValida, totalDoItem } from "../src/lib/cobranca";
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

const ULTRASSOM_FACIAL = {
  permiteQuantidade: true,
  quantidadeMaxima: null,
  quantidadeMinima: 400,
  quantidadeIncluida: 400,
  valorAdicionalCentavos: 170,
};
const LENTES = { permiteQuantidade: true, quantidadeMaxima: null, quantidadeIncluida: 2, valorAdicionalCentavos: 40_000 };

test("o ultrassom nunca vende menos que o mínimo de disparos", () => {
  assert.equal(quantidadeMinimaDe(ULTRASSOM_FACIAL), 400);
  assert.equal(quantidadeEfetiva(ULTRASSOM_FACIAL, 10), 400);
  assert.equal(quantidadeValida(ULTRASSOM_FACIAL, 399), false);
  assert.equal(quantidadeValida(ULTRASSOM_FACIAL, 400), true);
  assert.equal(quantidadeValida(ULTRASSOM_FACIAL, 650), true);
});

test("com franquia, o preço cobre o incluído e só o excedente soma o adicional", () => {
  // R$ 990 até 400 disparos + R$ 1,70 por disparo adicional.
  assert.equal(totalDoItem(99_000, 400, ULTRASSOM_FACIAL), 99_000);
  assert.equal(totalDoItem(99_000, 500, ULTRASSOM_FACIAL), 99_000 + 100 * 170);
  // R$ 750 até 2 elementos + R$ 400 por elemento adicional.
  assert.equal(totalDoItem(75_000, 2, LENTES), 75_000);
  assert.equal(totalDoItem(75_000, 5, LENTES), 75_000 + 3 * 40_000);
});

test("pedir menos que a franquia não dá desconto", () => {
  assert.equal(totalDoItem(75_000, 1, LENTES), 75_000);
});

test("sem franquia o total continua sendo preço × quantidade", () => {
  assert.equal(totalDoItem(45_000, 6, { quantidadeIncluida: null }), 270_000);
});

test("a descrição do preço diz a franquia e o adicional em português", () => {
  const texto = descricaoDoPreco(99_000, {
    unidadeCobranca: "PACIENTE",
    rotuloQuantidade: "disparos",
    quantidadeIncluida: 400,
    valorAdicionalCentavos: 170,
  });
  assert.match(texto, /até 400 disparos/);
  assert.match(texto, /por disparo adicional/);
  assert.equal(descricaoDoPreco(0, { unidadeCobranca: "PACIENTE" }), "sob consulta");
  assert.match(descricaoDoPreco(50_000, { unidadeCobranca: "HORA" }), /por hora/);
});
