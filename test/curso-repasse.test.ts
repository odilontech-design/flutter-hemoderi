import { test } from "node:test";
import assert from "node:assert/strict";
import { pagaRepasseNaVisita } from "../src/lib/curso-repasse";

// Visita de curso com três pacientes: pedidos a, b e c (o menor número é o primeiro).
const bd = {
  pedido: {
    findFirst: async () => ({ id: "a" }),
  },
} as unknown as Parameters<typeof pagaRepasseNaVisita>[0];

test("curso: só o primeiro agendamento da visita paga repasse", async () => {
  assert.equal(await pagaRepasseNaVisita(bd, { id: "a", modalidade: "CURSO", grupoId: "g" }), true);
  assert.equal(await pagaRepasseNaVisita(bd, { id: "b", modalidade: "CURSO", grupoId: "g" }), false);
  assert.equal(await pagaRepasseNaVisita(bd, { id: "c", modalidade: "CURSO", grupoId: "g" }), false);
});

test("fora de curso ou sem grupo, cada agendamento paga o seu", async () => {
  assert.equal(await pagaRepasseNaVisita(bd, { id: "b", modalidade: "PARTICULAR", grupoId: "g" }), true);
  assert.equal(await pagaRepasseNaVisita(bd, { id: "b", modalidade: "CURSO", grupoId: null }), true);
});
