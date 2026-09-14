import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cepValido,
  cnpjValido,
  cpfValido,
  formatarCep,
  formatarCnpj,
  formatarCpf,
} from "../src/lib/documento";

test("aceita CPF com dígito verificador correto", () => {
  assert.equal(cpfValido("529.982.247-25"), true);
  assert.equal(cpfValido("52998224725"), true);
});

test("recusa CPF com dígito trocado — o erro de digitação mais comum", () => {
  assert.equal(cpfValido("529.982.247-52"), false);
});

test("recusa CPF de dígito repetido, que passa na conta mas não existe", () => {
  assert.equal(cpfValido("111.111.111-11"), false);
  assert.equal(cpfValido("000.000.000-00"), false);
});

test("recusa CPF de tamanho errado", () => {
  assert.equal(cpfValido("5299822472"), false);
  assert.equal(cpfValido(""), false);
});

test("aceita CNPJ com dígito verificador correto", () => {
  assert.equal(cnpjValido("11.222.333/0001-81"), true);
  assert.equal(cnpjValido("35.272.539/0001-84"), true);
});

test("o CNPJ que está cadastrado como padrão da operação NÃO passa", () => {
  // Achado ao escrever esta validação: o valor gravado em
  // Parametros.cnpj termina em 89, e os doze primeiros dígitos exigem 84.
  // Fica registrado aqui para que a correção do cadastro seja uma decisão
  // consciente, com o número conferido — e não um ajuste silencioso feito
  // por quem não tem o cartão CNPJ à mão.
  assert.equal(cnpjValido("35.272.539/0001-89"), false);
});

test("recusa CNPJ com dígito trocado e de dígito repetido", () => {
  assert.equal(cnpjValido("35.272.539/0001-98"), false);
  assert.equal(cnpjValido("11.111.111/1111-11"), false);
});

test("CEP é conferido pelo formato — não tem dígito verificador", () => {
  assert.equal(cepValido("01310-100"), true);
  assert.equal(cepValido("01310100"), true);
  assert.equal(cepValido("0131010"), false);
});

test("a máscara acompanha o que já foi digitado, sem completar sozinha", () => {
  assert.equal(formatarCpf("529"), "529");
  assert.equal(formatarCpf("529982"), "529.982");
  assert.equal(formatarCpf("52998224725"), "529.982.247-25");
  assert.equal(formatarCnpj("35272539000189"), "35.272.539/0001-89");
  assert.equal(formatarCep("01310100"), "01310-100");
});
