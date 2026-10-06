import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { Cartao, Kpi, Tabela, Titulo, Vazio } from "@/components/ui";
import { formatarDataCurta } from "@/lib/data";
import { formatarMedia, mediaDeNotas } from "@/lib/avaliacao";
import { situacaoDoPagamento } from "@/lib/pagamento-cliente";
import { recebidoNoAto } from "@/lib/recebimento";
import { SeloStatusCliente } from "@/components/SeloStatusCliente";
import { AvaliarAtendimento } from "../AvaliarAtendimento";
import { ResponderNps } from "../ResponderNps";

export const dynamic = "force-dynamic";

/**
 * Histórico e avaliações (ata de 05/10): o que já aconteceu, numa página
 * própria abaixo dos próximos agendamentos — com o que ainda pesa para o
 * cliente em destaque: pagamento pendente e avaliação pendente.
 *
 * Os serviços de uma mesma visita aparecem como UMA linha.
 */
export default async function HistoricoEAvaliacoes() {
  const sessao = await exigirClinica();

  const [historico, notasDadas, npsPendente] = await Promise.all([
    prisma.pedido.findMany({
      where: { clinicaId: sessao.clinicaId, status: { in: ["REALIZADO", "FALTOU", "CANCELADO"] } },
      orderBy: [{ data: "desc" }, { horaInicio: "desc" }],
      take: 120,
      include: {
        servico: { select: { nome: true } },
        profissional: { select: { nome: true } },
        avaliacao: { select: { nota: true, comentario: true } },
        fatura: { select: { status: true } },
        // O que o profissional declarou ter recebido no ato conta como pago.
        relatorio: { select: { recebimento: true } },
      },
    }),
    prisma.avaliacao.findMany({ where: { clinicaId: sessao.clinicaId }, select: { nota: true } }),
    // No máximo uma pesquisa pendente por vez na prática (cadência de 60 dias).
    prisma.pesquisaNps.findFirst({
      where: { clinicaId: sessao.clinicaId, respondidaEm: null },
      orderBy: { criadaEm: "asc" },
      select: { id: true },
    }),
  ]);

  // Uma visita = os pedidos do mesmo grupo.
  const visitas: { chave: string; itens: typeof historico }[] = [];
  for (const pedido of historico) {
    const existente = pedido.grupoId ? visitas.find((v) => v.chave === pedido.grupoId) : undefined;
    if (existente) existente.itens.push(pedido);
    else visitas.push({ chave: pedido.grupoId ?? pedido.id, itens: [pedido] });
  }
  const realizadas = visitas.filter((v) => v.itens[0].status !== "CANCELADO");
  const canceladas = visitas.filter((v) => v.itens[0].status === "CANCELADO");

  const pagamentoDaVisita = (itens: typeof historico) => {
    const situacoes = itens.map((p) =>
      situacaoDoPagamento({
        status: p.status,
        fatura: p.fatura,
        recebidoNoAto: recebidoNoAto(p.relatorio?.recebimento),
      })
    );
    if (situacoes.every((s) => s === null)) return null;
    return situacoes.some((s) => s === "pendente") ? "pendente" : "pago";
  };
  const comPagamentoPendente = realizadas.filter((v) => pagamentoDaVisita(v.itens) === "pendente").length;
  const aAvaliar = realizadas.filter((v) => v.itens.some((p) => p.status === "REALIZADO" && p.profissional && !p.avaliacao));
  const minhaMedia = mediaDeNotas(notasDadas.map((a) => a.nota));

  return (
    <>
      <Titulo>Histórico e avaliações</Titulo>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi rotulo="Realizados" valor={String(realizadas.length)} />
        <Kpi
          rotulo="Pagamento pendente"
          valor={String(comPagamentoPendente)}
          sub={comPagamentoPendente ? "atendimentos a acertar" : "tudo em dia"}
        />
        <Kpi
          rotulo="Avaliações pendentes"
          valor={String(aAvaliar.length)}
          sub={aAvaliar.length ? "sua nota ajuda a escolher quem volta" : "nenhuma"}
        />
        <Kpi
          rotulo="Média que você deu"
          valor={formatarMedia(minhaMedia)}
          sub={notasDadas.length ? `${notasDadas.length} avaliação(ões)` : "nenhuma avaliação ainda"}
        />
      </div>

      {npsPendente && (
        <Cartao className="mb-3 border-bordo/20 bg-bege/60">
          <div className="font-display font-bold text-bordo text-sm mb-1">Pesquisa de satisfação</div>
          <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
            Faz um tempo que a gente não vê muito movimento — e é exatamente por isso que a sua opinião vale mais
            agora. Duas perguntas, sem compromisso.
          </div>
          <ResponderNps pesquisaId={npsPendente.id} />
        </Cartao>
      )}

      <Cartao className="mb-3">
        <div className="font-display font-bold text-bordo text-sm mb-3">Procedimentos realizados</div>
        {realizadas.length === 0 ? (
          <Vazio>Nenhum procedimento realizado ainda.</Vazio>
        ) : (
          <Tabela cabecalho={["Data", "Serviços", "Profissional", "Pagamento", "Status", "Sua avaliação"]}>
            {realizadas.map(({ chave, itens }) => {
              const primeiro = itens[0];
              const pagamento = pagamentoDaVisita(itens);
              const avaliavel = itens.find((p) => p.status === "REALIZADO" && p.profissional);
              return (
                <tr key={chave} className="border-b border-gray-100 last:border-0 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{formatarDataCurta(primeiro.data)}</td>
                  <td className="py-2 pr-3 text-gray-600">
                    {itens.map((pedido) => (
                      <div key={pedido.id}>
                        {pedido.servico.nome}
                        {pedido.quantidade > 1 && <span className="text-gray-400"> × {pedido.quantidade}</span>}
                      </div>
                    ))}
                  </td>
                  <td className="py-2 pr-3 text-gray-600">
                    {Array.from(new Set(itens.map((p) => p.profissional?.nome).filter(Boolean))).join(", ") || "—"}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {pagamento === "pendente" ? (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-rose-100 text-rose-700">
                        Pagamento pendente
                      </span>
                    ) : pagamento === "pago" ? (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">
                        Pago
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <SeloStatusCliente status={primeiro.status} />
                  </td>
                  <td className="py-2 min-w-[180px]">
                    {/* Só atendimento realizado com profissional se avalia:
                        cancelado e falta não são trabalho de ninguém. A nota é
                        do profissional da visita (o primeiro realizado). */}
                    {avaliavel ? (
                      <AvaliarAtendimento pedidoId={avaliavel.id} atual={avaliavel.avaliacao} compacto />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </Tabela>
        )}
      </Cartao>

      {canceladas.length > 0 && (
        <details className="mb-3 bg-white rounded-2xl border border-gray-200 px-5 py-3">
          <summary className="cursor-pointer select-none text-xs font-semibold text-gray-500">
            Agendamentos cancelados ({canceladas.length})
          </summary>
          <div className="mt-3">
            <Tabela cabecalho={["Data", "Serviços", "Status"]}>
              {canceladas.map(({ chave, itens }) => (
                <tr key={chave} className="border-b border-gray-100 last:border-0 align-top">
                  <td className="py-2 pr-3">{formatarDataCurta(itens[0].data)}</td>
                  <td className="py-2 pr-3 text-gray-600">
                    {itens.map((p) => (
                      <div key={p.id}>{p.servico.nome}</div>
                    ))}
                  </td>
                  <td className="py-2 pr-3">
                    <SeloStatusCliente status="CANCELADO" />
                  </td>
                </tr>
              ))}
            </Tabela>
          </div>
        </details>
      )}
    </>
  );
}
