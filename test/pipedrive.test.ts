import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FUNIL_PADRAO,
  descreverErroPipedrive,
  escolherFunil,
  primeiraEtapa,
  mensagemDeHttpPipedrive,
  subdominioDoPipedrive,
  urlDaApiPipedrive,
} from "../src/lib/integracoes/pipedrive-url";

test("domínio: aceita o subdomínio ou o endereço inteiro colado da tela do PipeDrive", () => {
  for (const valor of [
    "hemoderi-5c2c36",
    "hemoderi-5c2c36.pipedrive.com",
    " https://hemoderi-5c2c36.pipedrive.com/ ",
    "HEMODERI-5C2C36.pipedrive.com/deals",
  ]) {
    assert.equal(subdominioDoPipedrive(valor), "hemoderi-5c2c36", valor);
  }
  assert.equal(subdominioDoPipedrive(""), null);
  assert.equal(subdominioDoPipedrive(undefined), null);
  assert.equal(subdominioDoPipedrive("conta com espaço"), null);
});

test("URL da API com token limpo", () => {
  assert.equal(
    urlDaApiPipedrive("exemplo", " abc123\n", "/deals"),
    "https://exemplo.pipedrive.com/api/v1/deals?api_token=abc123"
  );
});

test("erro: mostra a causa em vez de só 'fetch failed'", () => {
  const dns = new TypeError("fetch failed", {
    cause: Object.assign(new Error("getaddrinfo ENOTFOUND x.pipedrive.com.pipedrive.com"), {
      code: "ENOTFOUND",
      hostname: "x.pipedrive.com.pipedrive.com",
    }),
  });
  assert.match(descreverErroPipedrive(dns), /Endereço não encontrado \(x\.pipedrive\.com\.pipedrive\.com\)/);

  const recusada = new TypeError("fetch failed", {
    cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
  });
  assert.equal(descreverErroPipedrive(recusada), "fetch failed (ECONNREFUSED: connect ECONNREFUSED)");

  const tempo = Object.assign(new Error("timeout"), { name: "TimeoutError" });
  assert.equal(descreverErroPipedrive(tempo), "O PipeDrive não respondeu a tempo.");
  assert.equal(descreverErroPipedrive("x"), "x");
});

test("erro HTTP usa a mensagem do PipeDrive", () => {
  assert.match(mensagemDeHttpPipedrive(401, { error: "unauthorized" }), /PIPEDRIVE_API_TOKEN/);
  assert.equal(
    mensagemDeHttpPipedrive(400, { success: false, error: "Stage not found" }),
    "PipeDrive: Stage not found (HTTP 400)"
  );
  assert.equal(mensagemDeHttpPipedrive(500, null), "PipeDrive: requisição recusada (HTTP 500)");
});

test("URL com query string já existente usa &", () => {
  assert.equal(
    urlDaApiPipedrive("exemplo", "abc", "/stages?pipeline_id=3"),
    "https://exemplo.pipedrive.com/api/v1/stages?pipeline_id=3&api_token=abc"
  );
});

test("funil Dilon Saúde: achado pelo nome sem depender de acento ou caixa", () => {
  const funis = [
    { id: 1, name: "Negócios 2021" },
    { id: 7, name: "DILON SAUDE" },
    { id: 9, name: "Pós-venda" },
  ];
  assert.equal(escolherFunil(funis, FUNIL_PADRAO)?.id, 7);
  assert.equal(escolherFunil([{ id: 4, name: "Funil Dilon Saúde | Operações" }], FUNIL_PADRAO)?.id, 4);
  // Ambíguo ou inexistente: não escolhe — melhor pendência que funil errado.
  assert.equal(
    escolherFunil([{ id: 2, name: "Dilon Saúde SP" }, { id: 3, name: "Dilon Saúde RJ" }], FUNIL_PADRAO),
    null
  );
  assert.equal(escolherFunil([{ id: 1, name: "Negócios 2021" }], FUNIL_PADRAO), null);
  assert.equal(escolherFunil([{ id: 7, name: "Dilon Saúde", active: false }], FUNIL_PADRAO), null);
});

test("primeira etapa ativa do funil", () => {
  assert.equal(
    primeiraEtapa([
      { id: 30, order_nr: 3 },
      { id: 10, order_nr: 1, active_flag: false },
      { id: 20, order_nr: 2 },
    ])?.id,
    20
  );
  assert.equal(primeiraEtapa([]), null);
});
