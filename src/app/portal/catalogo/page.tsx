import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { Cartao, Titulo, Vazio } from "@/components/ui";
import { agruparPorFamilia } from "@/lib/familia";
import { formatarReais } from "@/lib/dinheiro";
import { precosDosServicos, tabelasDaClinica } from "@/lib/preco";
import { locaisDaClinica } from "@/lib/endereco";
import { servicoVisivel } from "@/lib/visibilidade";
import { descricaoDoPreco } from "@/lib/cobranca";
import { descritivoDaFamilia } from "@/lib/catalogo-familias";

export const dynamic = "force-dynamic";

/**
 * O catálogo que a clínica vê (atas de 28/09 e 01/10) — a primeira tela do
 * portal.
 *
 * Consome a MESMA base de serviços do resto do sistema, não uma cópia em PDF
 * que envelhece sozinha. Descrição, duração e preço são editados num lugar só
 * (Serviços e equipamentos); esta tela só lê.
 *
 * Estrutura: cada equipamento é uma CATEGORIA e os procedimentos dele são as
 * subcategorias — LiteTouch, Platinum e Laser Therapy têm finalidades clínicas
 * diferentes e nunca dividem uma categoria "Laser" genérica.
 *
 * Duas coisas dependem de quem está olhando:
 *   • O QUE aparece: serviço restrito a um perfil ("PRF curso") ou não
 *     atendido na UF do local (laser CO2 no Rio) não é mostrado.
 *   • QUANTO custa: negociado, tabela do perfil, praça do local ou tabela
 *     padrão, nessa ordem (lib/preco.ts). A clínica que atende em mais de um
 *     lugar escolhe o local e o catálogo se ajusta a ele.
 */
