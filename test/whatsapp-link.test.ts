import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarTelefone, linkWhatsapp, mensagemDeUrgencia, numeroParaWhatsapp } from "../src/lib/whatsapp-link";

test("completa o código do país quando o cadastro veio sem ele", () => {
  assert.equal(numeroParaWhatsapp("(11) 99477-2191"), "5511994772191");
  assert.equal(numeroParaWhatsapp("11994772191"), "5511994772191");
});

test("não duplica o código do país de um número que já o tem", () => {
  assert.equal(numeroParaWhatsapp("5511994772191"), "5511994772191");
});

test("número curto demais não vira link — melhor nada que link quebrado", () => {
  assert.equal(numeroParaWhatsapp("1234"), null);
  assert.equal(numeroParaWhatsapp(""), null);
  assert.equal(numeroParaWhatsapp(null), null);
  assert.equal(linkWhatsapp(null, "oi"), null);
});

test("a mensagem vai codificada na URL", () => {
  const url = linkWhatsapp("11994772191", "Olá! Preciso de ajuda");
  assert.equal(url, "https://wa.me/5511994772191?text=Ol%C3%A1!%20Preciso%20de%20ajuda");
});

test("a mensagem de urgência carrega o que a clínica já tinha preenchido", () => {
  const texto = mensagemDeUrgencia({
    clinica: "Clínica Santa Rita",
    servico: "Aplicação de PRF",
    data: "15/09",
    hora: "14:00",
    doutor: "Dra. Marina",
  });
  assert.match(texto, /Clínica Santa Rita/);
  assert.match(texto, /Aplicação de PRF/);
  assert.match(texto, /15\/09 às 14:00/);
  assert.match(texto, /Dra\. Marina/);
});

test("campo vazio não vira linha em branco na mensagem", () => {
  const texto = mensagemDeUrgencia({ clinica: "Santa Rita" });
  assert.doesNotMatch(texto, /Serviço:/);
  assert.doesNotMatch(texto, /Paciente:/);
  assert.match(texto, /Clínica: Santa Rita/);
});

test("a máscara do telefone acompanha o tanto de dígito já digitado", () => {
  assert.equal(formatarTelefone(""), "");
  assert.equal(formatarTelefone("1"), "(1");
  assert.equal(formatarTelefone("11"), "(11");
  assert.equal(formatarTelefone("119947"), "(11) 9947");
  assert.equal(formatarTelefone("1199477219"), "(11) 9947-7219");
  assert.equal(formatarTelefone("11994772191"), "(11) 99477-2191");
});

test("a máscara do telefone ignora o que não é dígito e trava em 11", () => {
  assert.equal(formatarTelefone("(11) 99477-2191"), "(11) 99477-2191");
  assert.equal(formatarTelefone("11994772191999"), "(11) 99477-2191");
});
