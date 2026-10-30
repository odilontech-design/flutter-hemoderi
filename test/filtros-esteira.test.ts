import test from "node:test";
import assert from "node:assert/strict";
import { consultaDosFiltros, lerFiltrosEsteira, numeroDaBusca, ondeDosFiltros } from "../src/lib/filtros-esteira";

test("busca por código acha o número do atendimento", () => {
  assert.equal(numeroDaBusca("2026-0051"), 51);
  assert.equal(numeroDaBusca("2026-0051-DRERICMOTA"), 51);
  assert.equal(numeroDaBusca("51"), 51);
  assert.equal(numeroDaBusca("Dr Eric"), null);
});

test("filtros viram cláusula e voltam para a URL", () => {
  const f = lerFiltrosEsteira({ q: "eric", periodo: "hoje", prof: "sem", pagamento: "Faturado", lixo: "x" });
  const onde = ondeDosFiltros(f, new Date("2026-10-30T00:00:00Z")) as { AND: unknown[] };
  assert.equal(onde.AND.length, 4);
  assert.equal(consultaDosFiltros(f, { filtro: "alocar" }), "filtro=alocar&q=eric&periodo=hoje&prof=sem&pagamento=Faturado");
  assert.deepEqual(ondeDosFiltros(lerFiltrosEsteira({}), new Date()), {});
});

test("período inválido e datas mal formadas são ignorados", () => {
  const f = lerFiltrosEsteira({ periodo: "ontem", de: "30/10/2026" });
  assert.equal(f.periodo, "");
  assert.equal(f.de, "");
});
