import { test } from "node:test";
import assert from "node:assert/strict";
import { bloqueioLigado, precisaBloquear } from "../src/lib/bloqueio-biometrico";

test("o bloqueio vem ligado e só desliga se a pessoa desligar", () => {
  assert.equal(bloqueioLigado(null), true);
  assert.equal(bloqueioLigado("ligado"), true);
  assert.equal(bloqueioLigado("desligado"), false);
});

test("pede biometria ao abrir o app", () => {
  assert.equal(precisaBloquear({ ligado: true, saiuEm: null, agora: 1000 }), true);
});

test("voltar rápido do segundo plano não pede de novo; depois da tolerância, pede", () => {
  const agora = 100_000;
  assert.equal(precisaBloquear({ ligado: true, saiuEm: agora - 10_000, agora }), false);
  assert.equal(precisaBloquear({ ligado: true, saiuEm: agora - 31_000, agora }), true);
});

test("com o bloqueio desligado nunca pede", () => {
  assert.equal(precisaBloquear({ ligado: false, saiuEm: null, agora: 1 }), false);
  assert.equal(precisaBloquear({ ligado: false, saiuEm: 0, agora: 10 ** 9 }), false);
});
