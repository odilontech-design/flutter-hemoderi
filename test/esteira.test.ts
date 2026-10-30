import { test } from "node:test";
import assert from "node:assert/strict";
import { ETAPAS, etapaDoPerfil, etapaPorChave, etapasDoPerfil } from "../src/lib/esteira";

test("cada setor abre na própria fila", () => {
  assert.equal(etapaDoPerfil("COMERCIAL").chave, "triagem");
  assert.equal(etapaDoPerfil("LOGISTICA").chave, "alocar");
  assert.equal(etapaDoPerfil("POS_VENDA").chave, "conferir");
});

test("atendente senta na mesma mesa do comercial", () => {
  assert.equal(etapaDoPerfil("ATENDENTE").chave, "triagem");
});

test("quem responde pela operação abre no que está parado, não numa etapa só", () => {
  // A pergunta de quem gerencia é "o que está atrasado hoje", e essa resposta
  // não cabe numa fila de setor.
  assert.equal(etapaDoPerfil("RESPONSAVEL").chave, "parados");
  assert.equal(etapaDoPerfil("GESTAO").chave, "parados");
});

test("a triagem é só o que ainda não virou compromisso", () => {
  assert.deepEqual(etapaPorChave("triagem")?.onde, { status: "SOLICITADO" });
});

test("a fila da logística é o confirmado sem profissional", () => {
  assert.deepEqual(etapaPorChave("alocar")?.onde, { status: "CONFIRMADO" });
});

test("a conferência exige relatório entregue, não aprovado e não devolvido", () => {
  // Realizado SEM relatório nenhum não é trabalho do pós-venda — é do
  // profissional que não entregou. Por isso `is`, e não `isNot: null`.
  assert.deepEqual(etapaPorChave("conferir")?.onde, {
    status: "REALIZADO",
    relatorio: { is: { aprovadoEm: null, devolvidoEm: null } },
  });
});

test("relatório devolvido sai da conferência e aparece em Devolvidos", () => {
  assert.deepEqual(etapaPorChave("devolvidos")?.onde, {
    status: "REALIZADO",
    relatorio: { is: { aprovadoEm: null, devolvidoEm: { not: null } } },
  });
  // E a etapa não tem dono: ninguém "responde" pela fila do profissional.
  assert.equal(etapaPorChave("devolvidos")?.dono, undefined);
});

test("parados soma as três filas da equipe: confirmar, alocar e conferir (ata de 20/10)", () => {
  const parados = etapaPorChave("parados");
  assert.deepEqual(parados?.onde, {
    OR: [{ status: { in: ["SOLICITADO", "CONFIRMADO"] } }, etapaPorChave("conferir")?.onde],
  });
});

test("todas as etapas têm chave única — a chave vai para a URL", () => {
  const chaves = ETAPAS.map((e) => e.chave);
  assert.equal(new Set(chaves).size, chaves.length);
});

test("cada fila com dono tem um dono só: duas donas seria fila de ninguém", () => {
  const donos = ETAPAS.map((e) => e.dono).filter(Boolean);
  assert.equal(new Set(donos).size, donos.length);
});

test("chave desconhecida não vira etapa — quem chama decide o padrão", () => {
  assert.equal(etapaPorChave("inventada"), undefined);
  assert.equal(etapaPorChave(undefined), undefined);
});

test("a etapa `todos` não filtra nada", () => {
  assert.deepEqual(etapaPorChave("todos")?.onde, {});
});

test("cada perfil vê só as etapas do seu setor; gestão e responsável veem tudo", () => {
  const chaves = (perfil: Parameters<typeof etapasDoPerfil>[0]) => etapasDoPerfil(perfil).map((e) => e.chave);
  assert.deepEqual(chaves("LOGISTICA"), ["triagem", "alocar", "alocados", "aguardando-aceite", "sem-relatorio", "cancelados"]);
  assert.deepEqual(chaves("POS_VENDA"), ["triagem", "conferir", "sem-relatorio", "devolvidos", "fechados", "todos"]);
  assert.equal(chaves("COMERCIAL").includes("alocar"), false);
  assert.equal(chaves("COMERCIAL").includes("triagem"), true);
  assert.equal(etapasDoPerfil("RESPONSAVEL").length, ETAPAS.length);
  assert.equal(etapasDoPerfil("GESTAO").length, ETAPAS.length);
});

test("a etapa de abertura de cada perfil está entre as que ele vê", () => {
  for (const perfil of ["COMERCIAL", "ATENDENTE", "LOGISTICA", "POS_VENDA", "GESTAO", "RESPONSAVEL"] as const) {
    assert.equal(etapasDoPerfil(perfil).some((e) => e.chave === etapaDoPerfil(perfil).chave), true, perfil);
  }
});

test("atendimento que passou sem relatório sai de Alocados e vai para Sem relatório", () => {
  const alocados = etapaPorChave("alocados")!.onde as { status: string; data: { gte: Date } };
  const semRelatorio = etapaPorChave("sem-relatorio")!.onde as { status: string; data: { lt: Date } };
  assert.equal(alocados.status, "ALOCADO");
  assert.equal(semRelatorio.status, "ALOCADO");
  // Mesmo corte: o que não está em um está no outro.
  assert.equal(alocados.data.gte.getTime(), semRelatorio.data.lt.getTime());
  assert.ok(etapasDoPerfil("POS_VENDA").some((e) => e.chave === "sem-relatorio"));
  assert.ok(etapasDoPerfil("LOGISTICA").some((e) => e.chave === "sem-relatorio"));
});

test("Aguardando aceite mostra só alocados sem aceite, de hoje em diante", () => {
  const onde = etapaPorChave("aguardando-aceite")?.onde as { status: string; aceitoEm: null; data: { gte: Date } };
  assert.equal(onde.status, "ALOCADO");
  assert.equal(onde.aceitoEm, null);
  assert.ok(onde.data.gte instanceof Date);
});
