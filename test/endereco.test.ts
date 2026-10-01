import { test } from "node:test";
import assert from "node:assert/strict";
import { comEnderecoDoPedido, resumoDoEndereco } from "../src/lib/endereco";

const CLINICA = {
  nome: "Clínica Santa Rita",
  endereco: "Av. Paulista",
  numero: "1000",
  complemento: null,
  bairro: "Bela Vista",
  cidade: "São Paulo",
  uf: "SP",
};

test("o resumo junta só o que existe, sem pontuação sobrando", () => {
  assert.equal(resumoDoEndereco(CLINICA), "Av. Paulista, 1000 – Bela Vista, São Paulo/SP");
  assert.equal(resumoDoEndereco({ endereco: "Rua A", uf: "RJ" }), "Rua A – RJ");
  assert.equal(resumoDoEndereco({}), "");
});

test("pedido sem endereço próprio acontece no principal da clínica", () => {
  assert.deepEqual(comEnderecoDoPedido(CLINICA, null), CLINICA);
});

test("pedido com endereço próprio troca o local, e só o local — o nome da clínica fica", () => {
  const rio = { endereco: "Av. Atlântica", numero: "500", bairro: "Copacabana", cidade: "Rio de Janeiro", uf: "RJ" };
  const resultado = comEnderecoDoPedido(CLINICA, rio);
  assert.equal(resultado.nome, "Clínica Santa Rita");
  assert.equal(resultado.endereco, "Av. Atlântica");
  assert.equal(resultado.uf, "RJ");
  assert.equal(resultado.complemento, null, "o complemento do principal não vaza para o outro endereço");
});
