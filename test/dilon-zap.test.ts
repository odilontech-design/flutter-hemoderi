import { test } from "node:test";
import assert from "node:assert/strict";
import { corpoParaDilonZap, interpretarResposta, mensagemVencida } from "../src/lib/integracoes/dilon-zap";

test("corpo no formato da API do Dilon Zap", () => {
  assert.deepEqual(corpoParaDilonZap({ id: "m1", destinatario: "5511988887777", texto: "Olá", nome: "Clínica Exemplo" }), {
    telefone: "5511988887777",
    nome: "Clínica Exemplo",
    mensagem: "Olá",
    referencia: "hemoderi:m1",
  });
  assert.equal("nome" in corpoParaDilonZap({ id: "m1", destinatario: "5511988887777", texto: "Olá" }), false);
});

test("resposta: aceita, falha da mensagem e problema da integração", () => {
  assert.deepEqual(interpretarResposta(200, { status: "na fila" }), { resultado: "enviada" });
  assert.equal(interpretarResposta(400, { error: "telefone inválido" }).resultado, "falha");
  assert.equal(interpretarResposta(409, { error: "contato optou por não receber mensagens" }).resultado, "falha");
  assert.equal(interpretarResposta(409, { error: "nenhum número conectado nesta empresa" }).resultado, "parar");
  assert.equal(interpretarResposta(401, { error: "chave inválida" }).resultado, "parar");
  assert.equal(interpretarResposta(403, { error: "fora do plano" }).resultado, "parar");
  assert.equal(interpretarResposta(502, null).resultado, "parar");
  const d = interpretarResposta(401, { error: "chave inválida" });
  assert.ok(d.resultado !== "enviada" && d.erro.includes("chave inválida") && d.erro.includes("401"));
  // erro de validação do zod vem como objeto
  const z = interpretarResposta(400, { error: { fieldErrors: { telefone: ["curto"] } } });
  assert.ok(z.resultado === "falha" && z.erro.includes("telefone"));
});

test("mensagem vencida não sai", () => {
  const agora = new Date("2026-10-14T15:00:00Z");
  const ontem = new Date("2026-10-13T15:00:00Z");
  const amanha = new Date("2026-10-15T15:00:00Z");
  assert.equal(mensagemVencida({ tipo: "CONFIRMACAO", criadaEm: ontem, inicioDoAtendimento: ontem, agora }), true);
  assert.equal(mensagemVencida({ tipo: "LEMBRETE", criadaEm: agora, inicioDoAtendimento: amanha, agora }), false);
  assert.equal(mensagemVencida({ tipo: "RESULTADO", criadaEm: ontem, inicioDoAtendimento: ontem, agora }), false);
  assert.equal(
    mensagemVencida({ tipo: "RESULTADO", criadaEm: new Date("2026-10-10T00:00:00Z"), inicioDoAtendimento: null, agora }),
    true
  );
});
