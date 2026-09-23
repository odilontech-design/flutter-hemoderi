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

test("valor fixo do profissional vence o percentual dele", () => {
  // Decisão da ata de 14/09: repasse é valor fechado, não fatia do que a
  // clínica paga. Quando os dois campos existem, o fixo é o acerto atual.
  const r = calcularRepasse({
    valorServicoCentavos: VALOR,
    profissional: { repassePercentPadrao: 70, repasseFixoCentavos: 9_000 },
    percentPadrao: 60,
  });
  assert.equal(r.valorCentavos, 9_000);
  assert.equal(r.origem, "PROFISSIONAL");
  assert.equal(r.percent, null, "valor fixo não tem percentual para explicar");
});

test("a regra do serviço ainda vence o valor fixo do profissional", () => {
  const r = calcularRepasse({
    valorServicoCentavos: VALOR,
    servico: { repassePercent: null, repasseFixoCentavos: 5_000 },
    profissional: { repassePercentPadrao: null, repasseFixoCentavos: 9_000 },
    percentPadrao: 60,
  });
  assert.equal(r.valorCentavos, 5_000);
  assert.equal(r.origem, "SERVICO");
});

// ── Grupo de repasse (ata de 21/09) ─────────────────────────────────────────

test("grupo de repasse vence o padrão da operação", () => {
  const r = calcularRepasse({
    valorServicoCentavos: VALOR,
    grupo: { percent: 65, fixoCentavos: null },
    percentPadrao: 60,
  });
  assert.equal(r.valorCentavos, 13_000);
  assert.equal(r.origem, "GRUPO");
});

test("valor fixo do grupo vence o percentual do grupo", () => {
  const r = calcularRepasse({
    valorServicoCentavos: VALOR,
    grupo: { percent: 65, fixoCentavos: 11_000 },
    percentPadrao: 60,
  });
  assert.equal(r.valorCentavos, 11_000);
  assert.equal(r.origem, "GRUPO");
  assert.equal(r.percent, null);
});

test("o profissional é sempre a exceção — vence o grupo dele", () => {
  const r = calcularRepasse({
    valorServicoCentavos: VALOR,
    profissional: { repassePercentPadrao: 80 },
    grupo: { percent: 65, fixoCentavos: null },
    percentPadrao: 60,
  });
  assert.equal(r.valorCentavos, 16_000);
  assert.equal(r.origem, "PROFISSIONAL");
});

test("a regra do serviço ainda vence o grupo", () => {
  const r = calcularRepasse({
    valorServicoCentavos: VALOR,
    servico: { repassePercent: 40, repasseFixoCentavos: null },
    grupo: { percent: 65, fixoCentavos: null },
    percentPadrao: 60,
  });
  assert.equal(r.valorCentavos, 8_000);
  assert.equal(r.origem, "SERVICO");
});

test("grupo vazio não conta como grupo", () => {
  const r = calcularRepasse({
    valorServicoCentavos: VALOR,
    grupo: { percent: null, fixoCentavos: null },
    percentPadrao: 60,
  });
  assert.equal(r.origem, "PADRAO");
});
