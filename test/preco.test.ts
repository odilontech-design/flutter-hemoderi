import { test } from "node:test";
import assert from "node:assert/strict";
import { precoDoServico, precosDosServicos, regiaoDaUf } from "../src/lib/preco";

const TABELA = 50_000; // R$ 500,00
const SERVICO = "servico-1";

/**
 * Um dublê do Prisma com só o que lib/preco.ts usa. Testar a cadeia de preço
 * contra um banco de verdade só provaria que o Postgres funciona — o que
 * pode quebrar aqui é a ORDEM das camadas, e isso é lógica pura.
 */
function bancoFalso({
  negociados = [],
  regioes = [],
  precosRegiao = [],
  precosTabela = [],
}: {
  negociados?: { clinicaId: string; servicoId: string; valorCentavos: number }[];
  regioes?: { id: string; nome: string; ufs: string[]; ativa?: boolean }[];
  precosRegiao?: { regiaoId: string; servicoId: string; valorCentavos: number }[];
  precosTabela?: { tabelaId: string; servicoId: string; valorCentavos: number }[];
} = {}) {
  return {
    precoTabela: {
      findMany: async ({ where }: never) => {
        const w = where as { tabelaId: { in: string[] }; servicoId: string | { in: string[] } };
        return precosTabela.filter(
          (p) =>
            w.tabelaId.in.includes(p.tabelaId) &&
            (typeof w.servicoId === "string" ? p.servicoId === w.servicoId : w.servicoId.in.includes(p.servicoId))
        );
      },
    },
    precoClinica: {
      findUnique: async ({ where }: never) => {
        const { clinicaId, servicoId } = (where as { clinicaId_servicoId: { clinicaId: string; servicoId: string } })
          .clinicaId_servicoId;
        return negociados.find((p) => p.clinicaId === clinicaId && p.servicoId === servicoId) ?? null;
      },
      findMany: async ({ where }: never) => {
        const w = where as { clinicaId: string; servicoId: { in: string[] } };
        return negociados.filter((p) => p.clinicaId === w.clinicaId && w.servicoId.in.includes(p.servicoId));
      },
    },
    regiaoPreco: {
      findFirst: async ({ where }: never) => {
        const w = where as { ativa: boolean; ufs: { has: string } };
        return regioes.find((r) => (r.ativa ?? true) === w.ativa && r.ufs.includes(w.ufs.has)) ?? null;
      },
    },
    precoRegiao: {
      findUnique: async ({ where }: never) => {
        const { regiaoId, servicoId } = (where as { regiaoId_servicoId: { regiaoId: string; servicoId: string } })
          .regiaoId_servicoId;
        return precosRegiao.find((p) => p.regiaoId === regiaoId && p.servicoId === servicoId) ?? null;
      },
      findMany: async ({ where }: never) => {
        const w = where as { regiaoId: string; servicoId: { in: string[] } };
        return precosRegiao.filter((p) => p.regiaoId === w.regiaoId && w.servicoId.in.includes(p.servicoId));
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dublê mínimo: só os três modelos que lib/preco.ts toca.
  } as any;
}

const SP = { id: "r-sp", nome: "São Paulo e região", ufs: ["SP"] };

test("sem praça nem negociação, vale a tabela do serviço", async () => {
  const preco = await precoDoServico(bancoFalso(), {
    clinicaId: "c1",
    servicoId: SERVICO,
    uf: "SP",
    valorPadraoCentavos: TABELA,
  });
  assert.equal(preco.valorCentavos, TABELA);
  assert.equal(preco.origem, "tabela");
});

test("a praça da UF vence a tabela", async () => {
  const preco = await precoDoServico(
    bancoFalso({ regioes: [SP], precosRegiao: [{ regiaoId: SP.id, servicoId: SERVICO, valorCentavos: 42_000 }] }),
    { clinicaId: "c1", servicoId: SERVICO, uf: "SP", valorPadraoCentavos: TABELA }
  );
  assert.equal(preco.valorCentavos, 42_000);
  assert.equal(preco.origem, "regiao");
  assert.equal(preco.regiao, SP.nome);
});

test("o negociado da clínica vence a praça — é contrato, não padronização", async () => {
  const preco = await precoDoServico(
    bancoFalso({
      negociados: [{ clinicaId: "c1", servicoId: SERVICO, valorCentavos: 30_000 }],
      regioes: [SP],
      precosRegiao: [{ regiaoId: SP.id, servicoId: SERVICO, valorCentavos: 42_000 }],
    }),
    { clinicaId: "c1", servicoId: SERVICO, uf: "SP", valorPadraoCentavos: TABELA }
  );
  assert.equal(preco.valorCentavos, 30_000);
  assert.equal(preco.origem, "negociado");
});

test("praça que não cobre a UF da clínica não é aplicada", async () => {
  const preco = await precoDoServico(
    bancoFalso({ regioes: [SP], precosRegiao: [{ regiaoId: SP.id, servicoId: SERVICO, valorCentavos: 42_000 }] }),
    { clinicaId: "c1", servicoId: SERVICO, uf: "RJ", valorPadraoCentavos: TABELA }
  );
  assert.equal(preco.valorCentavos, TABELA);
  assert.equal(preco.origem, "tabela");
});

test("praça existe mas sem preço para este serviço: cai na tabela", async () => {
  const preco = await precoDoServico(bancoFalso({ regioes: [SP] }), {
    clinicaId: "c1",
    servicoId: SERVICO,
    uf: "SP",
    valorPadraoCentavos: TABELA,
  });
  assert.equal(preco.valorCentavos, TABELA);
  assert.equal(preco.origem, "tabela");
});

test("praça desativada não precifica", async () => {
  const preco = await precoDoServico(
    bancoFalso({
      regioes: [{ ...SP, ativa: false }],
      precosRegiao: [{ regiaoId: SP.id, servicoId: SERVICO, valorCentavos: 42_000 }],
    }),
    { clinicaId: "c1", servicoId: SERVICO, uf: "SP", valorPadraoCentavos: TABELA }
  );
  assert.equal(preco.origem, "tabela");
});

test("a UF é lida sem depender de caixa nem de espaço em volta", async () => {
  const regiao = await regiaoDaUf(bancoFalso({ regioes: [SP] }), " sp ");
  assert.equal(regiao?.id, SP.id);
});

test("sem clínica (catálogo público), a praça ainda decide", async () => {
  const preco = await precoDoServico(
    bancoFalso({ regioes: [SP], precosRegiao: [{ regiaoId: SP.id, servicoId: SERVICO, valorCentavos: 42_000 }] }),
    { servicoId: SERVICO, uf: "SP", valorPadraoCentavos: TABELA }
  );
  assert.equal(preco.valorCentavos, 42_000);
  assert.equal(preco.origem, "regiao");
});

test("em lote, cada serviço resolve na sua própria camada", async () => {
  const servicos = [
    { id: "a", valorPadraoCentavos: 10_000 },
    { id: "b", valorPadraoCentavos: 20_000 },
    { id: "c", valorPadraoCentavos: 30_000 },
  ];
  const precos = await precosDosServicos(
    bancoFalso({
      negociados: [{ clinicaId: "c1", servicoId: "a", valorCentavos: 1_000 }],
      regioes: [SP],
      precosRegiao: [{ regiaoId: SP.id, servicoId: "b", valorCentavos: 2_000 }],
    }),
    { clinicaId: "c1", uf: "SP", servicos }
  );

  assert.deepEqual(
    [...precos.entries()].map(([id, p]) => [id, p.valorCentavos, p.origem]),
    [
      ["a", 1_000, "negociado"],
      ["b", 2_000, "regiao"],
      ["c", 30_000, "tabela"],
    ]
  );
});

test("a tabela do perfil vence a praça, mas perde para o negociado", async () => {
  const banco = bancoFalso({
    regioes: [SP],
    precosRegiao: [{ regiaoId: SP.id, servicoId: SERVICO, valorCentavos: 42_000 }],
    precosTabela: [{ tabelaId: "mandic", servicoId: SERVICO, valorCentavos: 35_000 }],
  });
  const base = { servicoId: SERVICO, uf: "SP", valorPadraoCentavos: TABELA, tabelaIds: ["mandic"] };

  const doPerfil = await precoDoServico(banco, { clinicaId: "c1", ...base });
  assert.equal(doPerfil.valorCentavos, 35_000);
  assert.equal(doPerfil.origem, "perfil");

  const comNegociado = await precoDoServico(
    bancoFalso({
      negociados: [{ clinicaId: "c1", servicoId: SERVICO, valorCentavos: 30_000 }],
      precosTabela: [{ tabelaId: "mandic", servicoId: SERVICO, valorCentavos: 35_000 }],
    }),
    { clinicaId: "c1", ...base }
  );
  assert.equal(comNegociado.origem, "negociado");
});

test("com duas tabelas liberadas, a clínica paga a menor", async () => {
  const preco = await precoDoServico(
    bancoFalso({
      precosTabela: [
        { tabelaId: "particular", servicoId: SERVICO, valorCentavos: 45_000 },
        { tabelaId: "curso", servicoId: SERVICO, valorCentavos: 38_000 },
      ],
    }),
    { clinicaId: "c1", servicoId: SERVICO, valorPadraoCentavos: TABELA, tabelaIds: ["particular", "curso"] }
  );
  assert.equal(preco.valorCentavos, 38_000);
});

test("tabela liberada sem preço para o serviço não interfere — cai na praça", async () => {
  const preco = await precoDoServico(
    bancoFalso({
      regioes: [SP],
      precosRegiao: [{ regiaoId: SP.id, servicoId: SERVICO, valorCentavos: 42_000 }],
      precosTabela: [{ tabelaId: "mandic", servicoId: "outro", valorCentavos: 1 }],
    }),
    { clinicaId: "c1", servicoId: SERVICO, uf: "SP", valorPadraoCentavos: TABELA, tabelaIds: ["mandic"] }
  );
  assert.equal(preco.origem, "regiao");
});

test("em lote, o preço do perfil também entra na cadeia", async () => {
  const precos = await precosDosServicos(
    bancoFalso({ precosTabela: [{ tabelaId: "mandic", servicoId: "a", valorCentavos: 500 }] }),
    {
      clinicaId: "c1",
      tabelaIds: ["mandic"],
      servicos: [
        { id: "a", valorPadraoCentavos: 1_000 },
        { id: "b", valorPadraoCentavos: 2_000 },
      ],
    }
  );
  assert.equal(precos.get("a")?.origem, "perfil");
  assert.equal(precos.get("a")?.valorCentavos, 500);
  assert.equal(precos.get("b")?.origem, "tabela");
});
