import { test } from "node:test";
import assert from "node:assert/strict";
import { linkAdicionarGoogleAgenda } from "../src/lib/google-calendar-link";

test("monta a URL de adicionar rápido com início, fim e texto", () => {
  const url = linkAdicionarGoogleAgenda({
    titulo: "Aplicação de PRF — Hemoderi",
    inicio: new Date("2026-09-24T14:00:00Z"),
    duracaoMin: 60,
  });
  assert.match(url, /^https:\/\/calendar\.google\.com\/calendar\/render\?/);
  assert.match(url, /action=TEMPLATE/);
  assert.match(url, /text=Aplica%C3%A7%C3%A3o\+de\+PRF/);
  assert.match(url, /dates=20260924T140000Z%2F20260924T150000Z/);
});

test("detalhes e local só entram quando informados", () => {
  const sem = linkAdicionarGoogleAgenda({ titulo: "X", inicio: new Date("2026-09-24T14:00:00Z"), duracaoMin: 30 });
  assert.doesNotMatch(sem, /details=/);
  assert.doesNotMatch(sem, /location=/);

  const com = linkAdicionarGoogleAgenda({
    titulo: "X",
    detalhes: "A central confirma o horário.",
    local: "Clínica Santa Rita",
    inicio: new Date("2026-09-24T14:00:00Z"),
    duracaoMin: 30,
  });
  assert.match(com, /details=/);
  assert.match(com, /location=/);
});
