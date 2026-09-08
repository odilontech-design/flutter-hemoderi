import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularRepasse, margemCentavos } from "../src/lib/repasse";

const VALOR = 20_000; // R$ 200,00

test("sem nenhuma regra, vale o padrão da operação", () => {
  const r = calcularRepasse({ valorServicoCentavos: VALOR, percentPadrao: 60 });
  assert.equal(r.valorCentavos, 12_000);
  assert.equal(r.origem, "PADRAO");
});

test("percentual do profissional vence o padrão da operação", () => {
  const r = calcularRepasse({
    valorServicoCentavos: VALOR,
    profissional: { repassePercentPadrao: 70 },
    percentPadrao: 60,
  });
  assert.equal(r.valorCentavos, 14_000);
  assert.equal(r.origem, "PROFISSIONAL");
});

test("regra do serviço vence o percentual do profissional", () => {
  // O caso real: procedimento em que a Hemoderi banca o insumo e repassa menos.
  const r = calcularRepasse({
    valorServicoCentavos: VALOR,
    servico: { repassePercent: 40, repasseFixoCentavos: null },
    profissional: { repassePercentPadrao: 70 },
    percentPadrao: 60,
  });
  assert.equal(r.valorCentavos, 8_000);
  assert.equal(r.origem, "SERVICO");
});

test("acerto do par profissional × serviço vence tudo", () => {
  const r = calcularRepasse({
    valorServicoCentavos: VALOR,
    regra: { percent: null, fixoCentavos: 9_000 },
    servico: { repassePercent: 40, repasseFixoCentavos: null },
    profissional: { repassePercentPadrao: 70 },
    percentPadrao: 60,
  });
  assert.equal(r.valorCentavos, 9_000);
  assert.equal(r.origem, "REGRA_ESPECIFICA");
  assert.equal(r.percent, null);
});

test("regra vazia não conta como regra", () => {
  const r = calcularRepasse({
    valorServicoCentavos: VALOR,
    regra: { percent: null, fixoCentavos: null },
    percentPadrao: 50,
  });
  assert.equal(r.origem, "PADRAO");
  assert.equal(r.valorCentavos, 10_000);
});

test("arredonda meio centavo para cima, sem sobra de ponto flutuante", () => {
  // 12,5% de R$ 100,10 = 1251,25 centavos
  const r = calcularRepasse({ valorServicoCentavos: 10_010, percentPadrao: 12.5 });
  assert.equal(r.valorCentavos, 1_251);
  assert.equal(Number.isInteger(r.valorCentavos), true);
});

test("a margem é o que sobra do valor da clínica", () => {
  assert.equal(margemCentavos(VALOR, 12_000), 8_000);
});
