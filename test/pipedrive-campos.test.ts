import { test } from "node:test";
import assert from "node:assert/strict";
import { acharCampo, escolherOrganizacao, montarCamposPersonalizados, tituloNoPadraoDoCliente, valorParaCampo, type CampoPipedrive } from "../src/lib/integracoes/pipedrive-campos";

const campos: CampoPipedrive[] = [
  { key: "k_paciente", name: "Nome do Paciente", field_type: "varchar" },
  { key: "k_forma", name: "Forma de Pagamento", field_type: "enum", options: [{ id: 1, label: "Pix" }, { id: 2, label: "Cartão de crédito" }] },
  { key: "k_pago", name: "Pagamento Realizado", field_type: "enum", options: [{ id: 10, label: "Sim" }, { id: 11, label: "Não" }] },
  { key: "k_data", name: "Data do Procedimento", field_type: "date" },
];

test("acha o campo pelo nome, sem se importar com acento e caixa", () => {
  assert.equal(acharCampo(campos, ["forma de pagamento"])?.key, "k_forma");
  assert.equal(acharCampo(campos, ["Produto Hemoderi"]), undefined);
});

test("campo de opções usa o id da opção; sem a opção, fica em branco", () => {
  assert.equal(valorParaCampo(campos[1], "Cartão de crédito"), 2);
  assert.equal(valorParaCampo(campos[1], "Dinheiro"), undefined);
});

test("monta só o que dá para preencher, e a chave fixa vence a busca", () => {
  const corpo = montarCamposPersonalizados(campos, [
    { nomes: ["Nome do Paciente"], valor: "Rita" },
    { nomes: ["Forma de Pagamento"], valor: "Pix" },
    { nomes: ["Pagamento Realizado"], valor: "Não" },
    { nomes: ["Data do Procedimento"], valor: "2026-11-13" },
    { nomes: ["Produto Hemoderi"], valor: "Membranas – PRF" },
    { nomes: ["Qualquer"], chaveFixa: "hash123", valor: "x" },
  ]);
  assert.deepEqual(corpo, { k_paciente: "Rita", k_forma: 1, k_pago: 11, k_data: "2026-11-13", hash123: "x" });
});

test("só escolhe a organização quando há uma só; senão deixa em branco", () => {
  assert.equal(escolherOrganizacao([{ id: 1, name: "Senac Tiradentes" }], "Clínica Senac Tiradentes"), 1);
  assert.equal(escolherOrganizacao([{ id: 7, name: "4170 Senac Tiradentes" }], "Senac Tiradentes"), 7);
  assert.equal(escolherOrganizacao([{ id: 1, name: "Senac Tiradentes" }, { id: 2, name: "Senac Tiradentes" }], "Senac Tiradentes"), null);
  assert.equal(escolherOrganizacao([{ id: 3, name: "Outra Clínica" }], "Senac Tiradentes"), null);
  assert.equal(escolherOrganizacao([], "Senac Tiradentes"), null);
});

test("título no padrão: ano, número do cliente e clínica", () => {
  assert.equal(tituloNoPadraoDoCliente({ ano: 2026, numeroDoCliente: "3463", numeroDoPedido: 421, clinica: "Amitat" }), "2026 3463 Amitat");
  assert.equal(tituloNoPadraoDoCliente({ ano: 2026, numeroDoCliente: null, numeroDoPedido: 421, clinica: "Senac Tiradentes" }), "2026-0421 - Senac Tiradentes");
});
