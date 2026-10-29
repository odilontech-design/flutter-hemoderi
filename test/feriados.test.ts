import { test } from "node:test";
import assert from "node:assert/strict";
import { feriadosDoAno, pascoa, semExpediente } from "../src/lib/feriados";

test("Páscoa de 2026 é 5 de abril", () => {
  assert.equal(pascoa(2026).toISOString().slice(0, 10), "2026-04-05");
});

test("feriados móveis e fixos de 2026", () => {
  const f = feriadosDoAno(2026);
  for (const dia of ["2026-02-16", "2026-02-17", "2026-04-03", "2026-06-04", "2026-07-09", "2026-11-20", "2026-12-25"]) {
    assert.equal(f.has(dia), true, dia);
  }
  assert.equal(f.has("2026-11-10"), false);
});

test("semExpediente: fim de semana e feriado sim, dia útil não", () => {
  assert.equal(semExpediente("2026-11-07"), true); // sábado
  assert.equal(semExpediente("2026-11-08"), true); // domingo
  assert.equal(semExpediente("2026-11-20"), true); // Consciência Negra
  assert.equal(semExpediente("2026-11-10"), false); // terça
});
