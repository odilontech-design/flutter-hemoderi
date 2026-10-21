import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pracaDoAtendimento } from "../src/lib/praca";
import { calcularRepasse } from "../src/lib/repasse";
import { lerAbaXlsx } from "../src/lib/xlsx-leitor";
import { lerRegrasDaPlanilha } from "../src/lib/repasse-planilha";

test("praça do atendimento: Grande SP pela cidade, interior, RJ/PR/ES e demais", () => {
  assert.equal(pracaDoAtendimento({ uf: "SP", cidade: "São Paulo" }), "GRANDE_SP");
  assert.equal(pracaDoAtendimento({ uf: "sp", cidade: "sao bernardo do campo" }), "GRANDE_SP");
  assert.equal(pracaDoAtendimento({ uf: "SP", cidade: "Embu" }), "GRANDE_SP");
  assert.equal(pracaDoAtendimento({ uf: "SP", cidade: "Campinas" }), "INTERIOR_SP");
  assert.equal(pracaDoAtendimento({ uf: "SP", cidade: null }), "INTERIOR_SP");
  assert.equal(pracaDoAtendimento({ uf: "RJ", cidade: "Niterói" }), "RJ");
  assert.equal(pracaDoAtendimento({ uf: "PR" }), "PR");
  assert.equal(pracaDoAtendimento({ uf: "MG", cidade: "Belo Horizonte" }), "OUTROS");
  assert.equal(pracaDoAtendimento({}), "OUTROS");
});

test("repasse: a praça vence a regra do serviço e perde para o acerto específico", () => {
  const base = { valorServicoCentavos: 50_000, percentPadrao: 50 };
  assert.deepEqual(calcularRepasse({ ...base, praca: { percent: 60, fixoCentavos: null }, servico: { repassePercent: 40, repasseFixoCentavos: null } }), {
    valorCentavos: 30_000,
    origem: "PRACA",
    percent: 60,
  });
  assert.equal(calcularRepasse({ ...base, praca: { percent: null, fixoCentavos: 30_000 } }).valorCentavos, 30_000);
  assert.equal(
    calcularRepasse({ ...base, regra: { percent: 70, fixoCentavos: null }, praca: { percent: 60, fixoCentavos: null } }).origem,
    "REGRA_ESPECIFICA"
  );
  assert.equal(calcularRepasse({ ...base, praca: null }).origem, "PADRAO");
});

test("repasse: o valor fixo do profissional vale (antes não chegava ao cálculo)", () => {
  const r = calcularRepasse({ valorServicoCentavos: 50_000, percentPadrao: 50, profissional: { repassePercentPadrao: 65, repasseFixoCentavos: 20_000 } });
  assert.deepEqual(r, { valorCentavos: 20_000, origem: "PROFISSIONAL", percent: null });
});

test("planilha de repasses: lê % (fração ou número), fixo, e o fixo vence", () => {
  const buf = readFileSync(join(__dirname, "fixtures", "repasses-por-praca.xlsx"));
  const linhas = lerAbaXlsx(buf, "Repasses");
  const { regras, problemas } = lerRegrasDaPlanilha(linhas);
  assert.deepEqual(problemas, []);
  const de = (servico: string, praca: string) => regras.find((r) => r.servico.startsWith(servico) && r.praca === praca);
  assert.deepEqual(
    { p: de("AirFlow – GBT Machine (1 paciente)", "GRANDE_SP")?.percent, f: de("AirFlow – GBT Machine (1 paciente)", "GRANDE_SP")?.fixoCentavos },
    { p: 60, f: null }
  );
  assert.equal(de("AirFlow – GBT Machine (1 paciente)", "RJ")?.fixoCentavos, 30_000);
  assert.equal(de("AirFlow – GBT Machine (pacote 2", "GRANDE_SP")?.fixoCentavos, 42_000);
  assert.equal(de("AirFlow – GBT Machine (pacote 3", "INTERIOR_SP")?.percent, 65);
  const ambos = de("AirFlow – GBT Machine (pacote 4", "GRANDE_SP");
  assert.deepEqual({ p: ambos?.percent, f: ambos?.fixoCentavos }, { p: null, f: 50_000 });
  // A linha EXEMPLO (65% no topo) não entra.
  assert.equal(regras.length, 5);
});
