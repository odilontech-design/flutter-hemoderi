import { test } from "node:test";
import assert from "node:assert/strict";
import { contar, contarAgendamentos, precisaAvisar } from "../src/lib/avisos";

test("avisa quando nunca foi visto e quando a novidade é mais recente que a vista", () => {
  const aviso = { marca: "2026-10-02T14:00:00.000Z" };
  assert.equal(precisaAvisar(aviso, null), true);
  assert.equal(precisaAvisar(aviso, "2026-10-02T13:59:59.000Z"), true);
});

test("não avisa de novo o que já foi visto — nem o que é mais antigo", () => {
  const aviso = { marca: "2026-10-02T14:00:00.000Z" };
  assert.equal(precisaAvisar(aviso, "2026-10-02T14:00:00.000Z"), false);
  assert.equal(precisaAvisar(aviso, "2026-10-02T15:00:00.000Z"), false);
});

test("um agendamento com vários serviços conta como uma solicitação", () => {
  const pedidos = [
    { id: "a", grupoId: "g1" },
    { id: "b", grupoId: "g1" },
    { id: "c", grupoId: null },
  ];
  assert.equal(contarAgendamentos(pedidos), 2);
  assert.equal(contarAgendamentos([]), 0);
});

test("singular e plural nas mensagens", () => {
  assert.equal(contar(1, "relatório aguarda", "relatórios aguardam"), "1 relatório aguarda");
  assert.equal(contar(3, "relatório aguarda", "relatórios aguardam"), "3 relatórios aguardam");
});
