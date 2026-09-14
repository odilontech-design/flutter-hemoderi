import { test } from "node:test";
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { montarAssertion, normalizarChave } from "../src/lib/integracoes/google-api";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

function partes(jwt: string) {
  const [cabecalho, corpo, assinatura] = jwt.split(".");
  const ler = (p: string) => JSON.parse(Buffer.from(p, "base64url").toString());
  return { cabecalho: ler(cabecalho), corpo: ler(corpo), assinatura, assinado: `${cabecalho}.${corpo}` };
}

test("a assinatura do JWT confere com a chave da conta de serviço", () => {
  const jwt = montarAssertion("robo@projeto.iam.gserviceaccount.com", privateKey);
  const { assinado, assinatura } = partes(jwt);
  const confere = createVerify("RSA-SHA256")
    .update(assinado)
    .verify(publicKey, Buffer.from(assinatura, "base64url"));
  assert.equal(confere, true);
});

test("o JWT declara RS256, que é o único que o Google aceita da conta de serviço", () => {
  const { cabecalho } = partes(montarAssertion("robo@projeto.iam.gserviceaccount.com", privateKey));
  assert.deepEqual(cabecalho, { alg: "RS256", typ: "JWT" });
});

test("as declarações apontam para o endpoint e o escopo certos", () => {
  const { corpo } = partes(montarAssertion("robo@projeto.iam.gserviceaccount.com", privateKey, 1_000_000));
  assert.equal(corpo.iss, "robo@projeto.iam.gserviceaccount.com");
  assert.equal(corpo.aud, "https://oauth2.googleapis.com/token");
  assert.equal(corpo.scope, "https://www.googleapis.com/auth/calendar.events");
  assert.equal(corpo.iat, 1_000_000);
  assert.equal(corpo.exp, 1_000_000 + 3600, "o Google recusa validade acima de 1h");
});

test("o base64url não deixa escapar +, / nem =", () => {
  // 200 JWTs: com padding e caracteres do base64 comum, o Google devolve
  // "invalid_grant" sem dizer por quê — o erro some se um único token passar.
  for (let i = 0; i < 200; i++) {
    const jwt = montarAssertion(`robo${i}@projeto.iam.gserviceaccount.com`, privateKey, 1_700_000_000 + i);
    assert.doesNotMatch(jwt, /[+/=]/, jwt);
  }
});

test("a chave colada em uma linha vira PEM de verdade", () => {
  // É o erro nº 1 desta integração: painéis de variáveis de ambiente guardam
  // o valor em uma linha só, e o PEM com "\\n" literal não é aceito pelo
  // crypto — que responde com um erro de decodificação que não explica nada.
  const umaLinha = privateKey.replace(/\n/g, "\\n");
  assert.equal(normalizarChave(umaLinha), privateKey);
  assert.doesNotThrow(() => montarAssertion("robo@projeto.iam.gserviceaccount.com", normalizarChave(umaLinha)));
});
