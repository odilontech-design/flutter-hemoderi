import { test } from "node:test";
import assert from "node:assert/strict";
import { validarCupom, normalizarCodigo, type DadosCupom, type DadosFatura } from "../src/lib/cupom";

const cupomBase = (over: Partial<DadosCupom> = {}): DadosCupom => ({
  tipo: "PERCENTUAL",
  valor: 10,
  servicoIds: [],
  validoAte: null,
  limiteUsos: null,
  usosRealizados: 0,
  ativo: true,
  ...over,
});

const faturaBase = (over: Partial<DadosFatura> = {}): DadosFatura => ({
  valorCentavos: 100_00, // R$ 100,00
  descontoCentavos: 0,
  servicoIds: ["s1"],
  ...over,
});

// ── Percentual ────────────────────────────────────────────────────────────

test("cupom percentual calcula 10% de R$ 100 = R$ 10", () => {
  const r = validarCupom(cupomBase(), faturaBase());
  assert.equal(r.valido, true);
  if (r.valido) assert.equal(r.descontoCentavos, 10_00);
});

test("cupom percentual de 50% sobre R$ 33,33 arredonda corretamente", () => {
  const r = validarCupom(cupomBase({ valor: 50 }), faturaBase({ valorCentavos: 33_33 }));
  assert.equal(r.valido, true);
  if (r.valido) assert.equal(r.descontoCentavos, 16_67); // Math.round(33.33 * 50 / 100) * 100 = 1666.5 → 1667
});

// ── Valor fixo ────────────────────────────────────────────────────────────

test("cupom valor fixo desconta R$ 25 de R$ 100", () => {
  const r = validarCupom(cupomBase({ tipo: "VALOR_FIXO", valor: 25_00 }), faturaBase());
  assert.equal(r.valido, true);
  if (r.valido) assert.equal(r.descontoCentavos, 25_00);
});

test("desconto fixo maior que a fatura é limitado ao valor da fatura", () => {
  const r = validarCupom(cupomBase({ tipo: "VALOR_FIXO", valor: 200_00 }), faturaBase());
  assert.equal(r.valido, true);
  if (r.valido) assert.equal(r.descontoCentavos, 100_00);
});

// ── Validade ──────────────────────────────────────────────────────────────

test("cupom expirado é recusado", () => {
  const ontem = new Date("2026-09-28T00:00:00Z");
  const r = validarCupom(cupomBase({ validoAte: ontem }), faturaBase(), new Date("2026-09-29T12:00:00Z"));
  assert.equal(r.valido, false);
  if (!r.valido) assert.ok(r.motivo.includes("expirou"));
});

test("cupom dentro da validade é aceito", () => {
  const amanha = new Date("2026-09-30T23:59:59Z");
  const r = validarCupom(cupomBase({ validoAte: amanha }), faturaBase(), new Date("2026-09-29T12:00:00Z"));
  assert.equal(r.valido, true);
});

// ── Limite de usos ────────────────────────────────────────────────────────

test("cupom esgotado é recusado", () => {
  const r = validarCupom(cupomBase({ limiteUsos: 5, usosRealizados: 5 }), faturaBase());
  assert.equal(r.valido, false);
  if (!r.valido) assert.ok(r.motivo.includes("limite"));
});

test("cupom com usos restantes é aceito", () => {
  const r = validarCupom(cupomBase({ limiteUsos: 5, usosRealizados: 4 }), faturaBase());
  assert.equal(r.valido, true);
});

test("cupom sem limite de usos é aceito com qualquer quantidade", () => {
  const r = validarCupom(cupomBase({ limiteUsos: null, usosRealizados: 999 }), faturaBase());
  assert.equal(r.valido, true);
});

// ── Elegibilidade por serviço ─────────────────────────────────────────────

test("cupom restrito a serviços aceita fatura com serviço elegível", () => {
  const r = validarCupom(cupomBase({ servicoIds: ["s1", "s2"] }), faturaBase({ servicoIds: ["s2", "s3"] }));
  assert.equal(r.valido, true);
});

test("cupom restrito a serviços recusa fatura sem serviço elegível", () => {
  const r = validarCupom(cupomBase({ servicoIds: ["s1"] }), faturaBase({ servicoIds: ["s99"] }));
  assert.equal(r.valido, false);
  if (!r.valido) assert.ok(r.motivo.includes("elegível"));
});

test("cupom sem restrição de serviço aceita qualquer fatura", () => {
  const r = validarCupom(cupomBase({ servicoIds: [] }), faturaBase({ servicoIds: ["qualquer"] }));
  assert.equal(r.valido, true);
});

// ── Desativado ────────────────────────────────────────────────────────────

test("cupom desativado é recusado", () => {
  const r = validarCupom(cupomBase({ ativo: false }), faturaBase());
  assert.equal(r.valido, false);
  if (!r.valido) assert.ok(r.motivo.includes("desativado"));
});

// ── Fatura já com desconto ────────────────────────────────────────────────

test("desconto não ultrapassa o líquido da fatura", () => {
  // Fatura de R$ 100 já com R$ 90 de desconto; cupom de 50% = R$ 50, mas só pode dar R$ 10.
  const r = validarCupom(
    cupomBase({ valor: 50 }),
    faturaBase({ valorCentavos: 100_00, descontoCentavos: 90_00 })
  );
  assert.equal(r.valido, true);
  if (r.valido) assert.equal(r.descontoCentavos, 10_00);
});

test("fatura já zerada recusa novo cupom", () => {
  const r = validarCupom(cupomBase(), faturaBase({ valorCentavos: 100_00, descontoCentavos: 100_00 }));
  assert.equal(r.valido, false);
  if (!r.valido) assert.ok(r.motivo.includes("zerada"));
});

// ── normalizarCodigo ──────────────────────────────────────────────────────

test("normalizarCodigo: maiúscula, sem espaço", () => {
  assert.equal(normalizarCodigo("  bem Vindo  2026  "), "BEMVINDO2026");
});
