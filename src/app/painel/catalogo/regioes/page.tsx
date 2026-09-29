import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Tabela, Titulo, Vazio } from "@/components/ui";
import { formatarReais } from "@/lib/dinheiro";
import { NovaRegiao } from "./NovaRegiao";
import { PrecoDaRegiao } from "./PrecoDaRegiao";

export const dynamic = "force-dynamic";

/**
 * As praças de preço (ata de 28/09).
 *
 * Uma tela só, com as praças e os preços dentro de cada uma: separar em duas
 * faria a equipe cadastrar a praça num lugar e descobrir noutro que ela está
 * vazia. O valor em branco é o estado normal — significa "usa a tabela do
 * serviço", e é assim que a praça nasce.
 */
export default async function RegioesDePreco() {
  await exigirInterno();

  const [regioes, servicos] = await Promise.all([
    prisma.regiaoPreco.findMany({
      orderBy: [{ ativa: "desc" }, { nome: "asc" }],
      include: { precos: { select: { servicoId: true, valorCentavos: true } } },
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
        Preço por praça
      </Titulo>

      <Cartao className="mb-3">
        <div className="text-[11px] text-gray-500 leading-relaxed mb-3">
          O preço de uma clínica sai da primeira camada que existir:{" "}
          <strong className="text-bordo">o negociado com ela</strong>, senão{" "}
          <strong className="text-bordo">o da praça do estado dela</strong>, senão a tabela do
          serviço. Cada UF pertence a uma praça só.
        </div>
        <NovaRegiao />
      </Cartao>

      {regioes.length === 0 ? (
        <Cartao>
          <Vazio>Nenhuma praça cadastrada — todo mundo paga a tabela do serviço.</Vazio>
        </Cartao>
      ) : (
        regioes.map((regiao) => {
          const porServico = new Map(regiao.precos.map((p) => [p.servicoId, p.valorCentavos]));
          return (
            <Cartao key={regiao.id} className="mb-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                <div className="font-display font-bold text-bordo text-sm">
                  {regiao.nome}
                  {!regiao.ativa && (
                    <span className="ml-2 text-[10px] font-normal text-amber-700">desativada</span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500">{regiao.ufs.join(" · ")}</div>
              </div>
              <div className="text-[10px] text-gray-400 mb-3">
                {porServico.size} de {servicos.length} serviços com preço próprio. Em branco, vale a
                tabela.
              </div>

              <Tabela
                cabecalho={["Serviço", { texto: "Tabela", ocultoMovel: true }, "Preço nesta praça"]}
              >
                {servicos.map((servico) => (
                  <tr key={servico.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3 font-semibold text-bordo">{servico.nome}</td>
                    <td className="py-2 pr-3 text-gray-400 whitespace-nowrap hidden sm:table-cell">
                      {formatarReais(servico.valorPadraoCentavos)}
                    </td>
                    <td className="py-2">
                      <PrecoDaRegiao
                        regiaoId={regiao.id}
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
