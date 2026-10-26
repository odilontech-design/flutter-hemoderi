import { test } from "node:test";
import assert from "node:assert/strict";
import { eventoParaEquipe } from "../src/lib/evento-equipe";
import { linkAdicionarGoogleAgenda } from "../src/lib/google-calendar-link";

test("evento da equipe leva profissional, local e contato", () => {
  const evento = eventoParaEquipe({
    id: "p1",
    data: new Date("2026-10-27T00:00:00Z"),
    horaInicio: "10:00",
    duracaoMin: 60,
    clinicaNome: "Clínica Fictícia",
    servicoNome: "AirFlow",
    profissionalNome: "Profissional Fictícia",
    doutorNome: "Dra. Teste",
    contatoClinica: "(11) 98888-7777",
    local: "Rua Fictícia, 10, São Paulo/SP",
  });
  assert.equal(evento.titulo, "AirFlow — Clínica Fictícia (Profissional Fictícia)");
  assert.match(evento.detalhes!, /Profissional: Profissional Fictícia/);
  assert.match(evento.detalhes!, /Contato da clínica: \(11\) 98888-7777/);
  assert.equal(evento.local, "Rua Fictícia, 10, São Paulo/SP");
  // 10h em São Paulo = 13h UTC
  assert.equal(evento.inicio.toISOString(), "2026-10-27T13:00:00.000Z");
  assert.match(linkAdicionarGoogleAgenda(evento), /calendar\.google\.com/);
});

test("sem profissional nem detalhes, o evento continua válido", () => {
  const evento = eventoParaEquipe({
    id: "p2",
    data: new Date("2026-10-27T00:00:00Z"),
    horaInicio: "08:30",
    duracaoMin: 30,
    clinicaNome: "Clínica Fictícia",
    servicoNome: "Sedação",
  });
  assert.equal(evento.titulo, "Sedação — Clínica Fictícia");
  assert.equal(evento.detalhes, undefined);
  assert.equal(evento.local, undefined);
});
