import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarPercent, formatarReais, lerCentavos } from "../src/lib/dinheiro";

test("lê o formato brasileiro com milhar e decimal", () => {
  assert.equal(lerCentavos("1.234,56"), 123_456);
});

test("lê o formato copiado de planilha, com ponto decimal", () => {
  assert.equal(lerCentavos("1234.56"), 123_456);
});

test("ignora o símbolo da moeda e o espaço", () => {
  assert.equal(lerCentavos("R$ 200,00"), 20_000);
});

test("campo vazio é zero, não NaN", () => {
  assert.equal(lerCentavos(""), 0);
  assert.equal(lerCentavos(null), 0);
  assert.equal(lerCentavos("abc"), 0);
});

test("formata em real brasileiro", () => {
  assert.match(formatarReais(123_456), /1\.234,56/);
});

test("percentual sobre centavos sempre devolve inteiro", () => {
  assert.equal(aplicarPercent(10_010, 12.5), 1_251);
  assert.equal(aplicarPercent(33_333, 33.33), 11_110);
});
