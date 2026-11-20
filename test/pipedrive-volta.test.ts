import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirVolta, lerAvisoDoPipedrive, simOuNao, type PedidoParaVolta } from "../src/lib/integracoes/pipedrive-volta-regras";

const base: PedidoParaVolta = {
  valorServicoCentavos: 150000,
  valorRepasseCentavos: 0,
  profissionalId: "p1",
  profissionalNome: "Iara Martins",
  paciente: "Rogério",
  pagoNoSistema: false,
  baixaPeloPipedrive: false,
  cobrancaEmitida: false,
  repassePago: false,
};
const profs = [
  { id: "p1", nome: "Iara Martins" },
  { id: "p2", nome: "Isabelle Oliveira Lopes" },
];
const vazio = { valorCentavos: null, repasseCentavos: null, profissional: null, paciente: null, pago: null };

test("aviso do PipeDrive: v2 e v1, e o que a própria integração mexeu", () => {
  assert.deepEqual(lerAvisoDoPipedrive({ meta: { entity: "deal", entity_id: "15802", change_source: "app" } }), { negocioId: "15802", feitoPelaApi: false, ehNegocio: true });
  assert.deepEqual(lerAvisoDoPipedrive({ meta: { object: "deal", id: 15802, change_source: "api" } }), { negocioId: "15802", feitoPelaApi: true, ehNegocio: true });
  assert.equal(lerAvisoDoPipedrive({ meta: { entity: "person", entity_id: "3" } }).ehNegocio, false);
  assert.equal(lerAvisoDoPipedrive(null).negocioId, null);
});

test("Sim/Não do PipeDrive", () => {
  assert.equal(simOuNao("SIM"), true);
  assert.equal(simOuNao("NÃO"), false);
  assert.equal(simOuNao(null), null);
});

test("sem diferença, nada muda", () => {
  const d = decidirVolta({ ...vazio, valorCentavos: 150000, repasseCentavos: 0, profissional: "iara martins", paciente: "Rogério" }, base, profs);
  assert.deepEqual(d, { feitas: [], conflitos: [] });
});

test("valor, repasse, profissional, paciente e baixa passam para o sistema", () => {
  const d = decidirVolta({ valorCentavos: 120000, repasseCentavos: 30000, profissional: "Isabelle Oliveira Lopes", paciente: "Rogério Silva", pago: true }, base, profs);
  assert.equal(d.valorServicoCentavos, 120000);
  assert.equal(d.valorRepasseCentavos, 30000);
  assert.equal(d.profissionalId, "p2");
  assert.equal(d.paciente, "Rogério Silva");
  assert.equal(d.baixa, true);
  assert.equal(d.conflitos.length, 0);
});

test("travas: cobrança emitida e repasse pago viram pendência", () => {
  const d = decidirVolta({ ...vazio, valorCentavos: 120000, repasseCentavos: 30000, profissional: "Isabelle Oliveira Lopes" }, { ...base, cobrancaEmitida: true, repassePago: true }, profs);
  assert.equal(d.valorServicoCentavos, undefined);
  assert.equal(d.valorRepasseCentavos, undefined);
  assert.equal(d.profissionalId, undefined);
  assert.equal(d.conflitos.length, 3);
});

test("profissional que não existe no sistema vira pendência; Não desfaz só a baixa do PipeDrive", () => {
  assert.equal(decidirVolta({ ...vazio, profissional: "Fulano" }, base, profs).conflitos.length, 1);
  // Nome mais curto na lista do PipeDrive: é a mesma pessoa, nada muda.
  assert.deepEqual(decidirVolta({ ...vazio, profissional: "Iara" }, { ...base, profissionalNome: "Iara Martins Silva" }, [{ id: "p1", nome: "Iara Martins Silva" }]), { feitas: [], conflitos: [] });
  assert.equal(decidirVolta({ ...vazio, pago: false }, { ...base, baixaPeloPipedrive: true }, profs).baixa, false);
  assert.equal(decidirVolta({ ...vazio, pago: false }, base, profs).baixa, undefined);
  assert.equal(decidirVolta({ ...vazio, pago: true }, { ...base, pagoNoSistema: true }, profs).baixa, undefined);
});
