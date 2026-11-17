import { test } from "node:test";
import assert from "node:assert/strict";
import { montarMensagemFcm, pushDoTipo, tokenInvalidoNoFcm } from "../src/lib/push";
import { lerDispositivo } from "../src/lib/dispositivo";

const dados = { servico: "Sedação Consciente", data: new Date("2026-12-03T00:00:00Z"), hora: "09:00", codigo: "2026-0042" };

test("a mensagem do FCM leva título, texto e o caminho para abrir", () => {
  const m = montarMensagemFcm("tokenfake".repeat(4), { titulo: "T", corpo: "C", url: "/profissional" });
  assert.equal(m.message.notification.title, "T");
  assert.equal(m.message.data.url, "/profissional");
  assert.equal(m.message.android.priority, "HIGH");
});

test("alocação vai para o profissional e confirmação para a clínica", () => {
  const aloc = pushDoTipo("ALOCACAO", dados, "p1");
  assert.equal(aloc?.para, "profissional");
  assert.match(aloc!.corpo, /03\/12\/2026 às 09:00/);
  const conf = pushDoTipo("CONFIRMACAO", dados, "p1");
  assert.equal(conf?.para, "clinica");
  assert.equal(conf?.url, "/portal/resumo/p1");
});

test("o push não carrega endereço, doutor nem paciente", () => {
  for (const tipo of ["CONFIRMACAO", "ALOCACAO", "LEMBRETE", "LEMBRETE_CHEGADA", "COBRANCA_RELATORIO", "RESULTADO"] as const) {
    const p = pushDoTipo(tipo, dados, "p1")!;
    assert.doesNotMatch(p.titulo + p.corpo, /Rua |Dr\.|Dra\.|paciente/i);
  }
});

test("tipos que são texto interno ou pedido manual não geram push", () => {
  for (const tipo of ["AVISO_EQUIPE", "AVISO_PROFISSIONAL", "RESUMO", "FEEDBACK", "ATRASO"] as const) {
    assert.equal(pushDoTipo(tipo, dados, "p1"), null);
  }
});

test("token que o FCM não reconhece é removido; erro passageiro não", () => {
  assert.equal(tokenInvalidoNoFcm(404, ""), true);
  assert.equal(tokenInvalidoNoFcm(400, '{"error":{"status":"INVALID_ARGUMENT","message":"The registration token is not a valid FCM registration token"}}'), true);
  assert.equal(tokenInvalidoNoFcm(500, "erro interno"), false);
  assert.equal(tokenInvalidoNoFcm(429, "quota"), false);
});

test("o registro do aparelho aceita só plataforma e app conhecidos", () => {
  const token = "a".repeat(40);
  assert.deepEqual(lerDispositivo({ token, plataforma: "ios", app: "clinica" }), { token, plataforma: "ios", app: "clinica" });
  assert.equal(lerDispositivo({ token, plataforma: "windows", app: "clinica" }), null);
  assert.equal(lerDispositivo({ token, plataforma: "ios", app: "outro" }), null);
  assert.equal(lerDispositivo({ token: "curto", plataforma: "ios", app: "clinica" }), null);
  assert.equal(lerDispositivo(null), null);
});
