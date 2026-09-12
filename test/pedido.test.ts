import { test } from "node:test";
import assert from "node:assert/strict";
import { podeTransicionar, STATUS_ATIVOS } from "../src/lib/pedido";

test("solicitação do portal precisa passar por confirmação antes de alocar", () => {
  assert.equal(podeTransicionar("SOLICITADO", "CONFIRMADO"), true);
  assert.equal(podeTransicionar("SOLICITADO", "ALOCADO"), false);
});

test("resultado só vem de pedido alocado — sem profissional não há atendimento", () => {
  assert.equal(podeTransicionar("ALOCADO", "REALIZADO"), true);
  assert.equal(podeTransicionar("CONFIRMADO", "REALIZADO"), false);
});

test("desalocar devolve o pedido para a fila", () => {
  assert.equal(podeTransicionar("ALOCADO", "CONFIRMADO"), true);
});

test("realizado, faltou e cancelado são terminais", () => {
  for (const terminal of ["REALIZADO", "FALTOU", "CANCELADO"] as const) {
    assert.equal(podeTransicionar(terminal, "CONFIRMADO"), false);
    assert.equal(podeTransicionar(terminal, "CANCELADO"), false);
  }
});

test("só status ativo ocupa a agenda", () => {
  assert.deepEqual(STATUS_ATIVOS, ["SOLICITADO", "CONFIRMADO", "ALOCADO"]);
});
