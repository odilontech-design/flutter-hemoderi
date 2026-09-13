import { test } from "node:test";
import assert from "node:assert/strict";
import { conferirSenhaNova, gerarSenha } from "../src/lib/senha";

test("a senha gerada sai no formato ditável, em grupos de quatro", () => {
  assert.match(gerarSenha(), /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
});

test("a senha gerada não usa os símbolos que se confundem ao ditar", () => {
  // 400 sorteios cobrem 4800 posições: se I/O/0/1 estivessem no alfabeto,
  // apareceriam com folga.
  for (let i = 0; i < 400; i++) {
    assert.doesNotMatch(gerarSenha(), /[IO01]/, "símbolo ambíguo na senha gerada");
  }
});

test("duas senhas seguidas não se repetem", () => {
  const sorteadas = new Set(Array.from({ length: 200 }, () => gerarSenha()));
  assert.equal(sorteadas.size, 200);
});

test("senha curta é recusada", () => {
  assert.equal(conferirSenhaNova("1234567", "1234567"), "A senha precisa ter ao menos 8 caracteres.");
});

test("confirmação diferente é recusada", () => {
  assert.match(conferirSenhaNova("umasenhaboa", "outrasenha") ?? "", /confirmação/i);
});

test("senha vazia é recusada antes de qualquer outra regra", () => {
  assert.equal(conferirSenhaNova("", ""), "Informe a nova senha.");
});

test("senha válida passa", () => {
  assert.equal(conferirSenhaNova("umasenhaboa", "umasenhaboa"), null);
});
