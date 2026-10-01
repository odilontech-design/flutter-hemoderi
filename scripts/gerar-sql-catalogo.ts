import { writeFileSync } from "node:fs";
import { SERVICOS_DO_CATALOGO, SERVICOS_APOSENTADOS, dadosDoServico } from "../src/lib/inicializar";

const itens = SERVICOS_DO_CATALOGO.map((def) => {
  const d = dadosDoServico(def);
  return {
    nome: d.nome,
    nomes: [def.nome, ...(def.nomesAnteriores ?? [])],
    familia: d.familia,
    categoria: d.categoria,
    descricao: d.descricao,
    duracao: d.duracaoMin,
    valor: d.valorPadraoCentavos,
    exige: d.exigeEquipamento,
    tipo: d.tipoEquipamento,
    unidade: d.unidadeCobranca,
    permite: d.permiteQuantidade,
    rotulo: d.rotuloQuantidade,
    minima: d.quantidadeMinima,
    incluida: d.quantidadeIncluida,
    adicional: d.valorAdicionalCentavos,
    ufs: [...d.ufsIndisponiveis],
  };
});
const json = JSON.stringify(itens);
if (json.includes("$json$")) throw new Error("delimitador no conteúdo");
const aposentados = JSON.stringify(SERVICOS_APOSENTADOS);

const sql = `-- Atualização do catálogo de serviços para o catálogo 2026 (ata e catálogo de 01/10/2026).
--
-- Fonte: src/lib/inicializar.ts (SERVICOS_DO_CATALOGO), serializada abaixo em JSON.
-- Preços: Grande São Paulo. Gerado por: npx tsx scripts/gerar-sql-catalogo.ts
--
-- Idempotente: serviço que já existe (pelo nome novo OU por um nome anterior) é
-- ATUALIZADO no lugar — o id e os pedidos que apontam para ele continuam
-- valendo —, e o que não existe é criado. Nada é apagado: o que saiu do
-- catálogo é desativado. Roda numa transação só (um bloco DO).
--
-- Rodar UMA vez, depois que a migration 20261001180000 estiver aplicada.
DO $catalogo$
DECLARE
  r jsonb;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements($json$${json}$json$::jsonb) LOOP
    UPDATE "Servico" SET
      "nome" = r->>'nome',
      "familia" = r->>'familia',
      "categoria" = (r->>'categoria')::"CategoriaServico",
      "descricao" = r->>'descricao',
      "duracaoMin" = (r->>'duracao')::int,
      "valorPadraoCentavos" = (r->>'valor')::int,
      "exigeEquipamento" = (r->>'exige')::boolean,
      "tipoEquipamento" = r->>'tipo',
      "unidadeCobranca" = (r->>'unidade')::"UnidadeCobranca",
      "permiteQuantidade" = (r->>'permite')::boolean,
      "rotuloQuantidade" = r->>'rotulo',
      "quantidadeMinima" = (r->>'minima')::int,
      "quantidadeIncluida" = (r->>'incluida')::int,
      "valorAdicionalCentavos" = (r->>'adicional')::int,
      "ufsIndisponiveis" = ARRAY(SELECT jsonb_array_elements_text(r->'ufs')),
      "ativo" = true, "desativadoEm" = NULL, "atualizadoEm" = NOW()
    WHERE "id" = (
      SELECT "id" FROM "Servico"
      WHERE "nome" = ANY(ARRAY(SELECT jsonb_array_elements_text(r->'nomes')))
      ORDER BY ("nome" = r->>'nome') DESC, "criadoEm" LIMIT 1
    );

    IF NOT FOUND THEN
      INSERT INTO "Servico" (
        "id", "nome", "familia", "categoria", "descricao", "duracaoMin", "valorPadraoCentavos",
        "exigeEquipamento", "tipoEquipamento", "unidadeCobranca", "permiteQuantidade", "rotuloQuantidade",
        "quantidadeMinima", "quantidadeIncluida", "valorAdicionalCentavos", "ufsIndisponiveis",
        "ativo", "criadoEm", "atualizadoEm"
      ) VALUES (
        gen_random_uuid()::text, r->>'nome', r->>'familia', (r->>'categoria')::"CategoriaServico", r->>'descricao',
        (r->>'duracao')::int, (r->>'valor')::int, (r->>'exige')::boolean, r->>'tipo',
        (r->>'unidade')::"UnidadeCobranca", (r->>'permite')::boolean, r->>'rotulo',
        (r->>'minima')::int, (r->>'incluida')::int, (r->>'adicional')::int,
        ARRAY(SELECT jsonb_array_elements_text(r->'ufs')), true, NOW(), NOW()
      );
    END IF;
  END LOOP;

  -- Saiu do catálogo atual: desativado, nunca apagado (pedidos antigos apontam para ele).
  UPDATE "Servico" SET "ativo" = false, "desativadoEm" = NOW(), "atualizadoEm" = NOW()
   WHERE "nome" = ANY(ARRAY(SELECT jsonb_array_elements_text($json$${aposentados}$json$::jsonb))) AND "ativo";
END
$catalogo$;
`;
writeFileSync(process.argv[2], sql);
console.log(itens.length, "serviços;", sql.length, "bytes");
