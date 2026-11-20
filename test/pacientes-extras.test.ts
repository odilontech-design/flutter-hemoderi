import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveDoPaciente, lerPacientesExtras, linhasDosPacientesExtras } from "../src/lib/pacientes-extras";

test("lê a lista do formulário: ignora linha vazia, recusa linha pela metade", () => {
  assert.deepEqual(lerPacientesExtras(["Maria  Silva", ""], ["Frenectomia", ""]), { ok: true, lista: [{ nome: "Maria Silva", procedimento: "Frenectomia" }] });
  assert.equal(lerPacientesExtras(["Maria"], [""]).ok, false);
  assert.equal(lerPacientesExtras([""], ["Frenectomia"]).ok, false);
  assert.deepEqual(lerPacientesExtras([], []), { ok: true, lista: [] });
});

test("limite de pacientes a mais", () => {
  const nomes = Array.from({ length: 11 }, (_, i) => `P${i}`);
  assert.equal(lerPacientesExtras(nomes, nomes).ok, false);
});

test("mesmo paciente digitado de dois jeitos", () => {
  assert.equal(chaveDoPaciente("  JOÃO  da Silva "), chaveDoPaciente("joao da silva"));
});

test("linha do texto do relatório", () => {
  assert.deepEqual(linhasDosPacientesExtras([]), []);
  assert.deepEqual(linhasDosPacientesExtras([{ nome: "Ana", procedimento: "Sedação" }, { nome: "Bia", procedimento: "PRF" }]), ["Pacientes adicionais (2): Ana — Sedação; Bia — PRF"]);
});
