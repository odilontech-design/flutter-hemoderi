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

test("texto do relatório para o grupo: sem paciente, com o essencial", () => {
  const texto = textoDoRelatorio({
    codigo: "2026-9002-TESTE",
    data: "20/10/2026",
    hora: "09:00",
    profissional: "Profissional Exemplo",
    clinica: "Clínica Exemplo",
    doutor: "Dra. Teste Exemplo",
    servico: "AirFlow – GBT Machine (1 paciente)",
    quantidade: 1,
    adicionais: [{ nome: "Membranas – PRF", quantidade: 2 }],
    justificativaAdicionais: null,
    compareceu: true,
    inicioReal: "09:05",
    fimReal: "10:00",
    intercorrencia: false,
    sinais: { frequenciaCardiaca: "80 bpm", saturacaoOxigenio: "não se aplica", glicemia: "N/A" },
    recebimento: "TOTAL",
    formaRecebimento: "PIX",
    valorRecebido: null,
    observacaoRecebimento: "Pix direto para a Hemoderi",
    observacoes: null,
  });
  assert.match(texto, /^\*Relatório Hemoderi — 2026-9002-TESTE\*/);
  assert.match(texto, /\+ 2× Membranas – PRF/);
  assert.match(texto, /80 bpm/);
  assert.doesNotMatch(texto, /N\/A|não se aplica|Glicemia/);
  assert.match(texto, /Pagamento fora do habitual: Pix direto para a Hemoderi/);
});
