import { test } from "node:test";
import assert from "node:assert/strict";
import { emAberto, statusDoEvento, statusDoPagamento, tokenConfere, transicaoPermitida } from "../src/lib/asaas-status";

test("eventos do Asaas viram estados da cobrança", () => {
  assert.equal(statusDoEvento("PAYMENT_CONFIRMED"), "PAGA");
  assert.equal(statusDoEvento("PAYMENT_RECEIVED"), "PAGA");
  assert.equal(statusDoEvento("PAYMENT_OVERDUE"), "VENCIDA");
  assert.equal(statusDoEvento("PAYMENT_REFUNDED"), "ESTORNADA");
  assert.equal(statusDoEvento("PAYMENT_CHARGEBACK_REQUESTED"), "CONTESTADA");
  assert.equal(statusDoEvento("PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"), "RECUSADA");
  assert.equal(statusDoEvento("PAYMENT_CREATED"), null);
});

test("a consulta ao Asaas vira estado; em trânsito não mexe", () => {
  assert.equal(statusDoPagamento({ status: "CONFIRMED" }), "PAGA");
  assert.equal(statusDoPagamento({ status: "RECEIVED_IN_CASH" }), "PAGA");
  assert.equal(statusDoPagamento({ status: "PENDING" }), "PENDENTE");
  assert.equal(statusDoPagamento({ status: "PENDING", deleted: true }), "CANCELADA");
  assert.equal(statusDoPagamento({ status: "REFUND_IN_PROGRESS" }), null);
});

test("paga não volta a vencida nem a cancelada por evento atrasado", () => {
  assert.equal(transicaoPermitida("PAGA", "VENCIDA"), false);
  assert.equal(transicaoPermitida("PAGA", "CANCELADA"), false);
  assert.equal(transicaoPermitida("PENDENTE", "PAGA"), true);
  assert.equal(transicaoPermitida("VENCIDA", "PAGA"), true);
});

test("só paga ou contestada vira estornada; o mesmo estado não é transição", () => {
  assert.equal(transicaoPermitida("PAGA", "ESTORNADA"), true);
  assert.equal(transicaoPermitida("PENDENTE", "ESTORNADA"), false);
  assert.equal(transicaoPermitida("PAGA", "PAGA"), false);
  assert.equal(transicaoPermitida("ESTORNADA", "PAGA"), false);
});

test("em aberto = ainda pode ser paga", () => {
  assert.equal(emAberto("PENDENTE"), true);
  assert.equal(emAberto("VENCIDA"), true);
  assert.equal(emAberto("PAGA"), false);
  assert.equal(emAberto("CANCELADA"), false);
});

test("o token do webhook só confere se for idêntico", () => {
  assert.equal(tokenConfere("segredo-123", "segredo-123"), true);
  assert.equal(tokenConfere("segredo-124", "segredo-123"), false);
  assert.equal(tokenConfere("curto", "segredo-123"), false);
  assert.equal(tokenConfere(null, "segredo-123"), false);
});
