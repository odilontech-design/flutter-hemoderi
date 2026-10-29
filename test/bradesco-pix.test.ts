import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarTxid, expiracaoEmSegundos, certificadoDoBradesco, configuradoBradesco, urlsDoBradesco } from "../src/lib/integracoes/bradesco-pix";

test("gerarTxid: comprimento entre 26 e 35 caracteres", () => {
  const txid = gerarTxid();
  assert.ok(txid.length >= 26, `Muito curto: ${txid.length}`);
  assert.ok(txid.length <= 35, `Muito longo: ${txid.length}`);
});

test("gerarTxid: só alfanuméricos", () => {
  const txid = gerarTxid();
  assert.match(txid, /^[A-Za-z0-9]+$/);
});

test("gerarTxid: começa com HEM", () => {
  const txid = gerarTxid();
  assert.ok(txid.startsWith("HEM"));
});

test("gerarTxid: gera valores únicos", () => {
  const ids = new Set(Array.from({ length: 100 }, () => gerarTxid()));
  assert.equal(ids.size, 100, "Colisão detectada em 100 gerações");
});

test("gerarTxid: mantém o formato BACEN", () => {
  for (let i = 0; i < 50; i++) {
    const txid = gerarTxid();
    assert.match(txid, /^[A-Za-z0-9]{26,35}$/, `BACEN inválido: ${txid}`);
  }
});

test("expiração: até o fim do vencimento mais 30 dias, nunca menos de 1 hora", () => {
  const agora = new Date("2026-11-01T12:00:00Z");
  const venc = new Date("2026-11-05T00:00:00Z");
  // 4 dias e ~12h até 23:59:59 do dia 5 + 30 dias
  assert.equal(expiracaoEmSegundos(venc, agora), Math.round((Date.UTC(2026, 10, 5, 23, 59, 59) - agora.getTime()) / 1000) + 30 * 86400);
  assert.equal(expiracaoEmSegundos(new Date("2020-01-01T00:00:00Z"), agora) >= 3600, true);
});

test("certificado: aceita .pfx em Base64 ou o par PEM; sem nenhum, não está configurado", () => {
  const guardado = { ...process.env };
  try {
    for (const k of ["BRADESCO_CERTIFICADO_PFX", "BRADESCO_CERTIFICADO", "BRADESCO_CHAVE_PRIVADA", "BRADESCO_CLIENT_ID", "BRADESCO_CLIENT_SECRET", "BRADESCO_CHAVE_PIX"]) delete process.env[k];
    assert.equal(certificadoDoBradesco(), null);
    assert.equal(configuradoBradesco(), false);
    process.env.BRADESCO_CERTIFICADO_PFX = Buffer.from("conteudo").toString("base64");
    process.env.BRADESCO_CERTIFICADO_SENHA = "senha";
    const pfx = certificadoDoBradesco() as { pfx: Buffer; passphrase?: string };
    assert.equal(pfx.pfx.toString(), "conteudo");
    assert.equal(pfx.passphrase, "senha");
    delete process.env.BRADESCO_CERTIFICADO_PFX;
    process.env.BRADESCO_CERTIFICADO = "-----BEGIN CERTIFICATE-----\\nAAA\\n-----END CERTIFICATE-----";
    process.env.BRADESCO_CHAVE_PRIVADA = "-----BEGIN PRIVATE KEY-----\\nBBB\\n-----END PRIVATE KEY-----";
    const par = certificadoDoBradesco() as { cert: string; key: string };
    assert.match(par.cert, /CERTIFICATE-----\nAAA\n-----END/);
  } finally {
    for (const k of Object.keys(process.env)) if (k.startsWith("BRADESCO_")) delete process.env[k];
    Object.assign(process.env, guardado);
  }
});

test("endereços: homologação por padrão, produção quando pedido", () => {
  delete process.env.BRADESCO_AMBIENTE;
  assert.match(urlsDoBradesco().token, /^https:\/\/qrpix-h\.bradesco\.com\.br\//);
  process.env.BRADESCO_AMBIENTE = "producao";
  try {
    assert.match(urlsDoBradesco().api, /^https:\/\/qrpix\.bradesco\.com\.br\/v2$/);
  } finally {
    delete process.env.BRADESCO_AMBIENTE;
  }
});

test("pfx com cifras antigas (RC2/3DES, como os das autoridades brasileiras) abre pela conversão", async (t) => {
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createSecureContext } = await import("node:tls");
  const dir = mkdtempSync(join(tmpdir(), "pfx-"));
  try {
    try {
      execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(dir, "k.pem"), "-out", join(dir, "c.pem"), "-subj", "/CN=Teste", "-days", "2"], { stdio: "ignore" });
      execFileSync("openssl", ["pkcs12", "-export", "-legacy", "-certpbe", "PBE-SHA1-RC2-40", "-keypbe", "PBE-SHA1-3DES", "-macalg", "sha1", "-inkey", join(dir, "k.pem"), "-in", join(dir, "c.pem"), "-out", join(dir, "a.pfx"), "-passout", "pass:segredo"], { stdio: "ignore" });
    } catch {
      t.skip("openssl indisponível neste ambiente");
      return;
    }
    const { pfxParaPem } = await import("../src/lib/integracoes/bradesco-pix");
    const par = pfxParaPem(readFileSync(join(dir, "a.pfx")), "segredo");
    assert.match(par.cert, /^-----BEGIN CERTIFICATE-----/);
    assert.match(par.key, /PRIVATE KEY-----/);
    // O par convertido é aceito pelo TLS.
    createSecureContext({ cert: par.cert, key: par.key });
    assert.throws(() => pfxParaPem(readFileSync(join(dir, "a.pfx")), "errada"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
