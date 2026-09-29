import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarTxid } from "../src/lib/integracoes/santander-pix";

test("gerarTxid: comprimento entre 26 e 35 caracteres", () => {
  const txid = gerarTxid();
  assert.ok(txid.length >= 26, `Muito curto: ${txid.length}`);
  assert.ok(txid.length <= 35, `Muito longo: ${txid.length}`);
});

test("gerarTxid: só alfanuméricos", () => {
  const txid = gerarTxid();
  assert.match(txid, /^[A-Za-z0-9]+$/);
});

test("gerarTxid: começa com HEM", () => {
  const txid = gerarTxid();
  assert.ok(txid.startsWith("HEM"));
});

test("gerarTxid: gera valores únicos", () => {
  const ids = new Set(Array.from({ length: 100 }, () => gerarTxid()));
  assert.equal(ids.size, 100, "Colisão detectada em 100 gerações");
});

test("gerarTxid: mantém o formato BACEN", () => {
  for (let i = 0; i < 50; i++) {
    const txid = gerarTxid();
    assert.match(txid, /^[A-Za-z0-9]{26,35}$/, `BACEN inválido: ${txid}`);
  }
});
