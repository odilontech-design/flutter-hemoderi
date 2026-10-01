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
          podeAgendar ? (
            <Link
              href="/portal/agendar"
              className="bg-bordo text-white text-xs font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-lg hover:bg-bordoEscuro"
            >
              + Agendar atendimento
            </Link>
          ) : undefined
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
        grupos.map((grupo) => (
          <Cartao key={grupo.familia} className="mb-3">
            <div className="font-display font-bold text-bordo text-sm mb-1">{grupo.familia}</div>
            <div className="text-[10px] text-gray-400 mb-4">
              {grupo.servicos.length} procedimento{grupo.servicos.length === 1 ? "" : "s"}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                      <p className="text-[11px] text-gray-600 leading-relaxed">{servico.descricao}</p>
                    )}

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
          </Cartao>
        ))
      )}

      <div className="text-[10px] text-gray-400 leading-relaxed">
        Valores para o seu cadastro{localEscolhido ? ` e o local escolhido (${localEscolhido.rotulo})` : ""}. Para
        procedimentos sob consulta, ou qualquer dúvida sobre o que está incluído, fale com a central.
      </div>
    </>
  );
}
