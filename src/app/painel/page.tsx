import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Kpi, SeloStatus, Tabela, Titulo, Vazio } from "@/components/ui";
import { competenciaAtual, formatarData, hojeUTC } from "@/lib/data";
import { formatarReais, formatarReaisCurto } from "@/lib/dinheiro";
import { STATUS_PENDENTES } from "@/lib/pedido";

export const dynamic = "force-dynamic";

/**
 * O painel do dia. Responde três perguntas, nesta ordem: o que acontece hoje,
 * o que está parado esperando alguém, e como o mês está indo. A terceira é a
 * menos urgente e por isso vem por último — a fila de pendências é o que faz
 * a operação escalar de 400 para 1.500 atendimentos sem contratar mais gente.
 */
export default async function Hoje() {
  await exigirInterno();

  const hoje = hojeUTC();
  const competencia = competenciaAtual();
  const inicioMes = new Date(`${competencia}-01T00:00:00.000Z`);

  const [doDia, pendentes, semProfissional, realizadosMes, repassesMes, aReceber, porProfissional, faltasMes] =
    await Promise.all([
    prisma.pedido.findMany({
      where: { data: hoje, status: { notIn: ["CANCELADO"] } },
      orderBy: { horaInicio: "asc" },
      include: {
        clinica: { select: { nome: true } },
        servico: { select: { nome: true } },
        profissional: { select: { nome: true } },
      },
    }),
    prisma.pedido.count({ where: { status: { in: STATUS_PENDENTES } } }),
    prisma.pedido.count({ where: { status: "CONFIRMADO", profissionalId: null } }),
    prisma.pedido.aggregate({
      where: { status: "REALIZADO", data: { gte: inicioMes } },
      _count: true,
      _sum: { valorServicoCentavos: true, valorRepasseCentavos: true },
    }),
    prisma.repasse.aggregate({
      where: { competencia, status: "PENDENTE" },
      _sum: { valorCentavos: true },
    }),
    prisma.fatura.aggregate({ where: { status: "ABERTA" }, _sum: { valorCentavos: true } }),
    // Produtividade da competência: quem atendeu quanto, e quanto isso gerou.
    prisma.pedido.groupBy({
      by: ["profissionalId"],
      where: { status: "REALIZADO", data: { gte: inicioMes }, profissionalId: { not: null } },
      _count: true,
      _sum: { valorServicoCentavos: true },
      orderBy: { _count: { profissionalId: "desc" } },
      take: 8,
    }),
    prisma.pedido.count({ where: { status: "FALTOU", data: { gte: inicioMes } } }),
  ]);

  const profissionais = await prisma.profissional.findMany({
    where: { id: { in: porProfissional.map((p) => p.profissionalId as string) } },
    select: { id: true, nome: true },
  });

  // Taxa de comparecimento: dos atendimentos que chegaram ao fim no mês,
  // quantos aconteceram. É o número que diz se o problema de capacidade é de
  // agenda ou de falta — e as duas coisas se resolvem de formas diferentes.
  const fechadosMes = realizadosMes._count + faltasMes;
  const comparecimento = fechadosMes > 0 ? Math.round((realizadosMes._count / fechadosMes) * 100) : null;

  const faturado = realizadosMes._sum.valorServicoCentavos ?? 0;
  const custo = realizadosMes._sum.valorRepasseCentavos ?? 0;

  return (
    <>
      <Titulo>Hoje · {formatarData(hoje)}</Titulo>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi rotulo="Atendimentos hoje" valor={String(doDia.length)} />
        <Kpi
          rotulo="Aguardando ação"
          valor={String(pendentes)}
          sub={semProfissional ? `${semProfissional} sem profissional` : "nada parado"}
        />
        <Kpi
          rotulo="Realizados no mês"
          valor={String(realizadosMes._count)}
          sub={`${formatarReaisCurto(faturado)} em serviços`}
        />
        <Kpi
          rotulo="Margem do mês"
          valor={formatarReaisCurto(faturado - custo)}
          sub={`repasse de ${formatarReaisCurto(custo)}`}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-3 mb-6">
        <Cartao className="lg:col-span-2">
          <div className="font-display font-bold text-bordo text-sm mb-3">Agenda do dia</div>
          {doDia.length === 0 ? (
            <Vazio>Nenhum atendimento marcado para hoje.</Vazio>
          ) : (
            <Tabela cabecalho={["Hora", "Clínica", "Serviço", "Profissional", "Status"]}>
              {doDia.map((pedido) => (
                <tr key={pedido.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-3 font-semibold">{pedido.horaInicio}</td>
                  <td className="py-2 pr-3">{pedido.clinica.nome}</td>
                  <td className="py-2 pr-3 text-gray-500">{pedido.servico.nome}</td>
                  <td className="py-2 pr-3">
                    {pedido.profissional?.nome ?? <span className="text-red-600 font-semibold">a alocar</span>}
                  </td>
                  <td className="py-2 pr-3">
                    <SeloStatus status={pedido.status} />
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>

        <div className="space-y-3">
          <Cartao>
            <div className="text-[11px] text-gray-500 mb-1">A receber de clínicas</div>
            <div className="text-lg font-display font-extrabold text-bordo">
              {formatarReais(aReceber._sum.valorCentavos ?? 0)}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">faturas em aberto</div>
          </Cartao>
          <Cartao>
            <div className="text-[11px] text-gray-500 mb-1">A pagar a profissionais</div>
            <div className="text-lg font-display font-extrabold text-bordo">
              {formatarReais(repassesMes._sum.valorCentavos ?? 0)}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">repasses pendentes da competência</div>
          </Cartao>
          <Link
            href="/painel/pedidos"
            className="block bg-bordo text-white rounded-2xl p-5 text-center text-xs font-semibold hover:bg-bordoEscuro"
          >
            Trabalhar a esteira →
          </Link>
        </div>
      </div>

      <Cartao>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <div className="font-display font-bold text-bordo text-sm">Produtividade do mês</div>
          {comparecimento != null && (
            <div className="text-[11px] text-gray-500">
              Comparecimento: <strong className="text-bordo">{comparecimento}%</strong> ({faltasMes}{" "}
              falta{faltasMes === 1 ? "" : "s"} em {fechadosMes} atendimentos fechados)
            </div>
          )}
        </div>

        {porProfissional.length === 0 ? (
          <Vazio>Nenhum atendimento realizado neste mês ainda.</Vazio>
        ) : (
          <Tabela cabecalho={["Profissional", "Atendimentos", "Serviços gerados", "Participação"]}>
            {porProfissional.map((linha) => {
              const profissional = profissionais.find((p) => p.id === linha.profissionalId);
              const participacao =
                realizadosMes._count > 0 ? Math.round((linha._count / realizadosMes._count) * 100) : 0;
              return (
                <tr key={linha.profissionalId} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-3 font-semibold text-bordo">{profissional?.nome ?? "—"}</td>
                  <td className="py-2 pr-3">{linha._count}</td>
                  <td className="py-2 pr-3 text-gray-600">
                    {formatarReais(linha._sum.valorServicoCentavos ?? 0)}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-bordo rounded-full" style={{ width: `${participacao}%` }} />
                      </div>
                      <span className="text-gray-500 text-[10px]">{participacao}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Tabela>
        )}
      </Cartao>
    </>
  );
}
