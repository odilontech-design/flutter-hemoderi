import { test } from "node:test";
import assert from "node:assert/strict";
import { estrelas, formatarMedia, mediaDeNotas, notaValida } from "../src/lib/avaliacao";

test("aceita só nota inteira de 1 a 5", () => {
  assert.equal(notaValida(1), true);
  assert.equal(notaValida(5), true);
  assert.equal(notaValida(0), false);
  assert.equal(notaValida(6), false);
  assert.equal(notaValida(4.5), false);
  assert.equal(notaValida("3"), true, "o formulário manda texto");
  assert.equal(notaValida(""), false);
  assert.equal(notaValida(null), false);
  assert.equal(notaValida("abc"), false);
});

test("sem avaliação a média é nula, não zero", () => {
  assert.equal(mediaDeNotas([]), null);
  assert.equal(formatarMedia(null), "—");
});

test("média arredonda para uma casa", () => {
  assert.equal(mediaDeNotas([5, 4, 4]), 4.3);
  assert.equal(mediaDeNotas([5, 5, 5]), 5);
  assert.equal(mediaDeNotas([1, 2]), 1.5);
});

test("média sai com vírgula decimal", () => {
  assert.equal(formatarMedia(4.3), "4,3");
  assert.equal(formatarMedia(5), "5,0");
});

test("o desenho tem sempre cinco estrelas", () => {
  assert.equal(estrelas(5), "★★★★★");
  assert.equal(estrelas(4.4), "★★★★☆");
  assert.equal(estrelas(1), "★☆☆☆☆");
  assert.equal(estrelas(null), "");
});
