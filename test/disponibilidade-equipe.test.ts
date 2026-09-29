import { test } from "node:test";
import assert from "node:assert/strict";
import { TURNOS_GRADE } from "../src/lib/disponibilidade-equipe";

// A lib disponibilidadeDaEquipe fala com o banco; o que dá para testar em
// isolamento é a decisão de quais turnos entram na grade. A regra de estado
// (ausente vence ocupado vence livre) é coberta ponta a ponta pelo teste de
// fumaça, contra o banco real.

test("a grade tem só os turnos com hora — INTEGRAL não vira coluna", () => {
  const chaves = TURNOS_GRADE.map((t) => t.chave);
  assert.deepEqual(chaves, ["MANHA", "TARDE"]);
});

test("manhã e tarde não se sobrepõem — senão um atendimento contaria duas vezes", () => {
  const manha = TURNOS_GRADE.find((t) => t.chave === "MANHA")!;
  const tarde = TURNOS_GRADE.find((t) => t.chave === "TARDE")!;
  assert.ok(manha.horaFim <= tarde.horaInicio, `${manha.horaFim} deveria ser <= ${tarde.horaInicio}`);
});
