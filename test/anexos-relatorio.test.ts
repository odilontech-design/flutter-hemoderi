import { test } from "node:test";
import assert from "node:assert/strict";
import { anexoAceito, anexosAceitos, tamanhoLegivel, MAXIMO_DE_ANEXOS } from "../src/lib/anexos-relatorio";

const foto = (size = 100_000) => ({ type: "image/jpeg", size, name: "foto.jpg" });

test("anexo: aceita foto e PDF leves", () => {
  assert.equal(anexoAceito(foto()), null);
  assert.equal(anexoAceito({ type: "application/pdf", size: 500_000 }), null);
});

test("anexo: recusa tipo estranho e arquivo grande", () => {
  assert.match(anexoAceito({ type: "application/zip", size: 10 })!, /não é aceito/);
  assert.match(anexoAceito(foto(3 * 1024 * 1024))!, /2 MB/);
});

test("anexo: limita a quantidade, contando os já guardados", () => {
  assert.match(anexosAceitos({ jaGuardados: MAXIMO_DE_ANEXOS - 1, novos: [foto(), foto()] })!, /No máximo/);
  assert.equal(anexosAceitos({ jaGuardados: 1, novos: [foto()] }), null);
});

test("anexo: o comprovante divide o limite do envio", () => {
  assert.match(anexosAceitos({ jaGuardados: 0, novos: [foto(1_900_000)], bytesDoComprovante: 2_500_000 })!, /limite do envio/);
});

test("anexo: escreve o tamanho", () => {
  assert.equal(tamanhoLegivel(2048), "2 KB");
  assert.equal(tamanhoLegivel(1_500_000), "1,4 MB");
});
