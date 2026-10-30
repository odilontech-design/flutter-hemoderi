import test from "node:test";
import assert from "node:assert/strict";
import { formatarDocumento, numeroDoRecibo, pagadorDoRecibo, totalDosItens } from "../src/lib/recibo";

test("número do recibo: quatro dígitos, travessão e ano", () => {
  assert.equal(numeroDoRecibo(681, 2026), "0681 – 2026");
  assert.equal(numeroDoRecibo(12, 2026, "F"), "F0012 – 2026");
});

test("documento sai como CPF ou CNPJ conforme o tamanho", () => {
  assert.equal(formatarDocumento("12014152845"), "120.141.528-45");
  assert.equal(formatarDocumento("35272539000184"), "35.272.539/0001-84");
  assert.equal(formatarDocumento(null), "");
});

const clinica = {
  nome: "Clínica Sorriso",
  cnpj: "35272539000184",
  financeiroNome: null,
  financeiroDocumento: null,
  endereco: "Rua São Judas Tadeu",
  numero: "56",
  complemento: null,
  bairro: "Centro",
  cidade: "Diadema",
  uf: "SP",
  cep: "09911100",
};

test("pagador: a própria clínica, ou o responsável financeiro quando há", () => {
  assert.equal(pagadorDoRecibo(clinica).nome, "Clínica Sorriso");
  assert.equal(pagadorDoRecibo(clinica).documento, "35.272.539/0001-84");
  assert.equal(pagadorDoRecibo(clinica).endereco, "Rua São Judas Tadeu, 56, Centro");
  assert.equal(pagadorDoRecibo(clinica).cep, "09911-100");
  const socio = pagadorDoRecibo({ ...clinica, financeiroNome: "Carlos Tamai", financeiroDocumento: "12014152845" });
  assert.equal(socio.nome, "Carlos Tamai");
  assert.equal(socio.documento, "120.141.528-45");
});

test("total soma os itens, desconto incluído", () => {
  assert.equal(
    totalDosItens([
      { unidade: "Proc", quantidade: 1, descricao: "a", unitarioCentavos: 60000, totalCentavos: 60000 },
      { unidade: "Desc", quantidade: 1, descricao: "d", unitarioCentavos: -5000, totalCentavos: -5000 },
    ]),
    55000
  );
});

import { horaAoSair, horaDigitada } from "../src/components/CampoHora";
test("horário digitado vira HH:MM", () => {
  assert.equal(horaDigitada("1"), "1");
  assert.equal(horaDigitada("143"), "14:3");
  assert.equal(horaDigitada("1430"), "14:30");
  assert.equal(horaDigitada("14:30"), "14:30");
  assert.equal(horaAoSair("9"), "09:00");
  assert.equal(horaAoSair("14"), "14:00");
  assert.equal(horaAoSair("930"), "09:30");
});

import { discriminacaoDoServico } from "../src/lib/recibo";
test("discriminação: locação e o nome do equipamento", () => {
  assert.equal(discriminacaoDoServico({ nome: "I-PRF Day", tipoEquipamento: "Centrífuga PRF" }), "Locação de equipamento - Centrífuga PRF");
  assert.equal(discriminacaoDoServico({ nome: "Palestra", tipoEquipamento: null }), "Palestra");
});
