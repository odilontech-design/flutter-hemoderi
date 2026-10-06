import { test } from "node:test";
import assert from "node:assert/strict";
import { comprovanteAceito, lerRecebimento, recebidoNoAto, rotuloDaForma, rotuloDaSituacao } from "../src/lib/recebimento";

test("recebimento: sem resposta, o relatório não envia", () => {
  const r = lerRecebimento({ situacao: "", forma: "", valor: "" });
  assert.equal(r.ok, false);
});

test("recebimento: 'não recebeu' descarta forma e valor", () => {
  const r = lerRecebimento({ situacao: "NAO", forma: "PIX", valor: "100" });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.dados.formaRecebimento, null);
    assert.equal(r.dados.valorRecebidoCentavos, null);
    assert.equal(r.dados.exigeComprovante, false);
  }
});

test("recebimento: recebeu exige a forma", () => {
  assert.equal(lerRecebimento({ situacao: "TOTAL", forma: "", valor: "" }).ok, false);
  assert.equal(lerRecebimento({ situacao: "TOTAL", forma: "BOLETO", valor: "" }).ok, false);
});

test("recebimento: Pix e cartão exigem comprovante, valor é opcional no total", () => {
  for (const forma of ["PIX", "CARTAO"]) {
    const r = lerRecebimento({ situacao: "TOTAL", forma, valor: "" });
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.dados.exigeComprovante, true);
      assert.equal(r.dados.valorRecebidoCentavos, null);
    }
  }
});

test("recebimento: dinheiro exige o valor exato", () => {
  assert.equal(lerRecebimento({ situacao: "TOTAL", forma: "DINHEIRO", valor: "" }).ok, false);
  const r = lerRecebimento({ situacao: "TOTAL", forma: "DINHEIRO", valor: "R$ 350,50" });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.dados.valorRecebidoCentavos, 35050);
    assert.equal(r.dados.exigeComprovante, false);
  }
});

test("recebimento: parcial exige o valor, mesmo em cheque", () => {
  assert.equal(lerRecebimento({ situacao: "PARCIAL", forma: "CHEQUE", valor: "" }).ok, false);
  assert.equal(lerRecebimento({ situacao: "PARCIAL", forma: "CHEQUE", valor: "abc" }).ok, false);
  assert.ok(lerRecebimento({ situacao: "PARCIAL", forma: "CHEQUE", valor: "100" }).ok);
});

test("recebimento: só o total conta como pago no histórico do cliente", () => {
  assert.equal(recebidoNoAto("TOTAL"), true);
  assert.equal(recebidoNoAto("PARCIAL"), false);
  assert.equal(recebidoNoAto("NAO"), false);
  assert.equal(recebidoNoAto(null), false);
});

test("comprovante: tipo e tamanho", () => {
  assert.equal(comprovanteAceito({ type: "image/jpeg", size: 1000 }), null);
  assert.equal(comprovanteAceito({ type: "application/pdf", size: 3 * 1024 * 1024 }), null);
  assert.ok(comprovanteAceito({ type: "application/pdf", size: 3 * 1024 * 1024 + 1 }));
  assert.ok(comprovanteAceito({ type: "text/html", size: 10 }));
});

test("recebimento: rótulos", () => {
  assert.equal(rotuloDaSituacao("PARCIAL"), "Recebeu parte do valor");
  assert.equal(rotuloDaSituacao(null), "Não informado");
  assert.equal(rotuloDaForma("CARTAO"), "Cartão de crédito");
});
