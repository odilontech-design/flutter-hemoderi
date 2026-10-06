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

import { statusDeChegada } from "../src/lib/atraso";
import { instanteDoAtendimento } from "../src/lib/data";

test("chegada: registrou, atrasou além da tolerância, aguardando", () => {
  const data = new Date("2026-10-05T00:00:00.000Z");
  const marca = instanteDoAtendimento(data, "15:00");
  const em = (min: number) => new Date(marca.getTime() + min * 60_000);

  assert.deepEqual(statusDeChegada(data, "15:00", em(5), em(30)), { tipo: "chegou", minutos: 5, atrasado: false });
  assert.deepEqual(statusDeChegada(data, "15:00", em(25), em(30)), { tipo: "chegou", minutos: 25, atrasado: true });
  assert.deepEqual(statusDeChegada(data, "15:00", null, em(5)), { tipo: "aguardando" });
  assert.deepEqual(statusDeChegada(data, "15:00", null, em(20)), { tipo: "atrasado", minutos: 20 });
  assert.deepEqual(statusDeChegada(data, "15:00", null, em(-60)), { tipo: "aguardando" });
});

import { situacaoDoPagamento } from "../src/lib/pagamento-cliente";

test("pagamento do cliente: pago pela fatura ou no ato; pendente nos demais realizados", () => {
  assert.equal(situacaoDoPagamento({ status: "REALIZADO", fatura: { status: "PAGA" } }), "pago");
  assert.equal(situacaoDoPagamento({ status: "REALIZADO", fatura: null, recebidoNoAto: true }), "pago");
  assert.equal(situacaoDoPagamento({ status: "REALIZADO", fatura: { status: "ABERTA" } }), "pendente");
  assert.equal(situacaoDoPagamento({ status: "REALIZADO", fatura: null }), "pendente");
  assert.equal(situacaoDoPagamento({ status: "FALTOU", fatura: null }), null);
});

import { conselhoValido, registroDeConselho } from "../src/lib/conselhos";

test("conselho: lista fechada; registro precisa ter número e tamanho razoável", () => {
  assert.equal(conselhoValido("CRO"), true);
  assert.equal(conselhoValido("XYZ"), false);
  assert.equal(registroDeConselho(" sp-12345 "), "SP-12345");
  assert.equal(registroDeConselho("12.345"), "12.345");
  assert.equal(registroDeConselho("ab"), null);
  assert.equal(registroDeConselho("SEMNUMERO"), null);
  assert.equal(registroDeConselho("1".repeat(21)), null);
});
