import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Kpi, Tabela, Titulo, Vazio } from "@/components/ui";
import { BotaoAcao } from "@/components/BotaoAcao";
import { baixarFatura, fecharFatura, pagarRepasses } from "@/app/actions/financeiro";
import { competenciaAtual, competenciaPorExtenso, formatarData } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";

export const dynamic = "force-dynamic";

function competenciaVizinha(competencia: string, passo: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 + passo, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * As duas contas do mês, lado a lado e separadas: o que entra das clínicas e
 * o que sai para os profissionais. A diferença entre elas é a margem — o
 * número que diz se crescer de 400 para 1.500 atendimentos melhora ou piora o
 * resultado.
 */
export default async function Financeiro({ searchParams }: { searchParams: { competencia?: string } }) {
  await exigirInterno();

  const competencia = searchParams.competencia ?? competenciaAtual();
  const [ano, mes] = competencia.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 1));

  const [realizados, faturas, repasses, aFaturar] = await Promise.all([
    prisma.pedido.aggregate({
      where: { status: "REALIZADO", data: { gte: inicio, lt: fim } },
      _count: true,
      _sum: { valorServicoCentavos: true, valorRepasseCentavos: true },
    }),
    prisma.fatura.findMany({
      where: { competencia },
      orderBy: { numero: "asc" },
      include: { clinica: { select: { nome: true } }, _count: { select: { pedidos: true } } },
    }),
    prisma.repasse.groupBy({
      by: ["profissionalId", "status"],
      where: { competencia },
      _sum: { valorCentavos: true },
      _count: true,
    }),
    // Atendimentos realizados que ainda não entraram em nenhuma fatura —
    // é essa a lista que o fechamento do mês consome.
    prisma.pedido.groupBy({
      by: ["clinicaId"],
      where: { status: "REALIZADO", faturaId: null, data: { gte: inicio, lt: fim } },
      _sum: { valorServicoCentavos: true },
      _count: true,
    }),
  ]);

  const clinicas = await prisma.clinica.findMany({
    where: { id: { in: aFaturar.map((a) => a.clinicaId) } },
    select: { id: true, nome: true },
  });
  const profissionais = await prisma.profissional.findMany({
    where: { id: { in: Array.from(new Set(repasses.map((r) => r.profissionalId))) } },
    select: { id: true, nome: true, chavePix: true },
  });

  const faturado = realizados._sum.valorServicoCentavos ?? 0;
  const custo = realizados._sum.valorRepasseCentavos ?? 0;

  const porProfissional = profissionais.map((profissional) => {
    const linhas = repasses.filter((r) => r.profissionalId === profissional.id);
    const pendente = linhas.find((l) => l.status === "PENDENTE");
    const pago = linhas.find((l) => l.status === "PAGO");
    const aguardando = linhas.find((l) => l.status === "AGUARDANDO_APROVACAO");
    return {
      ...profissional,
      pendenteCentavos: pendente?._sum.valorCentavos ?? 0,
      pendenteQtd: pendente?._count ?? 0,
      pagoCentavos: pago?._sum.valorCentavos ?? 0,
      aguardandoCentavos: aguardando?._sum.valorCentavos ?? 0,
      aguardandoQtd: aguardando?._count ?? 0,
    };
  });

  return (
    <>
      <Titulo
        acao={
          <div className="flex items-center gap-2 text-xs">
            <Link
              href={`/painel/financeiro?competencia=${competenciaVizinha(competencia, -1)}`}
              className="px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center text-gray-500"
            >
              ‹
            </Link>
            <span className="font-semibold text-bordo">{competenciaPorExtenso(competencia)}</span>
            <Link
              href={`/painel/financeiro?competencia=${competenciaVizinha(competencia, 1)}`}
              className="px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center text-gray-500"
            >
              ›
            </Link>
            <a
              href={`/painel/financeiro/exportar?competencia=${competencia}`}
              className="ml-2 border border-gray-300 rounded-lg px-3 py-1.5 min-h-[40px] sm:min-h-0 inline-flex items-center font-semibold text-bordo hover:bg-gray-50"
            >
              Exportar CSV
            </a>
          </div>
        }
      >
        Financeiro
      </Titulo>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi rotulo="Atendimentos realizados" valor={String(realizados._count)} />
        <Kpi rotulo="Serviços (a receber)" valor={formatarReais(faturado)} />
        <Kpi rotulo="Repasses (a pagar)" valor={formatarReais(custo)} />
        <Kpi
          rotulo="Margem"
          valor={formatarReais(faturado - custo)}
          sub={faturado > 0 ? `${Math.round(((faturado - custo) / faturado) * 100)}% do faturado` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-3">A receber · clínicas</div>

          {aFaturar.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] text-gray-500 mb-2">Pronto para faturar</div>
              <Tabela cabecalho={["Clínica", "Atendimentos", "Valor", ""]}>
                {aFaturar.map((linha) => {
                  const clinica = clinicas.find((c) => c.id === linha.clinicaId);
                  return (
                    <tr key={linha.clinicaId} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-3 font-semibold text-bordo">{clinica?.nome ?? "—"}</td>
                      <td className="py-2 pr-3 text-gray-500">{linha._count}</td>
                      <td className="py-2 pr-3">{formatarReais(linha._sum.valorServicoCentavos ?? 0)}</td>
                      <td className="py-2">
                        <BotaoAcao acao={fecharFatura.bind(null, linha.clinicaId, competencia)} variante="primario">
                          Fechar fatura
                        </BotaoAcao>
                      </td>
                    </tr>
                  );
                })}
              </Tabela>
            </div>
          )}

          <div className="text-[11px] text-gray-500 mb-2">Faturas da competência</div>
          {faturas.length === 0 ? (
            <Vazio>Nenhuma fatura fechada.</Vazio>
          ) : (
            <Tabela cabecalho={["Nº", "Clínica", "Vencimento", "Valor", "Status", ""]}>
              {faturas.map((fatura) => (
                <tr key={fatura.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-3 font-semibold">{fatura.numero}</td>
                  <td className="py-2 pr-3">{fatura.clinica.nome}</td>
                  <td className="py-2 pr-3 text-gray-500">{formatarData(fatura.vencimento)}</td>
                  <td className="py-2 pr-3">{formatarReais(fatura.valorCentavos)}</td>
                  <td className="py-2 pr-3">
                    {fatura.status === "PAGA" ? (
                      <span className="text-emerald-700 font-semibold">paga</span>
                    ) : (
                      <span className="text-amber-700 font-semibold">aberta</span>
                    )}
                  </td>
                  <td className="py-2">
                    {fatura.status === "ABERTA" && (
                      <BotaoAcao acao={baixarFatura.bind(null, fatura.id)}>Dar baixa</BotaoAcao>
                    )}
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>

        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-3">A pagar · profissionais</div>
          {porProfissional.length === 0 ? (
            <Vazio>Nenhum repasse nesta competência.</Vazio>
          ) : (
            <Tabela cabecalho={["Profissional", "Aguardando conferência", "Liberado", "Já pago", ""]}>
              {porProfissional.map((profissional) => (
                <tr key={profissional.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-3">
                    <div className="font-semibold text-bordo">{profissional.nome}</div>
                    <div className="text-[10px] text-gray-400">{profissional.chavePix ?? "sem chave PIX"}</div>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {profissional.aguardandoCentavos > 0 ? (
                      <>
                        <span className="text-amber-700 font-semibold">
                          {formatarReais(profissional.aguardandoCentavos)}
                        </span>
                        <div className="text-[10px] text-gray-400">
                          {profissional.aguardandoQtd} relatório(s) a conferir
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {formatarReais(profissional.pendenteCentavos)}
                    {profissional.pendenteQtd > 0 && (
                      <span className="text-[10px] text-gray-400"> · {profissional.pendenteQtd} atend.</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-gray-500">{formatarReais(profissional.pagoCentavos)}</td>
                  <td className="py-2">
                    {profissional.pendenteCentavos > 0 && (
                      <BotaoAcao
                        acao={pagarRepasses.bind(null, profissional.id, competencia)}
                        variante="primario"
                        confirmar={`Marcar ${formatarReais(profissional.pendenteCentavos)} como pago a ${profissional.nome}?`}
                      >
                        Marcar pago
                      </BotaoAcao>
                    )}
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
          <div className="text-[10px] text-gray-400 mt-3">
            Só entra aqui atendimento com relatório de comparecimento. Falta não gera repasse
            automático.
          </div>
        </Cartao>
      </div>
    </>
  );
}
