import { test } from "node:test";
import assert from "node:assert/strict";
import { emailAnonimizado, motivoParaNaoExcluir } from "../src/lib/exclusao-conta";

const base = { papel: "PROFISSIONAL", atendimentosFuturosDoProfissional: 0, ehOUnicoAcessoDaClinica: false, agendamentosFuturosDaClinica: 0 };

test("o e-mail anonimizado não repete e não é de ninguém", () => {
  assert.notEqual(emailAnonimizado("a"), emailAnonimizado("b"));
  assert.match(emailAnonimizado("x1"), /@excluido\.invalid$/);
});

test("profissional com atendimento futuro espera a central", () => {
  assert.match(motivoParaNaoExcluir({ ...base, atendimentosFuturosDoProfissional: 2 })!, /2 atendimento/);
  assert.equal(motivoParaNaoExcluir(base), null);
});

test("clínica só é barrada se for o único acesso e houver agendamento futuro", () => {
  const c = { ...base, papel: "CLINICA" };
  assert.match(motivoParaNaoExcluir({ ...c, ehOUnicoAcessoDaClinica: true, agendamentosFuturosDaClinica: 1 })!, /única conta/);
  assert.equal(motivoParaNaoExcluir({ ...c, ehOUnicoAcessoDaClinica: false, agendamentosFuturosDaClinica: 5 }), null);
  assert.equal(motivoParaNaoExcluir({ ...c, ehOUnicoAcessoDaClinica: true, agendamentosFuturosDaClinica: 0 }), null);
});

test("equipe interna não exclui pelo app", () => {
  assert.match(motivoParaNaoExcluir({ ...base, papel: "INTERNO" })!, /equipe interna/i);
});