export default async function CatalogoDaClinica({ searchParams }: { searchParams: { local?: string } }) {
  const sessao = await exigirClinica();

  const [clinica, locais, tabelaIds] = await Promise.all([
    prisma.clinica.findUnique({
      where: { id: sessao.clinicaId },
      select: { uf: true, perfis: true, perfilDeclarado: true, statusCadastro: true },
    }),
    locaisDaClinica(sessao.clinicaId),
    tabelasDaClinica(prisma, sessao.clinicaId),
  ]);

  const localEscolhido = locais.find((l) => l.id === (searchParams.local ?? "")) ?? locais[0];
  const uf = localEscolhido?.uf ?? clinica?.uf ?? null;

  // Cadastro em análise ainda não tem perfil aprovado: o catálogo já aparece,
  // pelo perfil que a pessoa declarou, para ela conhecer o que vai poder pedir.
  const perfis = clinica?.perfis.length ? clinica.perfis : clinica?.perfilDeclarado ? [clinica.perfilDeclarado] : [];

  const todos = await prisma.servico.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      descricao: true,
      detalhes: true,
      duracaoMin: true,
      familia: true,
      valorPadraoCentavos: true,
      unidadeCobranca: true,
      permiteQuantidade: true,
      rotuloQuantidade: true,
      quantidadeMaxima: true,
      quantidadeMinima: true,
      quantidadeIncluida: true,
      valorAdicionalCentavos: true,
      perfis: true,
      ufsIndisponiveis: true,
    },
  });
  const servicos = todos.filter((s) => servicoVisivel(s, { perfis, uf }));

  const precos = await precosDosServicos(prisma, {
    clinicaId: sessao.clinicaId,
    uf,
    servicos,
    tabelaIds,
  });

  const grupos = agruparPorFamilia(servicos, { fundirSolitarias: false, ordemDoCatalogo: true });
  const podeAgendar = clinica?.statusCadastro === "APROVADO";

  return (
    <>
      <Titulo
        acao={
          <div className="flex flex-wrap items-center gap-2">
            {/* O catálogo institucional em PDF continua disponível (ata de
                05/10) enquanto a marca é redesenhada; os cards abaixo são a
                versão navegável. */}
            <a
              href="/catalogo-hemoderi-2026.pdf"
              download
              className="border border-gray-300 text-bordo text-xs font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-lg hover:bg-gray-50"
            >
              Baixar catálogo (PDF)
            </a>
            {podeAgendar ? (
            <Link
              href="/portal/agendar"
              className="bg-bordo text-white text-xs font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-lg hover:bg-bordoEscuro"
            >
              + Agendar atendimento
            </Link>
            ) : null}
          </div>
        }
      >
        Catálogo
      </Titulo>

      {locais.length > 1 && (
        <div className="mb-4">
          <div className="text-[10px] text-gray-400 mb-1.5">Valores e serviços para o atendimento em:</div>
          <div className="flex flex-wrap gap-2">
            {locais.map((local) => {
              const ativo = local.id === (localEscolhido?.id ?? "");
              return (
                <Link
                  key={local.id || "principal"}
                  href={local.id ? `/portal/catalogo?local=${local.id}` : "/portal/catalogo"}
                  className={`text-[11px] font-semibold px-3 py-2 rounded-lg border transition-colors ${
                    ativo
                      ? "bg-bordo text-white border-bordo"
                      : "bg-white text-bordo border-gray-200 hover:border-bordo/40"
                  }`}
                >
                  {local.rotulo}
                  {local.uf ? ` · ${local.uf}` : ""}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {servicos.length === 0 ? (
        <Cartao>
          <Vazio>Nenhum serviço disponível no momento para o seu cadastro.</Vazio>
        </Cartao>
      ) : (
        grupos.map((grupo) => {
          const descritivo = descritivoDaFamilia(grupo.familia);
          return (
          // Categorias recolhidas, que abrem ao clicar (ata de 02/10): com doze
          // categorias abertas a página virava uma parede de cartões.
          <details key={grupo.familia} className="group mb-3 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-5 py-4 list-none [&::-webkit-details-marker]:hidden">
              {/* A foto da capa da seção no catálogo institucional (pedido de
                  06/10) acompanha o título: a clínica reconhece o equipamento
                  antes de ler o nome. */}
              {descritivo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={descritivo.imagem}
                  alt=""
                  loading="lazy"
                  className="h-14 w-14 shrink-0 rounded-xl border border-gray-100 bg-white object-contain"
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-display font-bold text-bordo text-sm">{grupo.familia}</span>
                <span className="block text-[10px] text-gray-400 mt-0.5">
                  {grupo.servicos.length} procedimento{grupo.servicos.length === 1 ? "" : "s"}
                </span>
              </span>
              <span aria-hidden className="text-bordo text-xs transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>

            {descritivo && (
              <div className="px-5 pb-4">
                <div className="rounded-xl border border-gray-100 bg-bege/60 p-4 flex flex-col md:flex-row gap-4">
                  <figure className="md:w-56 shrink-0 m-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={descritivo.imagem}
                      alt={descritivo.legenda}
                      loading="lazy"
                      className="w-full max-h-64 rounded-lg bg-white object-contain border border-gray-100"
                    />
                    <figcaption className="text-[10px] text-gray-500 mt-1.5 leading-snug">{descritivo.legenda}</figcaption>
                  </figure>
                  <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3 content-start">
                    {descritivo.blocos.map((bloco) => (
                      <div key={bloco.titulo} className="min-w-0">
                        <div className="text-[11px] font-semibold text-bordo mb-1">{bloco.titulo}</div>
                        {bloco.texto && <p className="text-[11px] text-gray-600 leading-relaxed">{bloco.texto}</p>}
                        {bloco.itens && (
                          <ul className="text-[11px] text-gray-600 leading-relaxed space-y-0.5 list-disc pl-4">
                            {bloco.itens.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {descritivo.observacao && (
                  <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">{descritivo.observacao}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-5 pb-5">
              {grupo.servicos.map((servico) => {
                const preco = precos.get(servico.id);
                const valor = preco?.valorCentavos ?? servico.valorPadraoCentavos;
                return (
                  <div key={servico.id} className="border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
                    <div>
                      <div className="text-xs font-semibold text-bordo">{servico.nome}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{servico.duracaoMin} min</div>
                    </div>

                    {servico.descricao && (
                      <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-3">{servico.descricao}</p>
                    )}

                    {/* "Mais detalhes" (ata de 05/10): o resumo do card fica
                        curto; o detalhamento técnico abre sob demanda. */}
                    <details className="group text-[11px]">
                      <summary className="cursor-pointer select-none font-semibold text-bordo hover:underline list-none [&::-webkit-details-marker]:hidden">
                        Mais detalhes <span aria-hidden className="text-[9px] group-open:hidden">▾</span>
                        <span aria-hidden className="text-[9px] hidden group-open:inline">▴</span>
                      </summary>
                      <div className="mt-2 space-y-1.5 text-gray-600 leading-relaxed">
                        {servico.detalhes ? (
                          <p className="whitespace-pre-line">{servico.detalhes}</p>
                        ) : (
                          servico.descricao && <p className="whitespace-pre-line">{servico.descricao}</p>
                        )}
                        <ul className="text-gray-500 space-y-0.5">
                          <li>Duração: {servico.duracaoMin} min</li>
                          <li>Cobrança: {descricaoDoPreco(valor, servico)}</li>
                        </ul>
                      </div>
                    </details>

                    <div className="text-[10px] text-gray-500">
                      {servico.permiteQuantidade
                        ? `Você informa a quantidade${servico.rotuloQuantidade ? ` de ${servico.rotuloQuantidade}` : ""}${
                            servico.quantidadeMinima > 1 ? ` (mínimo ${servico.quantidadeMinima})` : ""
                          }.`
                        : "Uma unidade por agendamento — para repetir, faça outro agendamento."}
                    </div>

                    <div className="mt-auto pt-2 border-t border-gray-100 flex items-end justify-between gap-2">
                      {/* Zero não é "de graça": é tabela ainda não precificada,
                          e escrever R$ 0,00 aqui viraria uma promessa. */}
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-bordo">
                          {valor > 0 ? formatarReais(valor) : "sob consulta"}
                        </span>
                        {valor > 0 && (
                          <span className="block text-[10px] text-gray-400">
                            {descricaoDoPreco(valor, servico).replace(formatarReais(valor), "").trim()}
                          </span>
                        )}
                      </span>
                      {podeAgendar && (
                        <Link
                          href={`/portal/agendar?servico=${servico.id}`}
                          className="text-[11px] font-semibold text-bordo hover:underline whitespace-nowrap"
                        >
                          agendar →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
          );
        })
      )}

      <div className="text-[10px] text-gray-400 leading-relaxed">
        Valores para o seu cadastro{localEscolhido ? ` e o local escolhido (${localEscolhido.rotulo})` : ""}. Para
        procedimentos sob consulta, ou qualquer dúvida sobre o que está incluído, fale com a central.
      </div>
    </>
  );
}
