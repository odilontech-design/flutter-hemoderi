import { test } from "node:test";
import assert from "node:assert/strict";
import { codigoDoPedido, siglaDaClinica } from "../src/lib/numeracao";

const DATA = new Date("2026-09-14T00:00:00.000Z");

test("o código traz ano, sequencial e clínica", () => {
  assert.equal(codigoDoPedido(412, "Clínica Santa Rita", DATA), "2026-0412-SANTARITA");
});

test("o sequencial é preenchido com zeros para ordenar e ditar", () => {
  assert.equal(codigoDoPedido(7, "Santa Rita", DATA), "2026-0007-SANTARITA");
  assert.equal(codigoDoPedido(12345, "Santa Rita", DATA), "2026-12345-SANTARITA");
});

test("palavras que toda clínica tem no nome não entram na sigla", () => {
  assert.equal(siglaDaClinica("Clínica Santa Rita"), "SANTARITA");
  assert.equal(siglaDaClinica("Instituto Vida Plena"), "VIDAPLENA");
  assert.equal(siglaDaClinica("Centro de Odontologia Aurora"), "AURORA");
});

test("acento e pontuação saem — o código é ditado por telefone", () => {
  assert.equal(siglaDaClinica("Clínica São José"), "SAOJOSE");
  assert.equal(siglaDaClinica("Odonto & Cia."), "CIA");
});

test("nome inteiro genérico usa o nome mesmo, em vez de devolver vazio", () => {
  assert.equal(siglaDaClinica("Clínica Odontológica"), "CLINICAODO");
});

test("o ano vem da data do atendimento, não do relógio de hoje", () => {
  assert.equal(codigoDoPedido(1, "Santa Rita", new Date("2027-01-02T00:00:00.000Z")), "2027-0001-SANTARITA");
});
