import { test } from "node:test";
import assert from "node:assert/strict";
import { pacienteObrigatorio } from "../src/lib/paciente-obrigatorio";

const base = { modalidade: "PARTICULAR" as const, servicos: 2, pelaEquipe: true, mesmoPaciente: true as boolean | null };

test("equipe agenda vários serviços para o mesmo paciente sem saber o nome", () => {
  assert.equal(pacienteObrigatorio(base), false);
});

test("pacientes diferentes ou sem resposta ainda exigem o nome", () => {
  assert.equal(pacienteObrigatorio({ ...base, mesmoPaciente: false }), true);
  assert.equal(pacienteObrigatorio({ ...base, mesmoPaciente: null }), true);
});

test("a clínica e o curso continuam obrigando o paciente", () => {
  assert.equal(pacienteObrigatorio({ ...base, pelaEquipe: false }), true);
  assert.equal(pacienteObrigatorio({ ...base, modalidade: "CURSO" }), true);
});

test("um serviço só não exige paciente", () => {
  assert.equal(pacienteObrigatorio({ ...base, servicos: 1, mesmoPaciente: null }), false);
});
