import { test } from "node:test";
import assert from "node:assert/strict";
import { ehAdministradorTecnico, emailsDoAdministradorTecnico } from "../src/lib/acesso-tecnico";

test("sem configuração, vale só o e-mail do desenvolvedor", () => {
  assert.deepEqual(emailsDoAdministradorTecnico(""), ["felipe@dilontech.com.br"]);
  assert.equal(ehAdministradorTecnico("felipe@dilontech.com.br", ""), true);
  assert.equal(ehAdministradorTecnico("andre@hemoderi.com.br", ""), false);
});

test("a lista da Vercel manda, sem diferenciar maiúsculas nem espaços", () => {
  const env = " A@x.com , b@y.com ";
  assert.equal(ehAdministradorTecnico("a@x.com", env), true);
  assert.equal(ehAdministradorTecnico("B@Y.com", env), true);
  assert.equal(ehAdministradorTecnico("felipe@dilontech.com.br", env), false);
});

test("sem e-mail ninguém passa", () => {
  assert.equal(ehAdministradorTecnico(null, ""), false);
  assert.equal(ehAdministradorTecnico(undefined, ""), false);
});
