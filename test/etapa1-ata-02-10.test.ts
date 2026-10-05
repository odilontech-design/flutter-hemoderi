import { test } from "node:test";
import assert from "node:assert/strict";
import { procedimentoEscolhido } from "../src/lib/procedimentos";
import { formaDePagamentoValida } from "../src/lib/pagamento";
import { statusParaCliente, ROTULO_STATUS_CLIENTE } from "../src/lib/pedido";
import { camposFaltando, cadastroCompleto } from "../src/lib/cadastro-completo";

test("procedimento: opção da lista vale; fora dela não", () => {
  assert.equal(procedimentoEscolhido("Implante dentário", ""), "Implante dentário");
  assert.equal(procedimentoEscolhido("Qualquer coisa", ""), null);
  assert.equal(procedimentoEscolhido("", ""), null);
});

test("procedimento: 'Outros' exige o texto digitado", () => {
  assert.equal(procedimentoEscolhido("Outros", ""), null);
  assert.equal(procedimentoEscolhido("Outros", "   "), null);
  assert.equal(procedimentoEscolhido("Outros", " Rinoplastia "), "Outros: Rinoplastia");
});

test("forma de pagamento: só Pix, Dinheiro e Cheque", () => {
  assert.equal(formaDePagamentoValida("Pix"), true);
  assert.equal(formaDePagamentoValida("Cheque"), true);
  assert.equal(formaDePagamentoValida("Cartão"), false);
});

test("o cliente só vê solicitado, confirmado e cancelado antes do atendimento", () => {
  assert.equal(statusParaCliente("ALOCADO"), "CONFIRMADO");
  assert.equal(statusParaCliente("SOLICITADO"), "SOLICITADO");
  assert.equal(ROTULO_STATUS_CLIENTE.ALOCADO, "Confirmado");
  assert.equal(ROTULO_STATUS_CLIENTE.FALTOU, "Não realizado");
});

test("cadastro completo exige CNPJ/CPF, telefone e e-mail", () => {
  assert.deepEqual(camposFaltando({ cnpj: null, telefone: "", email: " " }), ["CNPJ ou CPF", "telefone", "e-mail"]);
  assert.deepEqual(camposFaltando({ cnpj: "12.345.678/0001-95", telefone: null, email: "a@b.com" }), ["telefone"]);
  assert.equal(cadastroCompleto({ cnpj: "123", telefone: "11999990000", email: "a@b.com" }), true);
});

import { aptoParaServico } from "../src/lib/aptidao";
import { opcoesDeEspecialidade } from "../src/lib/especialidades";

test("aptidão: sem serviços definidos vale para tudo; com definição, só para eles", () => {
  assert.equal(aptoParaServico([], "qualquer"), true);
  assert.equal(aptoParaServico(["a", "b"], "a"), true);
  assert.equal(aptoParaServico(["a", "b"], "c"), false);
});

test("especialidade legada continua nas opções até ser trocada", () => {
  assert.equal(opcoesDeEspecialidade("Enfermagem")[0], "Enfermagem");
  assert.equal(opcoesDeEspecialidade("Implantodontia — avançada")[0], "Implantodontia — avançada");
  assert.equal(opcoesDeEspecialidade(null).includes("Cirurgia oral"), true);
});
