import { test } from "node:test";
import assert from "node:assert/strict";
import { perfilEfetivo, perfilPermite } from "../src/lib/papeis";

// perfilPermite sustenta TODAS as restrições de perfil do painel — quem
// aloca, quem confirma, quem cancela. Um erro aqui abre ou tranca a operação
// inteira de uma vez, então a regra merece teste próprio.

test("RESPONSAVEL passa em qualquer restrição, mesmo sem estar na lista", () => {
  // É quem responde pela operação (André, Naiara): não se lista em cada
  // permissão, passa em todas por definição.
  assert.equal(perfilPermite("RESPONSAVEL", "COMERCIAL"), true);
  assert.equal(perfilPermite("RESPONSAVEL", "LOGISTICA"), true);
  assert.equal(perfilPermite("RESPONSAVEL", "POS_VENDA"), true);
  assert.equal(perfilPermite("RESPONSAVEL"), true);
});

test("o perfil listado passa", () => {
  assert.equal(perfilPermite("COMERCIAL", "COMERCIAL"), true);
  assert.equal(perfilPermite("LOGISTICA", "LOGISTICA"), true);
});

test("perfil fora da lista é recusado", () => {
  assert.equal(perfilPermite("LOGISTICA", "COMERCIAL"), false);
  assert.equal(perfilPermite("POS_VENDA", "COMERCIAL"), false);
  assert.equal(perfilPermite("ATENDENTE", "COMERCIAL"), false);
  assert.equal(perfilPermite("GESTAO", "COMERCIAL"), false);
});

test("cancelamento: exatamente Ana (comercial) e os responsáveis (André, Naiara)", () => {
  // A regra fechada na ata de 28/09. O cancelamento é gateado a "COMERCIAL",
  // e é isto que o gate precisa significar: os três nomes, e ninguém mais.
  const podeCancelar = (perfil: Parameters<typeof perfilPermite>[0]) => perfilPermite(perfil, "COMERCIAL");
  assert.equal(podeCancelar("COMERCIAL"), true, "Ana");
  assert.equal(podeCancelar("RESPONSAVEL"), true, "André e Naiara");
  assert.equal(podeCancelar("LOGISTICA"), false, "Joyce não cancela");
  assert.equal(podeCancelar("POS_VENDA"), false, "Stephanie não cancela");
  assert.equal(podeCancelar("GESTAO"), false);
  assert.equal(podeCancelar("ATENDENTE"), false);
});

test("mais de um perfil permitido: basta estar em um deles", () => {
  // Como a confirmação da triagem, aberta a comercial e atendente.
  assert.equal(perfilPermite("ATENDENTE", "COMERCIAL", "ATENDENTE"), true);
  assert.equal(perfilPermite("COMERCIAL", "COMERCIAL", "ATENDENTE"), true);
  assert.equal(perfilPermite("LOGISTICA", "COMERCIAL", "ATENDENTE"), false);
});

test("perfilEfetivo trata ausência como RESPONSAVEL, não como o mais restrito", () => {
  // Contas antigas (seed, a própria equipe) nasceram sem perfil; tratá-las
  // como o mais restrito trancaria quem já trabalhava sem ninguém ter mexido.
  assert.equal(perfilEfetivo(null), "RESPONSAVEL");
  assert.equal(perfilEfetivo("COMERCIAL"), "COMERCIAL");
});
