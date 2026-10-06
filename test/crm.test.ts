import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ArquivoCrmInvalido,
  chave,
  decodificarCsv,
  lerCsv,
  lerEndereco,
  lerTelefones,
  montarPlanoCrm,
  semTitulo,
  tituloDe,
} from "../src/lib/crm";

const ORG = `"Organização - Nome","Organização - Etiquetas","Organização - Endereço","Organização - Pessoas","Organização - Negócios fechados","Organização - Negócios em aberto","Organização - Próxima atividade em","Organização - Proprietário"
"Clinica Sorriso Teste","","Rua Exemplo, 300 - Vila Teste, São Paulo - SP, 01000-000, Brasil","2","5","1","","Andre"
"Dr Beltrano Teste","","","1","1","0","","Andre"
"Dr Beltrano Teste","","Av. Modelo, 840 - Jardim Teste, Guarulhos - SP, Brasil","1","8","0","","Andre"
"Dr. Fulano Teste","","","1","3","0","","Andre"
"Organização Sem Pessoa","","","0","0","0","","Andre"
`;
const PES = `"Pessoa - Nome","Pessoa - Etiquetas","Pessoa - Organização","Pessoa - E-mail - Trabalho","Pessoa - E-mail - Residencial","Pessoa - E-mail - Outros","Pessoa - Telefone - Trabalho","Pessoa - Telefone - Residencial","Pessoa - Telefone - Celular","Pessoa - Telefone - Outros","Pessoa - Negócios fechados","Pessoa - Negócios em aberto","Pessoa - Próxima atividade em","Pessoa - Proprietário","Pessoa - Origem","Pessoa - Data da última atividade","Pessoa - Total de atividades"
"Dra. Helena Teste","","Clinica Sorriso Teste","","","","'+55 11 98000-1111","","","","2","0","","Andre","Indicação","","0"
"Dr. Igor Teste","","Clinica Sorriso Teste","","","","2000-1111, 9 9000-2222","","","","3","0","","Andre","Curso","","0"
"Dr Beltrano Teste","","Dr Beltrano Teste","","","","","","","","1","0","","Andre","","","0"
"Dr Fulano Teste","","","","","","(11) 2000-3333","","","","3","0","","Andre","Visita","","0"
"Dra. Camila Teste","","","","","","","","","","0","0","","Andre","","","0"
"Dr. Paulo Teste","","Clínica Fantasma","","","","","","","","1","0","","Andre","","","0"
"Dr. Igor Teste","","Clinica Sorriso Teste","","","","","","","","1","0","","Andre","","","0"
`;

test("csv: aspas, vírgula dentro do campo, aspas escapadas e quebra de linha", () => {
  const linhas = lerCsv('a,"b, c","d ""e"" f","g\nh"\r\n1,2,3,4\r\n');
  assert.deepEqual(linhas, [
    ["a", "b, c", 'd "e" f', "g\nh"],
    ["1", "2", "3", "4"],
  ]);
});

test("csv: BOM é ignorado e linha vazia some", () => {
  assert.deepEqual(lerCsv('﻿x,y\n\n1,2'), [["x", "y"], ["1", "2"]]);
});

test("nome: título, chave sem acento e 'De.' como erro de 'Dr.'", () => {
  assert.equal(semTitulo("Dra. Ana Lima"), "Ana Lima");
  assert.equal(semTitulo("De. Vinicius Anselmo"), "Vinicius Anselmo");
  assert.equal(semTitulo("Dr"), "Dr");
  assert.equal(tituloDe("Dra Ana"), "Dra.");
  assert.equal(tituloDe("Ana"), null);
  assert.equal(chave("  Clínica   São-José! "), "clinica sao jose");
});

test("telefone: apóstrofo, +55, zero do DDD e número sem DDD", () => {
  assert.deepEqual(lerTelefones("'+55 11 98000-1111").telefones, [{ numero: "11980001111", tipo: "Celular", dddAssumido: false }]);
  assert.equal(lerTelefones("011 2000-3333").telefones[0].numero, "1120003333");
  const semDdd = lerTelefones("990004444").telefones[0];
  assert.equal(semDdd.numero, "11990004444");
  assert.equal(semDdd.dddAssumido, true);
  assert.equal(semDdd.tipo, "Celular");
});

