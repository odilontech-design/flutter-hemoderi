import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMAS_DE_PAGAMENTO, FORMA_CARTAO, formaDePagamentoValida } from "../src/lib/pagamento";

test("oferece cartão de crédito ao lado de Pix, dinheiro e cheque", () => {
  assert.deepEqual([...FORMAS_DE_PAGAMENTO], ["Pix", "Cartão de crédito", "Dinheiro", "Cheque"]);
  assert.equal(formaDePagamentoValida(FORMA_CARTAO), true);
});

test("rejeita forma de pagamento desconhecida", () => {
  assert.equal(formaDePagamentoValida("Boleto"), false);
});
