import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparPorFamilia, familiaDoNome, OUTROS } from "../src/lib/familia";

test("reconhece as famílias do catálogo real da Hemoderi", () => {
  assert.equal(familiaDoNome("Membranas – PRF"), "PRF");
  assert.equal(familiaDoNome("Stickybone / PRF Block"), "PRF");
  assert.equal(familiaDoNome("I-PRF Day"), "PRF");
  assert.equal(familiaDoNome("PRF para Harmonização"), "PRF");
  assert.equal(familiaDoNome("Piezosurgery Mectron Touch"), "Piezo");
  assert.equal(familiaDoNome("LiteTouch – Laser de Alta Potência"), "Laser");
  assert.equal(familiaDoNome("Laser Therapy EC + ILIB"), "Laser");
  assert.equal(familiaDoNome("GBT Machine – AirFlow"), "Profilaxia");
  assert.equal(familiaDoNome("Ultrassom Micro e Macrofocado – Atria®"), "Ultrassom");
  assert.equal(familiaDoNome("Megaderme® – Radiofrequência Microagulhada"), "Radiofrequência");
  assert.equal(familiaDoNome("Motor de Implante"), "Implante");
  assert.equal(familiaDoNome("Sedação Consciente"), "Sedação");
  assert.equal(familiaDoNome("Cobertura Fotográfica Odontológica"), "Fotografia");
});

test("nome que casa com duas famílias fica com o equipamento que define o procedimento", () => {
  // "Piezosurgery + Stickybone + Membranas" tem PRF dentro, mas o que manda
  // na agenda e no equipamento é o Piezo.
  assert.equal(familiaDoNome("Piezosurgery + Stickybone + Membranas"), "Piezo");
});

test("serviço não reconhecido cai em Outros, não some", () => {
  assert.equal(familiaDoNome("Procedimento novo sem padrão"), OUTROS);
});

test("a família cadastrada vence a inferida", () => {
  const grupos = agruparPorFamilia([{ nome: "Membranas – PRF", familia: "Regenerativos" }]);
  assert.equal(grupos[0].familia, "Regenerativos");
});

test("a vitrine abre pela família com mais opções", () => {
  const grupos = agruparPorFamilia([
    { nome: "Sedação Consciente" },
    { nome: "Membranas – PRF" },
    { nome: "I-PRF Day" },
    { nome: "PRF para Medicina" },
  ]);
  assert.equal(grupos[0].familia, "PRF");
  assert.equal(grupos[0].servicos.length, 3);
});

test("Outros fica sempre por último, mesmo sendo o maior grupo", () => {
  const grupos = agruparPorFamilia([
    { nome: "Coisa A" },
    { nome: "Coisa B" },
    { nome: "Coisa C" },
    { nome: "Sedação Consciente" },
  ]);
  assert.equal(grupos[grupos.length - 1].familia, OUTROS);
});

test("família de um item só é fundida em Outros — cabeçalho para uma linha é ruído", () => {
  const grupos = agruparPorFamilia([
    { nome: "Membranas – PRF" },
    { nome: "I-PRF Day" },
    { nome: "Sedação Consciente" },
    { nome: "Motor de Implante" },
  ]);
  assert.deepEqual(grupos.map((g) => g.familia), ["PRF", OUTROS]);
  assert.equal(grupos[1].servicos.length, 2, "Sedação e Implante caíram juntas em Outros");
});

test("sem nenhuma família com duas opções, o agrupamento é preservado", () => {
  // Fundir tudo aqui apagaria a única informação que a seção carrega.
  const grupos = agruparPorFamilia([{ nome: "Sedação Consciente" }, { nome: "Motor de Implante" }]);
  assert.deepEqual(grupos.map((g) => g.familia).sort(), ["Implante", "Sedação"]);
});

test("dentro da família, os serviços saem em ordem alfabética", () => {
  const grupos = agruparPorFamilia([
    { nome: "PRF para Medicina" },
    { nome: "I-PRF Day" },
    { nome: "Membranas – PRF" },
  ]);
  assert.deepEqual(grupos[0].servicos.map((s) => s.nome), [
    "I-PRF Day",
    "Membranas – PRF",
    "PRF para Medicina",
  ]);
});
