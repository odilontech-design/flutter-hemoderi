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
