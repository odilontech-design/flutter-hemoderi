import { test } from "node:test";
import assert from "node:assert/strict";
import { escolherDono } from "../src/lib/integracoes/pipedrive";

const usuarios = [
  { id: 1, name: "André Miguel", email: "andre@hemoderi.com.br" },
  { id: 2, name: "Sthefany Souza", email: "sthefany.s@gmail.com" },
  { id: 3, name: "Sthefany Antiga", email: "antiga@x.com", active_flag: false },
];

test("e-mail exato vale primeiro", () => {
  assert.equal(escolherDono(usuarios, "andre@hemoderi.com.br", "sthefany"), 1);
});

test("e-mail diferente: acha pelo nome entre os ativos", () => {
  assert.equal(escolherDono(usuarios, "sthefany@hemoderi.com.br", "sthefany"), 2);
});

test("nome ambíguo ou ausente não adivinha", () => {
  const dois = [...usuarios, { id: 4, name: "Sthefany Dois", email: "d@x.com" }];
  assert.equal(escolherDono(dois, "sthefany@hemoderi.com.br", "sthefany"), null);
  assert.equal(escolherDono(usuarios, "x@y.com", "fulana"), null);
});