test("telefone: vários números na mesma célula, repetido some e inválido é separado", () => {
  const r = lerTelefones("2000-1111, 9 9000-2222, 2000-1111, 02100000000000");
  assert.deepEqual(r.telefones.map((t) => t.numero), ["1120001111", "11990002222"]);
  assert.deepEqual(r.invalidos, ["02100000000000"]);
  assert.deepEqual(lerTelefones("  ").telefones, []);
});

test("endereço: padrão do Google vira colunas", () => {
  assert.deepEqual(lerEndereco("Rua Exemplo, 300 - Vila Teste, São Paulo - SP, 01000-000, Brasil"), {
    endereco: "Rua Exemplo",
    numero: "300",
    complemento: null,
    bairro: "Vila Teste",
    cidade: "São Paulo",
    uf: "SP",
    cep: "01000-000",
  });
});

test("endereço: complemento no número e texto fora do padrão", () => {
  const a = lerEndereco("Rua Fictícia, 111 cj 22");
  assert.equal(a.endereco, "Rua Fictícia");
  assert.equal(a.numero, "111");
  assert.equal(a.complemento, "cj 22");
  const b = lerEndereco("Rua Sem Padrao 1468 apto 2");
  assert.equal(b.endereco, "Rua Sem Padrao 1468 apto 2");
  assert.equal(b.numero, null);
  assert.equal(lerEndereco("").endereco, null);
});

test("plano: arquivo errado é recusado com a coluna que falta", () => {
  assert.throws(() => montarPlanoCrm(PES, PES), ArquivoCrmInvalido);
  assert.throws(() => montarPlanoCrm(ORG, ORG), /Pessoa - Nome/);
});

test("plano: organizações duplicadas viram uma clínica, com negócios somados", () => {
  const plano = montarPlanoCrm(ORG, PES);
  const bruno = plano.clinicas.filter((c) => c.nome === "Dr Beltrano Teste");
  assert.equal(bruno.length, 1);
  assert.equal(bruno[0].negociosFechados, 9);
  assert.equal(bruno[0].cadastrosOrigem, 2);
  assert.equal(bruno[0].endereco.cidade, "Guarulhos");
  assert.equal(plano.resumo.duplicadasConsolidadas, 1);
});

test("plano: pessoa liga à clínica; mesma pessoa na mesma clínica é um registro só", () => {
  const plano = montarPlanoCrm(ORG, PES);
  const sorriso = plano.clinicas.find((c) => c.nome === "Clinica Sorriso Teste")!;
  assert.equal(sorriso.tipo, "Clínica (2+ profissionais)");
  const daClinica = plano.pessoas.filter((p) => p.clinicaChave === sorriso.chave);
  assert.equal(daClinica.length, 2);
  const igor = daClinica.find((p) => p.nome === "Dr. Igor Teste")!;
  assert.equal(igor.negociosFechados, 4); // 3 + 1 do cadastro repetido
  assert.equal(plano.resumo.pessoasDuplicadasMescladas, 1);
  assert.equal(plano.resumo.pessoasNoArquivo, 7);
  assert.equal(plano.resumo.pessoas, 6);
});

test("plano: telefone da clínica é o do profissional com celular, formatado", () => {
  const plano = montarPlanoCrm(ORG, PES);
  const sorriso = plano.clinicas.find((c) => c.nome === "Clinica Sorriso Teste")!;
  assert.equal(sorriso.telefone, "(11) 98000-1111");
  const hellen = plano.pessoas.find((p) => p.nome === "Dra. Helena Teste")!;
  assert.equal(hellen.titulo, "Dra.");
  assert.equal(hellen.tipoTelefone, "Celular");
  const igor = plano.pessoas.find((p) => p.nome === "Dr. Igor Teste")!;
  assert.equal(igor.telefone, "(11) 2000-1111");
  assert.equal(igor.telefone2, "(11) 99000-2222");
});

test("plano: pessoa sem organização casa com o consultório de mesmo nome", () => {
  const plano = montarPlanoCrm(ORG, PES);
  const fulano = plano.pessoas.find((p) => p.nome === "Dr Fulano Teste")!;
  assert.equal(fulano.clinicaChave, "org:dr fulano teste");
  assert.equal(plano.clinicas.filter((c) => c.nome.includes("Fulano")).length, 1);
});

