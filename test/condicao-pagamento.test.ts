import test from "node:test";
import assert from "node:assert/strict";
import { condicaoAoPagarPix, condicaoInicial } from "../src/lib/condicao-pagamento";

test("a condição nasce a do cadastro da clínica, se válida", () => {
  assert.equal(condicaoInicial("Faturado no mês"), "Faturado no mês");
  assert.equal(condicaoInicial("  Cortesia "), "Cortesia");
  assert.equal(condicaoInicial("fiado"), null);
  assert.equal(condicaoInicial(null), null);
});

test("Pix pago antes do atendimento marca Antecipado, só no que está em branco", () => {
  const inicio = new Date("2026-11-10T13:00:00Z");
  assert.equal(condicaoAoPagarPix(null, new Date("2026-11-09T12:00:00Z"), inicio), "Antecipado");
  assert.equal(condicaoAoPagarPix("", new Date("2026-11-09T12:00:00Z"), inicio), "Antecipado");
  assert.equal(condicaoAoPagarPix("Faturado no mês", new Date("2026-11-09T12:00:00Z"), inicio), null);
  assert.equal(condicaoAoPagarPix(null, new Date("2026-11-10T15:00:00Z"), inicio), null);
});

import { mudancaParaProfissional, textoDoAviso } from "../src/lib/aviso-profissional";
const base = { id: "p", profissionalId: "ana", status: "ALOCADO", data: new Date("2026-11-10T00:00:00Z"), horaInicio: "09:00", servicoId: "s", enderecoId: null };
test("aviso ao profissional anterior: cancelado, removido, alterado ou nada", () => {
  assert.equal(mudancaParaProfissional(base, { ...base, status: "CANCELADO" }), "cancelado");
  assert.equal(mudancaParaProfissional(base, { ...base, profissionalId: "bruno" }), "removido");
  assert.equal(mudancaParaProfissional(base, { ...base, profissionalId: null, status: "CONFIRMADO" }), "removido");
  assert.equal(mudancaParaProfissional(base, { ...base, horaInicio: "10:00" }), "alterado");
  assert.equal(mudancaParaProfissional(base, { ...base, enderecoId: "outro" }), "alterado");
  assert.equal(mudancaParaProfissional(base, { ...base }), null);
  assert.equal(mudancaParaProfissional({ ...base, profissionalId: null }, { ...base }), null);
  assert.equal(mudancaParaProfissional({ ...base, status: "REALIZADO" }, { ...base, status: "CANCELADO" }), null);
});
test("texto do aviso sem clínica, com antes e depois", () => {
  const t = textoDoAviso("alterado", { nome: "Ana Ribeiro", servico: "PRF", antes: { data: base.data, hora: "09:00" }, depois: { data: base.data, hora: "11:00" }, codigo: "2026-0010", link: "https://x/profissional" });
  assert.match(t, /^Olá, Ana!/);
  assert.match(t, /de 10\/11\/2026 às 09:00 para 10\/11\/2026 às 11:00/);
  assert.match(textoDoAviso("cancelado", { nome: "Ana", servico: "PRF", antes: { data: base.data, hora: "09:00" }, codigo: "c", link: "l" }), /CANCELADO/);
});
