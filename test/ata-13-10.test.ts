import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarTelefoneBrasileiro, lerTelefoneBrasileiro, mascararTelefone } from "../src/lib/telefone";
import { arquivoIcs, linkArquivoIcs } from "../src/lib/google-calendar-link";
import { mesmoLocal } from "../src/lib/endereco";
import { respostasEscritas } from "../src/lib/avaliacao";

test("telefone: aceita DDD + 11 dígitos, com ou sem máscara", () => {
  assert.equal(lerTelefoneBrasileiro("(11) 98888-7777"), "11988887777");
  assert.equal(lerTelefoneBrasileiro("11988887777"), "11988887777");
});

test("telefone: tira o +55 e o 0 da operadora", () => {
  assert.equal(lerTelefoneBrasileiro("+55 11 98888-7777"), "11988887777");
  assert.equal(lerTelefoneBrasileiro("011988887777"), "11988887777");
});

test("telefone: recusa sem DDD, curto, vazio e DDD inexistente", () => {
  assert.equal(lerTelefoneBrasileiro("98888-7777"), null);
  assert.equal(lerTelefoneBrasileiro("(11) 3333-4444"), null);
  assert.equal(lerTelefoneBrasileiro(""), null);
  assert.equal(lerTelefoneBrasileiro(null), null);
  assert.equal(lerTelefoneBrasileiro("05988887777"), null);
});

test("telefone: máscara enquanto digita e formato gravado", () => {
  assert.equal(mascararTelefone("1"), "(1");
  assert.equal(mascararTelefone("1198"), "(11) 98");
  assert.equal(mascararTelefone("5511988887777"), "(11) 98888-7777");
  assert.equal(formatarTelefoneBrasileiro("11988887777"), "(11) 98888-7777");
});

test("ics: evento com início, fim, local e quebras de linha CRLF", () => {
  const ics = arquivoIcs({
    id: "p1",
    titulo: "Atendimento Hemoderi; PRF",
    local: "Rua Exemplo, 10",
    inicio: new Date("2026-10-20T13:00:00.000Z"),
    duracaoMin: 90,
  });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /UID:p1@hemoderi\r\n/);
  assert.match(ics, /DTSTART:20261020T130000Z\r\n/);
  assert.match(ics, /DTEND:20261020T143000Z\r\n/);
  assert.match(ics, /SUMMARY:Atendimento Hemoderi\; PRF\r\n/);
  assert.match(ics, /LOCATION:Rua Exemplo\\, 10\r\n/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(linkArquivoIcs({ id: "p1", titulo: "x", inicio: new Date(), duracaoMin: 30 }).startsWith("data:text/calendar"));
});

test("endereço duplicado: mesmo CEP, número e complemento, ignorando formatação", () => {
  assert.equal(mesmoLocal({ cep: "03664-040", numero: "22" }, { cep: "03664040", numero: "22", complemento: "" }), true);
  assert.equal(mesmoLocal({ cep: "03664040", numero: "22", complemento: "Sala 12" }, { cep: "03664-040", numero: "22", complemento: "sala-12" }), true);
  assert.equal(mesmoLocal({ cep: "03664040", numero: "22", complemento: "Sala 12" }, { cep: "03664040", numero: "22", complemento: "Sala 13" }), false);
  assert.equal(mesmoLocal({ cep: "03664040", numero: "22" }, { cep: "03664040", numero: "23" }), false);
  assert.equal(mesmoLocal({ cep: "", numero: "22" }, { cep: "", numero: "22" }), false);
});

test("avaliação: respostas escritas rotuladas, com o comentário antigo", () => {
  assert.deepEqual(respostasEscritas({ pontosPositivos: "Pontualidade", sugestoes: null }), [
    { rotulo: "Mais gostou", texto: "Pontualidade" },
  ]);
  assert.deepEqual(
    respostasEscritas({ comentario: "Ótimo", pontosNegativos: "Atraso" }).map((r) => r.rotulo),
    ["Comentário", "Menos gostou"]
  );
});

import { temNomeESobrenome } from "../src/lib/relatorio";
import { situacaoDoDia } from "../src/lib/minha-disponibilidade";
import { situacaoDoGanho } from "../src/lib/ganhos";

test("relatório: doutor com nome e sobrenome, sem contar o título", () => {
  assert.equal(temNomeESobrenome("André Miguel"), true);
  assert.equal(temNomeESobrenome("Dra. Ana Paula Souza"), true);
  assert.equal(temNomeESobrenome("André"), false);
  assert.equal(temNomeESobrenome("Dr. André"), false);
  assert.equal(temNomeESobrenome("Dr(a) André"), false);
  assert.equal(temNomeESobrenome("  "), false);
  assert.equal(temNomeESobrenome("André M."), false);
});

test("disponibilidade: disponível, ausente e não declarado", () => {
  const manha = [{ horaInicio: "08:00", horaFim: "12:00" }];
  assert.equal(situacaoDoDia(manha, []).estado, "disponivel");
  assert.equal(situacaoDoDia(manha, [{ horaInicio: null, horaFim: null, motivo: "férias" }]).estado, "ausente");
  assert.equal(situacaoDoDia([], []).estado, "nao-declarado");
  const parcial = situacaoDoDia(manha, [{ horaInicio: "09:00", horaFim: "10:00", motivo: null }]);
  assert.equal(parcial.estado, "disponivel");
  assert.deepEqual(parcial.ausenciasParciais, ["09:00–10:00"]);
});

test("ganhos: a situação segue o relatório e o repasse", () => {
  const hoje = new Date("2026-10-14T00:00:00Z");
  const ontem = new Date("2026-10-13T00:00:00Z");
  const amanha = new Date("2026-10-15T00:00:00Z");
  const base = { status: "ALOCADO", data: ontem, hoje, relatorio: null, repasse: null };
  assert.equal(situacaoDoGanho(base), "relatorio-pendente");
  assert.equal(situacaoDoGanho({ ...base, data: amanha }), "agendado");
  assert.equal(situacaoDoGanho({ ...base, relatorio: { aprovadoEm: null, devolvidoEm: null } }), "em-conferencia");
  assert.equal(situacaoDoGanho({ ...base, relatorio: { aprovadoEm: null, devolvidoEm: ontem } }), "devolvido");
  assert.equal(
    situacaoDoGanho({ ...base, status: "REALIZADO", relatorio: { aprovadoEm: hoje, devolvidoEm: null }, repasse: { status: "PENDENTE" } }),
    "a-receber"
  );
  assert.equal(situacaoDoGanho({ ...base, status: "REALIZADO", repasse: { status: "PAGO" } }), "pago");
  assert.equal(situacaoDoGanho({ ...base, status: "FALTOU", relatorio: { aprovadoEm: null, devolvidoEm: null } }), "faltou");
});
