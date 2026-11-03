import test from "node:test";
import assert from "node:assert/strict";
import { tituloDoNegocio, situacaoDoRecebimento } from "../src/lib/integracoes/pipedrive";
import { lerOrdem, ordenarPedidos } from "../src/lib/filtros-esteira";
import { opcaoCurta, valorPorUnidadeDoPacote } from "../src/lib/cobranca";

test("nome do negócio: ano, número, doutor e clínica, sem instituto nem serviço", () => {
  assert.equal(tituloDoNegocio({ ano: 2026, numero: 73, doutor: "Dra. Maria Gabriela", clinica: "Instituto Daimed" }), "2026 0073 Dra. Maria Gabriela Daimed");
  // clínica com o nome do próprio doutor: não repete
  assert.equal(tituloDoNegocio({ ano: 2026, numero: 55, doutor: "André Miguel", clinica: "Andre Miguel Sant Anna de Assis" }), "2026 0055 André Miguel");
  assert.equal(tituloDoNegocio({ ano: 2026, numero: 9, doutor: null, clinica: "Clínica Sorriso" }), "2026 0009 Clínica Sorriso");
  assert.equal(tituloDoNegocio({ ano: 2026, numero: 9, doutor: "Dr. Rui", clinica: "LiteTouch Remoção de Lentes Center" }), "2026 0009 Dr. Rui Center");
});

test("recebimento do profissional em texto", () => {
  assert.equal(situacaoDoRecebimento("TOTAL", true), "Recebeu o valor total");
  assert.equal(situacaoDoRecebimento(null, false), "Paciente não compareceu");
  assert.equal(situacaoDoRecebimento("NAO", true), "Não recebeu");
});

test("esteira em tabela ordena por coluna, com data e hora desempatando", () => {
  const p = (d: string, h: string, fam: string, valor: number) => ({
    data: new Date(`${d}T00:00:00Z`), horaInicio: h, status: "CONFIRMADO", valorServicoCentavos: valor,
    clinica: { nome: "C" }, servico: { nome: fam, familia: fam }, profissional: null,
  });
  const lista = [p("2026-11-05", "10:00", "PRF", 300), p("2026-11-04", "09:00", "AirFlow", 500), p("2026-11-04", "08:00", "PRF", 100)];
  assert.deepEqual(ordenarPedidos(lista, lerOrdem("data")).map((x) => x.horaInicio), ["08:00", "09:00", "10:00"]);
  assert.deepEqual(ordenarPedidos(lista, lerOrdem("equipamento")).map((x) => x.servico.familia + x.horaInicio), ["AirFlow09:00", "PRF08:00", "PRF10:00"]);
  assert.deepEqual(ordenarPedidos(lista, lerOrdem("-valor")).map((x) => x.valorServicoCentavos), [500, 300, 100]);
  assert.equal(lerOrdem("lixo").coluna, "data");
});

test("preço por paciente e por disparo nos pacotes", () => {
  assert.deepEqual(valorPorUnidadeDoPacote({ nome: "AirFlow – GBT Machine (pacote 4 pacientes)", valorCentavos: 154000 }), { valorCentavos: 38500, unidade: "por paciente" });
  assert.deepEqual(valorPorUnidadeDoPacote({ nome: "Ultrassom Atria® – Dia completo (8 h, 1.600 disparos)", valorCentavos: 286400 }), { valorCentavos: 179, unidade: "por disparo" });
  assert.equal(valorPorUnidadeDoPacote({ nome: "AirFlow – GBT Machine (1 paciente)", valorCentavos: 50000 }), null);
  assert.equal(opcaoCurta("AirFlow – GBT Machine (pacote 2 pacientes)"), "pacote 2 pacientes");
  assert.equal(opcaoCurta("LiteTouch – Frenectomia"), "Frenectomia");
});

import { tabelaDeJuros, totalComJuros } from "../src/lib/integracoes/asaas";
test("cartão: tabela de juros por parcela e total com acréscimo", () => {
  const t = tabelaDeJuros("0,4.5,5,lixo");
  assert.equal(t.length, 12);
  assert.deepEqual(t.slice(0, 4), [0, 4.5, 5, 0]);
  assert.equal(totalComJuros(100000, 1, t), 100000);
  assert.equal(totalComJuros(100000, 2, t), 104500);
  assert.equal(totalComJuros(100000, 99, t), 100000);
  assert.deepEqual(tabelaDeJuros(""), Array(12).fill(0));
});
