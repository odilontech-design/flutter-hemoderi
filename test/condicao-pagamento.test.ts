import test from "node:test";
import assert from "node:assert/strict";
import { condicaoAoPagarPix, condicaoInicial } from "../src/lib/condicao-pagamento";

test("a condição nasce a do cadastro da clínica, se válida", () => {
  assert.equal(condicaoInicial("Faturado no mês"), "Faturado no mês");
  assert.equal(condicaoInicial("  Cortesia "), "Cortesia");
  assert.equal(condicaoInicial("fiado"), null);
  assert.equal(condicaoInicial(null), null);
});

test("Pix pago antes do atendimento marca Antecipado, só no que está em branco", () => {
  const inicio = new Date("2026-11-10T13:00:00Z");
  assert.equal(condicaoAoPagarPix(null, new Date("2026-11-09T12:00:00Z"), inicio), "Antecipado");
  assert.equal(condicaoAoPagarPix("", new Date("2026-11-09T12:00:00Z"), inicio), "Antecipado");
  assert.equal(condicaoAoPagarPix("Faturado no mês", new Date("2026-11-09T12:00:00Z"), inicio), null);
  assert.equal(condicaoAoPagarPix(null, new Date("2026-11-10T15:00:00Z"), inicio), null);
});
