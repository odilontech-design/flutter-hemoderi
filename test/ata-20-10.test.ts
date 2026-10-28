import { test } from "node:test";
import assert from "node:assert/strict";
import { lerResponsavelFinanceiro } from "../src/lib/responsavel-financeiro";
import { textoDoRelatorio } from "../src/lib/relatorio-texto";

const campos = (o: Record<string, string>) => (n: string) => o[n] ?? "";

test("responsável financeiro: a própria clínica deixa tudo vazio", () => {
  const r = lerResponsavelFinanceiro(campos({ financeiroOutro: "nao", financeiroNome: "ignorado" }));
  assert.deepEqual(r, {
    ok: true,
    dados: { financeiroNome: null, financeiroDocumento: null, financeiroTelefone: null, financeiroEmail: null },
  });
});

test("responsável financeiro: outra pessoa exige nome, CPF/CNPJ e telefone", () => {
  const ok = lerResponsavelFinanceiro(
    campos({ financeiroOutro: "sim", financeiroNome: "Empresa Exemplo Ltda", financeiroDocumento: "11222333000181", financeiroTelefone: "11988887777" })
  );
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.dados.financeiroDocumento, "11.222.333/0001-81");
    assert.equal(ok.dados.financeiroTelefone, "(11) 98888-7777");
  }
  const cpf = lerResponsavelFinanceiro(
    campos({ financeiroOutro: "sim", financeiroNome: "Pessoa Exemplo", financeiroDocumento: "529.982.247-25", financeiroTelefone: "11988887777" })
  );
  assert.ok(cpf.ok && cpf.dados.financeiroDocumento === "529.982.247-25");
  assert.equal(lerResponsavelFinanceiro(campos({ financeiroOutro: "sim", financeiroNome: "X Y", financeiroDocumento: "123", financeiroTelefone: "11988887777" })).ok, false);
  assert.equal(lerResponsavelFinanceiro(campos({ financeiroOutro: "sim", financeiroNome: "X Y", financeiroDocumento: "11222333000181", financeiroTelefone: "3333" })).ok, false);
  assert.equal(lerResponsavelFinanceiro(campos({ financeiroOutro: "sim", financeiroDocumento: "11222333000181", financeiroTelefone: "11988887777" })).ok, false);
});

test("texto do relatório para o grupo: no modelo que a equipe usa à mão", () => {
  const texto = textoDoRelatorio({
    codigo: "2026-9002-TESTE",
    data: "20/10/2026",
    hora: "09:00",
    profissional: "Profissional Exemplo",
    clinica: "Clínica Exemplo",
    endereco: "Rua Exemplo, 100 — São Paulo/SP",
    doutor: "Dra. Teste Exemplo",
    paciente: "Paciente Exemplo",
    procedimento: "Enxerto ósseo",
    servico: "AirFlow – GBT Machine (1 paciente)",
    quantidade: 1,
    adicionais: [{ nome: "Membranas – PRF", quantidade: 2 }],
    justificativaAdicionais: null,
    valor: "350,00",
    compareceu: true,
    inicioReal: "09:05",
    fimReal: "10:00",
    intercorrencia: false,
    sinais: { frequenciaCardiaca: "80", saturacaoOxigenio: "não se aplica", pressaoArterial: "12x8", glicemia: "N/A" },
    recebimento: "TOTAL",
    formaRecebimento: "PIX",
    formaDoCliente: "Pix",
    valorRecebido: null,
    observacaoRecebimento: "Pix direto para a Hemoderi",
    observacoes: "Finalizado com sucesso",
    mandic: null,
  });
  assert.match(texto, /^Data: 20\/10\/2026\nHorário: 09:00\nHorário real: 09:05 até 10:00\nEndereço: Rua Exemplo/);
  assert.match(texto, /Nome da Clínica: Clínica Exemplo\nCirurgião: Dra\. Teste Exemplo\nPaciente: Paciente Exemplo/);
  assert.match(texto, /Serviços Hemoderi: AirFlow – GBT Machine \(1 paciente\) \+ 2× Membranas – PRF/);
  assert.match(texto, /Profissional Hemoderi: Profissional Exemplo\nValor: 350,00\nPagamento \(Sim\/Não\): sim/);
  assert.match(texto, /Forma de Pagamento: Pix\n/);
  assert.match(texto, /FC=80\nSato2=\nPA=12x8\nDestro=\nObs:/);
  assert.doesNotMatch(texto, /PG=|Orçamento/);
  assert.doesNotMatch(texto, /N\/A|não se aplica/);
  assert.match(texto, /Obs: Finalizado com sucesso\nAgendamento: 2026-9002-TESTE$/);
});

test("texto do relatório: Orçamento e PG só no atendimento Mandic", () => {
  const base = {
    codigo: "2026-9003-MANDIC", data: "20/10/2026", hora: "09:00", profissional: "Profissional Exemplo", clinica: "Mandic Exemplo",
    endereco: null, doutor: null, paciente: null, procedimento: null, servico: "PRF", quantidade: 1, adicionais: [],
    justificativaAdicionais: null, valor: null, compareceu: true, inicioReal: null, fimReal: null, intercorrencia: false,
    sinais: {}, recebimento: "TOTAL", formaRecebimento: "PIX", formaDoCliente: null, valorRecebido: null,
    observacaoRecebimento: null, observacoes: null,
  };
  const com = textoDoRelatorio({ ...base, mandic: { orcamento: "1234", pg: "5678" } });
  assert.match(com, /Destro=\nOrçamento =1234\nPG=5678\nObs:/);
  assert.doesNotMatch(textoDoRelatorio({ ...base, mandic: null }), /PG=|Orçamento/);
});