test("plano: pessoa sem organização e sem consultório vira profissional avulso", () => {
  const plano = montarPlanoCrm(ORG, PES);
  const camila = plano.clinicas.find((c) => c.nome === "Dra. Camila Teste")!;
  assert.equal(camila.tipo, "Profissional avulso");
  assert.equal(camila.chave, "pes:camila teste");
  assert.equal(plano.resumo.clinicasDeProfissionalAvulso, 1);
});

test("plano: organização citada na pessoa e ausente do arquivo vira clínica com aviso", () => {
  const plano = montarPlanoCrm(ORG, PES);
  const fantasma = plano.clinicas.find((c) => c.nome === "Clínica Fantasma")!;
  assert.ok(fantasma);
  assert.ok(fantasma.avisos.some((a) => a.includes("ausente do arquivo")));
});

test("plano: toda pessoa aponta para uma clínica que existe, e organização sem pessoa é listada", () => {
  const plano = montarPlanoCrm(ORG, PES);
  const chaves = new Set(plano.clinicas.map((c) => c.chave));
  assert.ok(plano.pessoas.every((p) => chaves.has(p.clinicaChave)));
  const sozinha = plano.clinicas.find((c) => c.nome === "Organização Sem Pessoa")!;
  assert.ok(sozinha.avisos.some((a) => a.includes("nenhuma pessoa")));
  assert.equal(plano.resumo.clinicasSemProfissional, 1);
});

test("csv: ponto e vírgula (Excel em português) e tabulação são detectados", () => {
  assert.deepEqual(lerCsv('"a";"b, c";"d"\n1;2;3'), [["a", "b, c", "d"], ["1", "2", "3"]]);
  assert.deepEqual(lerCsv("a\tb\n1\t2"), [["a", "b"], ["1", "2"]]);
  // vírgula dentro de aspas não decide o separador
  assert.deepEqual(lerCsv('"a, b";"c"\n1;2'), [["a, b", "c"], ["1", "2"]]);
});

test("plano: o CSV de pessoas salvo com ponto e vírgula importa igual", () => {
  const comPontoEVirgula = PES.replace(/","/g, '";"');
  assert.deepEqual(montarPlanoCrm(ORG, comPontoEVirgula).resumo, montarPlanoCrm(ORG, PES).resumo);
});

test("decodificação: UTF-8, Windows-1252 (acento) e UTF-16", () => {
  const texto = "Organização - Nome;Endereço";
  assert.equal(decodificarCsv(new TextEncoder().encode(texto).buffer as ArrayBuffer), texto);
  const cp1252 = Uint8Array.from(Buffer.from(texto, "latin1"));
  assert.equal(decodificarCsv(cp1252.buffer as ArrayBuffer), texto);
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(texto, "utf16le")]);
  assert.equal(decodificarCsv(Uint8Array.from(utf16).buffer as ArrayBuffer), texto);
});

test("plano: arquivo errado mostra as colunas que o arquivo tem", () => {
  assert.throws(() => montarPlanoCrm(ORG, "Nome;Telefone\nAna;1"), /Colunas encontradas: Nome \| Telefone/);
});

test("csv: arquivo que passou pelo Excel (linha inteira numa célula só) é desembrulhado", () => {
  // O Excel em português consome o 1º par de aspas, joga a linha na coluna A e embrulha ao salvar.
  const excel = (t: string) =>
    t
      .split("\n")
      .filter(Boolean)
      .map((l) => '"' + l.replace(/^"([^"]*)"/, "$1").replace(/"/g, '""') + '"')
      .join("\r\n");
  assert.deepEqual(lerCsv(excel('"a","b","c"\n"1","","3"')), [["a", "b", "c"], ["1", "", "3"]]);
  assert.deepEqual(montarPlanoCrm(ORG, excel(PES)).resumo, montarPlanoCrm(ORG, PES).resumo);
  assert.deepEqual(montarPlanoCrm(excel(ORG), excel(PES)).resumo, montarPlanoCrm(ORG, PES).resumo);
});

test("csv: arquivo legítimo de uma coluna não é desembrulhado", () => {
  assert.deepEqual(lerCsv("nome\nAna\nBruno"), [["nome"], ["Ana"], ["Bruno"]]);
  assert.deepEqual(lerCsv('nome\n"Silva, Ana"\nBruno'), [["nome"], ["Silva, Ana"], ["Bruno"]]);
});
