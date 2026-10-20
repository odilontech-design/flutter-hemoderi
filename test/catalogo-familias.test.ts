import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIAS_DO_CATALOGO } from "../src/lib/familia";
import { DESCRITIVO_DAS_FAMILIAS, descritivoDaFamilia } from "../src/lib/catalogo-familias";

test("catálogo: toda seção do catálogo tem descritivo e imagem", () => {
  for (const familia of CATEGORIAS_DO_CATALOGO) {
    const d = descritivoDaFamilia(familia);
    assert.ok(d, `sem descritivo para ${familia}`);
    assert.ok(d.blocos.length > 0, `descritivo vazio em ${familia}`);
    assert.ok(existsSync(join(process.cwd(), "public", d.imagem)), `imagem ausente: ${d.imagem}`);
  }
});

test("catálogo: não há descritivo órfão (chave que não é seção do catálogo)", () => {
  const validas = new Set<string>(CATEGORIAS_DO_CATALOGO);
  for (const chave of Object.keys(DESCRITIVO_DAS_FAMILIAS)) assert.ok(validas.has(chave), `chave órfã: ${chave}`);
});

test("catálogo: cada bloco tem título e ao menos texto ou itens", () => {
  for (const [familia, d] of Object.entries(DESCRITIVO_DAS_FAMILIAS)) {
    for (const b of d.blocos) {
      assert.ok(b.titulo.trim(), `bloco sem título em ${familia}`);
      assert.ok(b.texto?.trim() || (b.itens && b.itens.length > 0), `bloco vazio em ${familia}: ${b.titulo}`);
    }
  }
});

test("catálogo: família desconhecida não tem descritivo", () => {
  assert.equal(descritivoDaFamilia("Laser"), null);
});

import { familiaDoNome } from "../src/lib/familia";

test("CO2 Fracionado (catálogo de outubro) é uma família própria, não 'Laser'", () => {
  assert.equal(familiaDoNome("Laser CO2 Fracionado – Essencial 4 horas"), "Laser CO2 Fracionado");
  assert.equal(familiaDoNome("CO2 Curso – por paciente"), "Laser CO2 Fracionado");
  assert.equal(familiaDoNome("Laser Therapy EC + ILIB"), "Laser Therapy EC");
});

import { agruparPorFamilia } from "../src/lib/familia";
import { SERVICOS_DO_CATALOGO, ALTERADOS_NO_CATALOGO_OUT26 } from "../src/lib/inicializar";
import { descricaoDoPreco, totalDoItem } from "../src/lib/cobranca";

test("catálogo de outubro: preços da tabela do PDF", () => {
  const valor = (nome: string) => SERVICOS_DO_CATALOGO.find((s) => s.nome === nome)?.valorPadraoCentavos;
  assert.equal(valor("AirFlow – GBT Machine (pacote 5 pacientes)"), 182_500);
  assert.equal(valor("Megaderme – Pacote 3 Pacientes"), 201_000);
  assert.equal(valor("Laser CO2 Fracionado – Assistido 8 horas"), 249_000);
  assert.equal(valor("Stickybone + Membranas + Piezo + Sedação"), 169_000);
  // Sessão do ultrassom: 500 disparos = R$ 1.195,00; 600 = + 100 × R$ 1,89
  assert.equal(totalDoItem(119_500, 600, { quantidadeIncluida: 500, valorAdicionalCentavos: 189 }), 138_400);
  // AirFlow 9+: R$ 330 por paciente
  assert.equal(totalDoItem(33_000, 10, { quantidadeIncluida: null }), 330_000);
  for (const nome of ALTERADOS_NO_CATALOGO_OUT26) assert.ok(valor(nome), nome);
});

test("dentro da família, do mais barato ao mais caro", () => {
  const [grupo] = agruparPorFamilia(
    [
      { nome: "Ultrassom – Alto volume", familia: "U", valorPadraoCentavos: 507_000 },
      { nome: "Ultrassom – Sessão", familia: "U", valorPadraoCentavos: 119_500 },
      { nome: "Ultrassom – Dia completo", familia: "U", valorPadraoCentavos: 286_400 },
    ],
    { fundirSolitarias: false }
  );
  assert.deepEqual(grupo.servicos.map((s) => s.nome), ["Ultrassom – Sessão", "Ultrassom – Dia completo", "Ultrassom – Alto volume"]);
  assert.equal(
    descricaoDoPreco(507_000, { unidadeCobranca: "PERIODO", quantidadeIncluida: 3000, valorAdicionalCentavos: 169, rotuloQuantidade: "disparos" }).replace(/\u00a0/g, " "),
    "R$ 5.070,00 até 3.000 disparos + R$ 1,69 por disparo adicional"
  );
});

test("preço por unidade com mínimo ordena pelo total mínimo", () => {
  const [grupo] = agruparPorFamilia(
    [
      { nome: "AirFlow (9 ou mais)", familia: "A", valorPadraoCentavos: 33_000, permiteQuantidade: true, quantidadeMinima: 9, quantidadeIncluida: null },
      { nome: "AirFlow (1 paciente)", familia: "A", valorPadraoCentavos: 50_000 },
      { nome: "AirFlow (pacote 8)", familia: "A", valorPadraoCentavos: 272_000 },
    ],
    { fundirSolitarias: false }
  );
  assert.deepEqual(grupo.servicos.map((s) => s.nome), ["AirFlow (1 paciente)", "AirFlow (pacote 8)", "AirFlow (9 ou mais)"]);
});
