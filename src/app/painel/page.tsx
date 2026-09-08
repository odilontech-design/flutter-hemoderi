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

  const [doDia, pendentes, semProfissional, realizadosMes, repassesMes, aReceber] = await Promise.all([
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
  ]);

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
          <div className="font-display font-bold text-navy text-sm mb-3">Agenda do dia</div>
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
                    {pedido.profissional?.nome ?? <span className="text-hemo font-semibold">a alocar</span>}
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
            <div className="text-lg font-display font-extrabold text-navy">
              {formatarReais(aReceber._sum.valorCentavos ?? 0)}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">faturas em aberto</div>
          </Cartao>
          <Cartao>
            <div className="text-[11px] text-gray-500 mb-1">A pagar a profissionais</div>
            <div className="text-lg font-display font-extrabold text-navy">
              {formatarReais(repassesMes._sum.valorCentavos ?? 0)}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">repasses pendentes da competência</div>
          </Cartao>
          <Link
            href="/painel/pedidos"
            className="block bg-navy text-white rounded-2xl p-5 text-center text-xs font-semibold hover:bg-navyDeep"
          >
            Trabalhar a esteira →
          </Link>
        </div>
      </div>
    </>
  );
}
