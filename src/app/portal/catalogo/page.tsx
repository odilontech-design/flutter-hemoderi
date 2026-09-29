import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { Cartao, Titulo, Vazio } from "@/components/ui";
import { agruparPorFamilia } from "@/lib/familia";
import { formatarReais } from "@/lib/dinheiro";
import { precosDosServicos } from "@/lib/preco";

export const dynamic = "force-dynamic";

/**
 * O catálogo que a clínica vê (ata de 28/09).
 *
 * André pediu o catálogo dentro do portal, consumindo a MESMA base de
 * serviços do resto do sistema — não uma cópia em PDF que envelhece sozinha.
 * Por isso aqui não há cadastro nenhum: descrição, duração e preço são
 * editados num lugar só (Serviços e equipamentos), e esta tela lê.
 *
 * O preço é o da clínica que está olhando: negociado, da praça do estado dela
 * ou de tabela, nessa ordem (lib/preco.ts). Duas clínicas em estados
 * diferentes abrem esta página e veem números diferentes — que é exatamente o
 * ponto da precificação por praça.
 */
export default async function CatalogoDaClinica() {
  const sessao = await exigirClinica();

  const [clinica, servicos] = await Promise.all([
    prisma.clinica.findUnique({ where: { id: sessao.clinicaId }, select: { uf: true } }),
    prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        descricao: true,
        duracaoMin: true,
        familia: true,
        valorPadraoCentavos: true,
      },
    }),
  ]);

  const precos = await precosDosServicos(prisma, {
    clinicaId: sessao.clinicaId,
    uf: clinica?.uf,
    servicos,
  });

  const grupos = agruparPorFamilia(servicos);

  return (
    <>
      <Titulo
        acao={
          <Link
            href="/portal/agendar"
            className="bg-bordo text-white text-xs font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-lg hover:bg-bordoEscuro"
          >
            + Agendar atendimento
          </Link>
        }
      >
        Catálogo
      </Titulo>

      {servicos.length === 0 ? (
        <Cartao>
          <Vazio>Nenhum serviço disponível no momento.</Vazio>
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
                  <div
                    key={servico.id}
                    className="border border-gray-200 rounded-xl p-3 flex flex-col gap-2"
                  >
                    <div>
                      <div className="text-xs font-semibold text-bordo">{servico.nome}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{servico.duracaoMin} min</div>
                    </div>

                    {servico.descricao && (
                      <p className="text-[11px] text-gray-600 leading-relaxed">{servico.descricao}</p>
                    )}

                    <div className="mt-auto pt-2 border-t border-gray-100 flex items-baseline justify-between gap-2">
                      {/* Zero não é "de graça": é tabela ainda não precificada,
                          e escrever R$ 0,00 aqui viraria uma promessa. */}
                      <span className="text-sm font-bold text-bordo">
                        {valor > 0 ? formatarReais(valor) : "sob consulta"}
                      </span>
                      <Link
                        href="/portal/agendar"
                        className="text-[11px] font-semibold text-bordo hover:underline whitespace-nowrap"
                      >
                        agendar →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </Cartao>
        ))
      )}

      <div className="text-[10px] text-gray-400 leading-relaxed">
        Valores para a sua clínica. Para procedimentos sob consulta, ou qualquer dúvida sobre o que
        está incluído, fale com a central.
      </div>
    </>
  );
}
