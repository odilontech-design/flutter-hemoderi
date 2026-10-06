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
