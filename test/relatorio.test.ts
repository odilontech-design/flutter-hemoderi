import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ajudaCustoEmCentavos,
  camposClinicosEmBranco,
  CAMPOS_CLINICOS,
  divergiu,
  enderecoEmUmaLinha,
  lerServicosAdicionais,
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

// ── Correção do agendamento no relatório (ata de 28/09) ─────────────────────

test("campo deixado como estava não é divergência", () => {
  assert.equal(divergiu("Clínica Santa Rita", "Clínica Santa Rita"), false);
});

test("espaço e caixa não inventam divergência", () => {
  // O formulário chega preenchido com o agendado; quem passa o dedo no campo
  // sem querer não pode gerar alarme para o pós-venda conferir.
  assert.equal(divergiu("Clínica Santa Rita", " clinica santa rita "), false);
});

test("texto diferente é divergência", () => {
  assert.equal(divergiu("Clínica Santa Rita", "Unidade Centro"), true);
});

test("campo apagado não é divergência — é ausência de correção", () => {
  // Nulo quer dizer "saiu como estava marcado". Tratar o vazio como
  // divergência faria todo relatório sem doutor agendado virar alarme.
  assert.equal(divergiu("Clínica Santa Rita", ""), false);
  assert.equal(divergiu("Clínica Santa Rita", null), false);
});

test("correção sobre um campo que estava vazio no agendamento é divergência", () => {
  // O pedido veio sem doutor e o profissional informa quem recebeu: isso é
  // informação nova, e a equipe precisa vê-la.
  assert.equal(divergiu(null, "Dra. Marina"), true);
});

test("o endereço em uma linha é o mesmo texto que a tela mostra", () => {
  assert.equal(
    enderecoEmUmaLinha({
      endereco: "Avenida Paulista",
      numero: "1000",
      bairro: "Bela Vista",
      cidade: "São Paulo",
      uf: "SP",
    }),
    "Avenida Paulista, 1000 · Bela Vista · São Paulo · SP"
  );
});

test("endereço incompleto não deixa separador solto", () => {
  // Clínica cadastrada só com cidade não pode virar "· · São Paulo ·".
  assert.equal(enderecoEmUmaLinha({ cidade: "São Paulo", uf: "SP" }), "São Paulo · SP");
  assert.equal(enderecoEmUmaLinha({}), "");
});

test("serviços adicionais: linha sem serviço some e quantidade inválida vira 1", () => {
  assert.deepEqual(lerServicosAdicionais(["a", "", "b"], ["2", "5", "abc"]), [
    { servicoId: "a", quantidade: 2 },
    { servicoId: "b", quantidade: 1 },
  ]);
});

test("serviços adicionais: o mesmo serviço em duas linhas soma e respeita o teto", () => {
  assert.deepEqual(lerServicosAdicionais(["a", "a"], ["2", "3"]), [{ servicoId: "a", quantidade: 5 }]);
  assert.deepEqual(lerServicosAdicionais(["a", "a"], ["80", "80"]), [{ servicoId: "a", quantidade: 99 }]);
  assert.deepEqual(lerServicosAdicionais([], []), []);
});
