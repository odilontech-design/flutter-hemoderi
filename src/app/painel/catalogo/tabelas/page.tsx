import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Tabela, Titulo, Vazio } from "@/components/ui";
import { BotaoAcao } from "@/components/BotaoAcao";
import { formatarReais } from "@/lib/dinheiro";
import { duplicarTabela, alternarTabela } from "@/app/actions/tabelas";
import { ROTULO_PERFIL_CLIENTE } from "@/lib/visibilidade";
import { FormularioTabela } from "./FormularioTabela";
import { PrecoDaTabela } from "./PrecoDaTabela";

export const dynamic = "force-dynamic";

/**
 * Tabelas de preço por perfil de cliente (ata de 01/10).
 *
 * A praça varia por LUGAR; a tabela varia por QUEM compra — a Mandic paga
 * diferente de outros cursos e de consultório particular. Uma clínica pode ter
 * mais de uma liberada (o dentista que também dá curso), e o vínculo é feito
 * no cadastro dela. Preço em branco = o serviço não está na tabela.
 */
export default async function TabelasDePreco() {
  await exigirInterno();

  const [tabelas, servicos] = await Promise.all([
    prisma.tabelaPreco.findMany({
      orderBy: [{ ativa: "desc" }, { nome: "asc" }],
      include: {
        itens: { select: { servicoId: true, valorCentavos: true } },
        _count: { select: { clinicas: true } },
      },
    }),
    prisma.servico.findMany({
      where: { ativo: true },
      orderBy: [{ categoria: "asc" }, { nome: "asc" }],
      select: { id: true, nome: true, valorPadraoCentavos: true },
    }),
  ]);

  return (
    <>
      <Titulo
        acao={
          <Link href="/painel/catalogo" className="text-[11px] font-semibold text-bordo hover:underline">
            ← voltar para o catálogo
          </Link>
        }
      >
        Tabelas de preço por perfil
      </Titulo>

      <Cartao className="mb-3">
        <div className="text-[11px] text-gray-500 leading-relaxed mb-3">
          O preço de uma clínica sai da primeira camada que existir:{" "}
          <strong className="text-bordo">o negociado com ela</strong>, senão{" "}
          <strong className="text-bordo">o da tabela do perfil dela</strong> (a menor, se tiver mais de
          uma), senão <strong className="text-bordo">o da praça</strong>, senão a tabela do serviço. As
          tabelas são liberadas a cada clínica no cadastro dela.
        </div>
        <div className="max-w-2xl">
          <FormularioTabela tabelasParaCopiar={tabelas.map((t) => ({ id: t.id, nome: t.nome }))} />
        </div>
      </Cartao>

      {tabelas.length === 0 ? (
        <Cartao>
          <Vazio>Nenhuma tabela criada — todo mundo paga o preço da praça ou o de tabela padrão.</Vazio>
        </Cartao>
      ) : (
        tabelas.map((tabela) => {
          const porServico = new Map(tabela.itens.map((i) => [i.servicoId, i.valorCentavos]));
          return (
            <Cartao key={tabela.id} className="mb-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                <div className="font-display font-bold text-bordo text-sm">
                  {tabela.nome}
                  {tabela.perfil && (
                    <span className="ml-2 text-[10px] font-normal text-gray-500">
                      {ROTULO_PERFIL_CLIENTE[tabela.perfil]}
                    </span>
                  )}
                  {!tabela.ativa && <span className="ml-2 text-[10px] font-normal text-amber-700">desativada</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 whitespace-nowrap">
                  <BotaoAcao acao={duplicarTabela.bind(null, tabela.id)}>Duplicar</BotaoAcao>
                  <BotaoAcao
                    acao={alternarTabela.bind(null, tabela.id, !tabela.ativa)}
                    variante={tabela.ativa ? "perigo" : "secundario"}
                    confirmar={
                      tabela.ativa
                        ? `Desativar "${tabela.nome}" faz as ${tabela._count.clinicas} clínica(s) vinculadas voltarem a pagar o preço da praça ou da tabela padrão. Confirma?`
                        : undefined
                    }
                  >
                    {tabela.ativa ? "Desativar" : "Reativar"}
                  </BotaoAcao>
                </div>
              </div>
              <div className="text-[10px] text-gray-400 mb-3">
                {tabela.descricao ? `${tabela.descricao} · ` : ""}
                {tabela._count.clinicas} clínica(s) vinculada(s) · {porServico.size} de {servicos.length}{" "}
                serviços com preço nesta tabela.
              </div>

              <details className="mb-3">
                <summary className="text-[11px] font-semibold text-bordo cursor-pointer">Editar nome e perfil</summary>
                <div className="mt-3 max-w-2xl">
                  <FormularioTabela tabela={tabela} />
                </div>
              </details>

              <Tabela cabecalho={["Serviço", { texto: "Tabela padrão", ocultoMovel: true }, "Preço nesta tabela"]}>
                {servicos.map((servico) => (
                  <tr key={servico.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3 font-semibold text-bordo">{servico.nome}</td>
                    <td className="py-2 pr-3 text-gray-400 whitespace-nowrap hidden sm:table-cell">
                      {formatarReais(servico.valorPadraoCentavos)}
                    </td>
                    <td className="py-2">
                      <PrecoDaTabela
                        tabelaId={tabela.id}
                        servicoId={servico.id}
                        atual={porServico.get(servico.id) ?? null}
                      />
                    </td>
                  </tr>
                ))}
              </Tabela>
            </Cartao>
          );
        })
      )}
    </>
  );
}
