import { test } from "node:test";
import assert from "node:assert/strict";
import { lerPlanilha, normalizarNome } from "../src/lib/importacao";

test("lê o formato que sai de um Ctrl+C no Excel (tabulação)", () => {
  const { validos, problemas } = lerPlanilha("Ana\tRibeiro\tana@exemplo.com\nBruno\tTavares\tbruno@exemplo.com");
  assert.equal(problemas.length, 0);
  assert.deepEqual(validos.map((v) => v.nome), ["Ana Ribeiro", "Bruno Tavares"]);
  assert.deepEqual(validos.map((v) => v.email), ["ana@exemplo.com", "bruno@exemplo.com"]);
});

test("lê CSV com vírgula e com ponto-e-vírgula", () => {
  assert.equal(lerPlanilha("Ana Ribeiro,ana@exemplo.com").validos[0].nome, "Ana Ribeiro");
  assert.equal(lerPlanilha("Ana Ribeiro;ana@exemplo.com").validos[0].email, "ana@exemplo.com");
});

test("pula o cabeçalho sem reclamar dele", () => {
  const { validos, problemas } = lerPlanilha("Nome\tSobrenome\tE-mail\nAna\tRibeiro\tana@exemplo.com");
  assert.equal(validos.length, 1);
  assert.equal(problemas.length, 0);
});

test("não parte um nome com vírgula quando veio de planilha", () => {
  // "Silva, Ana" numa célula do Excel chega com tabulação entre as colunas.
  const { validos } = lerPlanilha("Silva, Ana\tana@exemplo.com");
  assert.equal(validos[0].nome, "Silva, Ana");
});

test("linha sem e-mail vira problema, não profissional sem acesso", () => {
  const { validos, problemas } = lerPlanilha("Ana Ribeiro\nBruno\tbruno@exemplo.com");
  assert.equal(validos.length, 1);
  assert.equal(problemas[0].motivo, "sem e-mail");
  assert.equal(problemas[0].linha, 1);
});

test("e-mail malformado é recusado com o valor à vista", () => {
  const { problemas } = lerPlanilha("Ana Ribeiro\tana@exemplo");
  assert.match(problemas[0].motivo, /e-mail inválido \(ana@exemplo\)/);
});

test("e-mail repetido na planilha entra uma vez só", () => {
  const { validos, problemas } = lerPlanilha(
    "Ana\tana@exemplo.com\nAna Ribeiro\tANA@exemplo.com"
  );
  assert.equal(validos.length, 1);
  assert.match(problemas[0].motivo, /repetido/);
});

test("linha em branco no meio da planilha é ignorada", () => {
  const { validos, problemas } = lerPlanilha("Ana\tana@exemplo.com\n\n\nBruno\tbruno@exemplo.com");
  assert.equal(validos.length, 2);
  assert.equal(problemas.length, 0);
});

test("planilha em CAIXA ALTA vira nome legível", () => {
  assert.equal(normalizarNome("ANA MARIA DE SOUZA"), "Ana Maria de Souza");
  assert.equal(normalizarNome("ana ribeiro"), "Ana Ribeiro");
});

test("nome já digitado direito não é mexido", () => {
  assert.equal(normalizarNome("Ana de Souza"), "Ana de Souza");
  assert.equal(normalizarNome("  Ana   Ribeiro  "), "Ana Ribeiro");
});

test("o número da linha aponta a planilha original, para achar o erro", () => {
  const { problemas } = lerPlanilha("Nome\tE-mail\nAna\tana@exemplo.com\nsem arroba aqui");
  assert.equal(problemas[0].linha, 3);
});
