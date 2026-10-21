import { test } from "node:test";
import assert from "node:assert/strict";
import {
  descreverErroPipedrive,
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
