import test from "node:test";
import assert from "node:assert/strict";
import { montarTexto } from "../src/lib/integracoes/whatsapp";

const pedido = {
  id: "p1",
  numero: 111,
  data: new Date("2027-03-16T00:00:00Z"),
  horaInicio: "10:00",
  doutorNome: "Dr. Rodrigo Ferreira",
  procedimentoPaciente: "Enxerto com membrana",
  origem: "EQUIPE",
  criadoEm: new Date("2027-03-10T12:00:00Z"),
  clinica: { nome: "Clínica Sorriso", telefone: null, endereco: "Rua das Flores", numero: "120", bairro: "Retiro", cidade: "Jundiaí", uf: "SP" },
  endereco: null,
  servico: { nome: "Membranas – PRF" },
  profissional: { nome: "Monica Messias Nascimento e Silva", telefone: "11999990000" },
};

test("alocação: com o local fechado vai só a região, sem clínica nem cirurgião", () => {
  const texto = montarTexto("ALOCACAO", pedido, 24);
  assert.match(texto, /^Olá, Monica!/);
  assert.match(texto, /Região: Retiro, Jundiaí\/SP/);
  assert.match(texto, /Nome da Clínica: informada na véspera/);
  assert.doesNotMatch(texto, /Rua das Flores|Clínica Sorriso|Rodrigo/);
  assert.match(texto, /\/profissional/);
  assert.doesNotMatch(texto, /SORRISO/);
});

test("alocação: fora de SP o endereço completo vai desde a alocação", () => {
  const texto = montarTexto("ALOCACAO", { ...pedido, clinica: { ...pedido.clinica, uf: "RJ", cidade: "Niterói" } }, 24);
  assert.match(texto, /Endereço completo: Rua das Flores, 120/);
  assert.match(texto, /Nome da Clínica: Clínica Sorriso/);
  assert.match(texto, /Cirurgião: Dr. Rodrigo Ferreira/);
});

test("lembrete de chegada: vai ao profissional, sem clínica, com o link do app", () => {
  const texto = montarTexto("LEMBRETE_CHEGADA", pedido, 24);
  assert.match(texto, /^Olá, Monica!/);
  assert.match(texto, /Cheguei/);
  assert.match(texto, /\/profissional/);
  assert.doesNotMatch(texto, /Sorriso|SORRISO|Rodrigo/);
});
