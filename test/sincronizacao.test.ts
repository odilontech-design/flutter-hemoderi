import { test } from "node:test";
import assert from "node:assert/strict";
import { pendenciasDeSincronizacao, type TentativaSync } from "../src/lib/sincronizacao";

const t = (over: Partial<TentativaSync>): TentativaSync => ({
  entidadeId: "p1",
  acao: "criar-negocio",
  sucesso: false,
  criadaEm: new Date("2026-03-10T10:00:00Z"),
  erro: null,
  ...over,
});

test("uma falha sem sucesso posterior é pendência", () => {
  const p = pendenciasDeSincronizacao([t({ erro: "HTTP 500" })]);
  assert.equal(p.length, 1);
  assert.equal(p[0].entidadeId, "p1");
  assert.equal(p[0].erro, "HTTP 500");
});

test("sucesso posterior à falha resolve a pendência", () => {
  // O caso do reprocessamento: falhou às 10h, deu certo às 11h. Não pode
  // aparecer como pendência — é o ruído que faz a equipe largar o painel.
  const p = pendenciasDeSincronizacao([
    t({ criadaEm: new Date("2026-03-10T10:00:00Z"), sucesso: false }),
    t({ criadaEm: new Date("2026-03-10T11:00:00Z"), sucesso: true }),
  ]);
  assert.deepEqual(p, []);
});

test("falha depois de um sucesso volta a ser pendência", () => {
  // Criou o negócio (ok), mas o marcar-ganho da MESMA ação falhou depois.
  const p = pendenciasDeSincronizacao([
    t({ criadaEm: new Date("2026-03-10T11:00:00Z"), sucesso: true }),
    t({ criadaEm: new Date("2026-03-10T12:00:00Z"), sucesso: false, erro: "recusado" }),
  ]);
  assert.equal(p.length, 1);
  assert.equal(p[0].erro, "recusado");
});

test("a ordem das linhas na entrada não importa, só o instante", () => {
  // O sucesso é o mais recente mesmo vindo antes na lista.
  const p = pendenciasDeSincronizacao([
    t({ criadaEm: new Date("2026-03-10T11:00:00Z"), sucesso: true }),
    t({ criadaEm: new Date("2026-03-10T10:00:00Z"), sucesso: false }),
  ]);
  assert.deepEqual(p, []);
});

test("cada ação do mesmo pedido é uma pendência independente", () => {
  // criar-negocio resolveu, marcar-ganho não: só a segunda é pendência.
  const p = pendenciasDeSincronizacao([
    t({ acao: "criar-negocio", sucesso: true, criadaEm: new Date("2026-03-10T10:00:00Z") }),
    t({ acao: "marcar-ganho", sucesso: false, criadaEm: new Date("2026-03-10T11:00:00Z"), erro: "sem negócio" }),
  ]);
  assert.equal(p.length, 1);
  assert.equal(p[0].acao, "marcar-ganho");
});

test("pendências de pedidos diferentes coexistem, mais recente primeiro", () => {
  const p = pendenciasDeSincronizacao([
    t({ entidadeId: "p1", criadaEm: new Date("2026-03-10T10:00:00Z") }),
    t({ entidadeId: "p2", criadaEm: new Date("2026-03-11T10:00:00Z") }),
  ]);
  assert.deepEqual(
    p.map((x) => x.entidadeId),
    ["p2", "p1"]
  );
});

test("sem tentativas, nenhuma pendência", () => {
  assert.deepEqual(pendenciasDeSincronizacao([]), []);
});
