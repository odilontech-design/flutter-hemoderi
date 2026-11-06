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

import { descricaoDaCobranca } from "../src/lib/pagamento";

test("descrição da cobrança lista os serviços contratados com a data", () => {
  const t = descricaoDaCobranca(
    [
      { servicoNome: "Membranas – PRF", data: "07/11" },
      { servicoNome: "Membranas – PRF", data: "07/11" },
      { servicoNome: "AirFlow – GBT Machine", data: "09/11" },
    ],
    "Clínica X",
    500
  );
  assert.equal(t, "Hemoderi - Clínica X: Membranas – PRF x2 (07/11); AirFlow – GBT Machine (09/11)");
});

test("descrição respeita o limite sem cortar no meio de um serviço", () => {
  const itens = Array.from({ length: 10 }, (_, i) => ({ servicoNome: `Serviço número ${i}`, data: "07/11" }));
  const t = descricaoDaCobranca(itens, "Clínica", 90);
  assert.ok(t.length <= 90);
  assert.match(t, / e mais \d+$/);
});
