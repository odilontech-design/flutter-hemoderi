import { test } from "node:test";
import assert from "node:assert/strict";
import { situacaoDoAcesso } from "../src/lib/profissionais-acesso";

test("sem usuário: sem acesso", () => assert.equal(situacaoDoAcesso([]), "sem-acesso"));
test("só desativados: desativado", () =>
  assert.equal(situacaoDoAcesso([{ desativadoEm: new Date(), senhaProvisoria: false }]), "desativado"));
test("senha ainda provisória: nunca entrou", () =>
  assert.equal(situacaoDoAcesso([{ desativadoEm: null, senhaProvisoria: true }]), "nunca-entrou"));
test("senha trocada: ativo", () =>
  assert.equal(situacaoDoAcesso([{ desativadoEm: null, senhaProvisoria: false }]), "ativo"));
