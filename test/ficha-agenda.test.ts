import { test } from "node:test";
import assert from "node:assert/strict";
import { fichaDoAtendimento, montarEventoDaEquipe } from "../src/lib/integracoes/google-evento";

const pedido = {
  numero: 321,
  data: new Date("2026-11-11T00:00:00Z"),
  horaInicio: "07:00",
  duracaoMin: 45,
  status: "ALOCADO",
  pacienteNome: "Paciente Fictícia",
  observacoes: null,
  clinica: { nome: "Clínica Fictícia", endereco: "Rua Fictícia", numero: "560", complemento: "conj 82", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP", cep: "01323-000" },
  servico: { nome: "Sedação consciente" },
  profissional: { nome: "Iara", googleAgendaId: null },
  doutorNome: "Dra. Teste",
  valorServicoCentavos: 85000,
  formaPagamento: "Pix",
  procedimentoPaciente: "Protocolo inferior",
};

test("a ficha segue os campos que a logística preenchia à mão", () => {
  const ficha = fichaDoAtendimento(pedido);
  assert.match(ficha, /^Data: 11\/11\/2026\nHorário: 07:00 às 07:45\n/);
  assert.match(ficha, /Endereço completo com CEP: Rua Fictícia, 560 – conj 82 – Bela Vista, São Paulo\/SP – CEP 01323-000/);
  assert.match(ficha, /Cirurgião: Dra\. Teste/);
  assert.match(ficha, /Profissional Hemoderi: Iara/);
  assert.match(ficha, /Valor = 850,00/);
  assert.match(ficha, /Forma de Pagamento: Pix/);
  assert.match(ficha, /FC=\nSato2=\nPA =\nDestro/);
  assert.match(ficha, /Pagamento \(Sim\/Não\) =\n/);
});

test("sinais vitais só aparecem na sedação", () => {
  const ficha = fichaDoAtendimento({ ...pedido, servico: { nome: "AirFlow" } });
  assert.doesNotMatch(ficha, /Sato2=/);
  assert.match(ficha, /Orçamento =/);
});

test("a ficha só é escrita ao criar; atualizar preserva o que a equipe anotou", () => {
  assert.ok(montarEventoDaEquipe(pedido, true).description?.startsWith("Data: "));
  assert.equal(montarEventoDaEquipe(pedido, false).description, undefined);
  assert.equal(montarEventoDaEquipe(pedido, false).summary, "Dra. Teste · Sedação consciente · Iara");
});
