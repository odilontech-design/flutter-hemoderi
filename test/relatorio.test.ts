import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ajudaCustoEmCentavos,
  camposClinicosEmBranco,
  CAMPOS_CLINICOS,
  NAO_SE_APLICA,
} from "../src/lib/relatorio";

function todosPreenchidos(valor: string): Record<string, string> {
  return Object.fromEntries(CAMPOS_CLINICOS.map((c) => [c.nome, valor]));
}

test("campo clínico em branco é apontado pelo nome", () => {
  const valores = todosPreenchidos("ok");
  valores.glicemia = "";
  const faltando = camposClinicosEmBranco(valores);
  assert.equal(faltando.length, 1);
  assert.equal(faltando[0].nome, "glicemia");
});

test('"não se aplica" conta como resposta — é a decisão da ata de 21/09', () => {
  assert.deepEqual(camposClinicosEmBranco(todosPreenchidos(NAO_SE_APLICA)), []);
});

test("só espaço não vale como resposta", () => {
  assert.equal(camposClinicosEmBranco(todosPreenchidos("   ")).length, CAMPOS_CLINICOS.length);
});

test("campo ausente do formulário conta como em branco, não quebra", () => {
  assert.equal(camposClinicosEmBranco({}).length, CAMPOS_CLINICOS.length);
});

test("ajuda de custo aceita os formatos que a pessoa digita de verdade", () => {
  assert.equal(ajudaCustoEmCentavos("150"), 15000);
  assert.equal(ajudaCustoEmCentavos("150,50"), 15050);
  assert.equal(ajudaCustoEmCentavos("R$ 150,50"), 15050);
  assert.equal(ajudaCustoEmCentavos("1.250,00"), 125000);
});

test("ajuda de custo vazia é null — nem todo atendimento tem deslocamento", () => {
  assert.equal(ajudaCustoEmCentavos(""), null);
  assert.equal(ajudaCustoEmCentavos("   "), null);
});

test("texto que não é dinheiro é recusado, não vira zero", () => {
  assert.equal(ajudaCustoEmCentavos("abc"), undefined);
  assert.equal(ajudaCustoEmCentavos("-50"), undefined);
});
