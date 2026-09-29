import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Kpi, OCULTO_MOVEL, Tabela, Titulo, Vazio } from "@/components/ui";
import { formatarDataCurta, hojeUTC } from "@/lib/data";
import { formatarAtraso, minutosDeAtraso, TOLERANCIA_MINUTOS } from "@/lib/atraso";

export const dynamic = "force-dynamic";

const PERIODOS = [
  { chave: "30", rotulo: "Últimos 30 dias", dias: 30 },
  { chave: "90", rotulo: "Últimos 90 dias", dias: 90 },
  { chave: "todos", rotulo: "Tudo", dias: null },
];

/**
 * O relatório de atrasos (ata de 28/09).
 *
 * O André pediu depois do caso do Luiz Carlos, perdido dentro de um edifício
 * grande: serve para "alinhar expectativas", não para punir. Por isso mostra
 * a justificativa ao lado do atraso — "elevador de serviço parado" e "saí
 * tarde do atendimento anterior" pedem conversas diferentes, e um ranking de
 * minutos sem contexto produziria a conversa errada.
 *
 * A fonte é o botão de chegada, não GPS: a mesma ata dispensou a
 * geolocalização como prova de presença.
 *
 * O filtro em memória e não no banco é proposital: `houveAtraso` compara o
 * instante do agendamento (data + hora local) com o check-in, e essa conta
 * não existe como coluna para o Postgres comparar. O recorte por período já
 * limita o volume ao que cabe em memória com folga.
 */
export default async function RelatorioDeAtrasos({
  searchParams,
}: {
  searchParams: { periodo?: string };
}) {
  await exigirInterno();

  const periodo = PERIODOS.find((p) => p.chave === searchParams.periodo) ?? PERIODOS[0];
  const desde = periodo.dias
    ? new Date(hojeUTC().getTime() - periodo.dias * 24 * 60 * 60 * 1000)
    : undefined;

  const comChegada = await prisma.pedido.findMany({
    where: { checkinEm: { not: null }, ...(desde ? { data: { gte: desde } } : {}) },
    orderBy: [{ data: "desc" }, { horaInicio: "desc" }],
    select: {
      id: true,
      data: true,
      horaInicio: true,
      checkinEm: true,
      checkinJustificativa: true,
      clinica: { select: { nome: true } },
      servico: { select: { nome: true } },
      profissional: { select: { nome: true } },
    },
  });

  const atrasos = comChegada
    .map((pedido) => ({
      ...pedido,
      minutos: minutosDeAtraso(pedido.data, pedido.horaInicio, pedido.checkinEm!),
    }))
    .filter((pedido) => pedido.minutos > TOLERANCIA_MINUTOS);

  const semJustificativa = atrasos.filter((a) => !a.checkinJustificativa).length;
  const somaMinutos = atrasos.reduce((soma, a) => soma + a.minutos, 0);
  const medio = atrasos.length > 0 ? Math.round(somaMinutos / atrasos.length) : 0;

  return (
    <>
      <Titulo
        acao={
          <Link href="/painel/profissionais" className="text-[11px] font-semibold text-bordo hover:underline">
            ← voltar para profissionais
          </Link>
        }
      >
        Atrasos de chegada
      </Titulo>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Kpi rotulo="Chegadas registradas" valor={String(comChegada.length)} sub={periodo.rotulo.toLowerCase()} />
        <Kpi rotulo="Com atraso" valor={String(atrasos.length)} sub={`acima de ${TOLERANCIA_MINUTOS} min`} />
        <Kpi rotulo="Atraso médio" valor={atrasos.length ? formatarAtraso(medio) : "—"} />
        <Kpi
          rotulo="Sem justificativa"
          valor={String(semJustificativa)}
          sub={semJustificativa ? "vale perguntar" : "todos explicaram"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {PERIODOS.map((p) => (
          <Link
            key={p.chave}
            href={`/painel/profissionais/atrasos?periodo=${p.chave}`}
            className={`text-[11px] font-semibold px-3 py-2.5 sm:py-1.5 rounded-full border ${
              p.chave === periodo.chave
                ? "bg-bordo text-white border-bordo"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {p.rotulo}
          </Link>
        ))}
      </div>

      <Cartao>
        {atrasos.length === 0 ? (
          <Vazio>
            Nenhuma chegada passou de {TOLERANCIA_MINUTOS} minutos {periodo.rotulo.toLowerCase()}.
          </Vazio>
        ) : (
          <Tabela
            cabecalho={[
              "Data",
              "Profissional",
              { texto: "Clínica", ocultoMovel: true },
              { texto: "Combinado", ocultoMovel: true },
              "Chegou",
              "Atraso",
              { texto: "Justificativa", ocultoMovel: true },
            ]}
          >
            {atrasos.map((atraso) => (
              <tr key={atraso.id} className="border-b border-gray-100 last:border-0 align-top">
                <td className="py-2 pr-3 whitespace-nowrap">{formatarDataCurta(atraso.data)}</td>
                <td className="py-2 pr-3 font-semibold text-bordo">
                  {atraso.profissional?.nome ?? "—"}
                  <div className={`text-[10px] font-normal text-gray-400 ${OCULTO_MOVEL}`}>
                    {atraso.servico.nome}
                  </div>
                </td>
                <td className={`py-2 pr-3 text-gray-600 ${OCULTO_MOVEL}`}>{atraso.clinica.nome}</td>
                <td className={`py-2 pr-3 whitespace-nowrap ${OCULTO_MOVEL}`}>{atraso.horaInicio}</td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {atraso.checkinEm!.toLocaleTimeString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap font-semibold text-amber-700">
                  {formatarAtraso(atraso.minutos)}
                </td>
                <td className={`py-2 text-gray-600 min-w-[180px] ${OCULTO_MOVEL}`}>
                  {atraso.checkinJustificativa ?? (
                    <span className="text-gray-300">não informada</span>
                  )}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      <div className="text-[10px] text-gray-400 mt-3 leading-relaxed">
        Conta a partir do botão de chegada do profissional, com tolerância de {TOLERANCIA_MINUTOS}{" "}
        minutos. Atendimento sem chegada registrada não entra aqui — não dá para afirmar que
        atrasou.
      </div>
    </>
  );
}
