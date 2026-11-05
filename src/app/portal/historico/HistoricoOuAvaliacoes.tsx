import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { Cartao, Kpi, Tabela, Titulo, Vazio } from "@/components/ui";
import { ResumoRealizado } from "@/components/ResumoRealizado";
import { comEnderecoDoPedido, resumoDoEndereco } from "@/lib/endereco";
import { formatarDataCurta } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { formatarMedia, mediaDeNotas } from "@/lib/avaliacao";
import { situacaoDoPagamento } from "@/lib/pagamento-cliente";
import { recebidoNoAto } from "@/lib/recebimento";
import { SeloStatusCliente } from "@/components/SeloStatusCliente";
import { AvaliarAtendimento } from "../AvaliarAtendimento";
import { ResponderNps } from "../ResponderNps";
import { PagarPendencias } from "./PagarPendencias";
import { asaasConfigurado, tabelaDeJuros } from "@/lib/integracoes/asaas";

/**
 * Histórico e avaliações (ata de 05/10): o que já aconteceu, numa página
 * própria abaixo dos próximos agendamentos — com o que ainda pesa para o
 * cliente em destaque: pagamento pendente e avaliação pendente.
 *
 * Os serviços de uma mesma visita aparecem como UMA linha.
 */
/**
 * Desde a ata de 03/11 são duas páginas: Histórico (o que aconteceu e o que
 * falta pagar, com as pendências no topo) e Avaliações (a nota de cada
 * atendimento e a pesquisa de satisfação). A consulta é a mesma.
 */
export async function HistoricoOuAvaliacoes({ modo }: { modo: "historico" | "avaliacoes" }) {
  const sessao = await exigirClinica();

  const [historico, notasDadas, npsPendente] = await Promise.all([
    prisma.pedido.findMany({
      where: { apoioDeId: null, clinicaId: sessao.clinicaId, status: { in: ["REALIZADO", "FALTOU", "CANCELADO"] } },
      orderBy: [{ data: "desc" }, { horaInicio: "desc" }],
      take: 120,
      include: {
        servico: { select: { nome: true } },
        profissional: { select: { nome: true } },
        clinica: { select: { nome: true, endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true } },
        endereco: { select: { rotulo: true, endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true } },
        avaliacao: { select: { nota: true } },
        fatura: { select: { id: true, status: true } },
        // O que o profissional declarou ter recebido no ato conta como pago.
        relatorio: { select: { recebimento: true, aprovadoEm: true } },
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
        pagoOnline: Boolean(p.pixPagoEm || p.cartaoPagoEm),
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
      <Titulo>{modo === "historico" ? "Histórico" : "Avaliações"}</Titulo>

      {modo === "historico" ? (
        <div className="grid grid-cols-2 gap-3 mb-6 max-w-xl">
          <Kpi rotulo="Realizados" valor={String(realizadas.length)} />
          <Kpi
            rotulo="Pagamento pendente"
            valor={String(comPagamentoPendente)}
            sub={comPagamentoPendente ? "atendimentos a acertar" : "tudo em dia"}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-6 max-w-xl">
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
      )}

      {/* Área financeira (ata de 03/11): o que falta pagar aparece primeiro. */}
      {modo === "historico" && comPagamentoPendente > 0 && (
        <Cartao className="mb-3 border-rose-200 bg-rose-50/40">
          <div className="font-display font-bold text-rose-700 text-sm mb-2">Pagamentos pendentes ({comPagamentoPendente})</div>
          <PagarPendencias
            cartao={asaasConfigurado() ? { juros: tabelaDeJuros() } : null}
            pendencias={realizadas
              .filter((v) => pagamentoDaVisita(v.itens) === "pendente")
              .map(({ chave, itens }) => ({
                chave,
                data: formatarDataCurta(itens[0].data),
                servicos: itens.map((p) => p.servico.nome).join(" + "),
                valorCentavos: itens.reduce((t, p) => t + p.valorServicoCentavos, 0),
                pedidoIds: itens.map((p) => p.id),
                resumoId: itens[0].id,
                naFatura: itens.some((p) => p.fatura),
              }))}
          />
        </Cartao>
      )}

      {modo === "avaliacoes" && npsPendente && (
        <Cartao className="mb-3 border-bordo/20 bg-bege/60">
          <div className="font-display font-bold text-bordo text-sm mb-1">Pesquisa de satisfação</div>
          <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
            Faz um tempo que a gente não vê muito movimento — e é exatamente por isso que a sua opinião vale mais
            agora. Uma nota e três perguntas opcionais.
          </div>
          <ResponderNps pesquisaId={npsPendente.id} />
        </Cartao>
      )}

      <Cartao className="mb-3">
        <div className="font-display font-bold text-bordo text-sm mb-3">
          {modo === "historico" ? "Procedimentos realizados" : "Avalie os atendimentos"}
        </div>
        {realizadas.length === 0 ? (
          <Vazio>Nenhum procedimento realizado ainda.</Vazio>
        ) : modo === "avaliacoes" ? (
          <Tabela cabecalho={["Data", "Serviços", "Profissional", "Sua avaliação"]}>
            {realizadas.map(({ chave, itens }) => {
              const avaliavel = itens.find((p) => p.status === "REALIZADO" && p.profissional);
              return (
                <tr key={chave} className="border-b border-gray-100 last:border-0 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{formatarDataCurta(itens[0].data)}</td>
                  <td className="py-2 pr-3 text-gray-600">{itens.map((p) => p.servico.nome).join(" + ")}</td>
                  <td className="py-2 pr-3 text-gray-600">
                    {Array.from(new Set(itens.map((p) => p.profissional?.nome).filter(Boolean))).join(", ") || "—"}
                  </td>
                  <td className="py-2 min-w-[180px]">
                    {avaliavel ? <AvaliarAtendimento pedidoId={avaliavel.id} atual={avaliavel.avaliacao} /> : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </Tabela>
        ) : (
          <Tabela cabecalho={["Data", "Serviços", "Profissional", "Pagamento", "Status"]}>
            {realizadas.map(({ chave, itens }) => {
              const primeiro = itens[0];
              const pagamento = pagamentoDaVisita(itens);
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
                    <ResumoRealizado
                      local={resumoDoEndereco(comEnderecoDoPedido(primeiro.clinica, primeiro.endereco))}
                      horaInicio={primeiro.horaInicio}
                      doutorNome={primeiro.doutorNome}
                      pacienteNome={primeiro.pacienteNome}
                      procedimentoPaciente={primeiro.procedimentoPaciente}
                      formaPagamento={primeiro.formaPagamento}
                      observacoes={primeiro.observacoes}
                    />
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
                      <>
                        <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">
                          Pago
                        </span>
                        {/* Duas opções de recibo (30/10): o do atendimento e, quando
                            ele foi pago numa fatura mensal, o da fatura. */}
                        <span className="mt-1 flex flex-col gap-0.5 text-[10px] font-semibold">
                          <Link href={`/recibo/agendamento/${primeiro.id}`} className="text-bordo hover:underline">
                            Recibo do atendimento
                          </Link>
                          {itens.find((p) => p.fatura?.status === "PAGA") && (
                            <Link
                              href={`/recibo/fatura/${itens.find((p) => p.fatura?.status === "PAGA")!.fatura!.id}`}
                              className="text-bordo hover:underline"
                            >
                              Recibo da fatura
                            </Link>
                          )}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <SeloStatusCliente status={primeiro.status} />
                    {/* Relatório do atendimento, depois que a central aprova (ata de 20/10). */}
                    {itens
                      .filter((p) => p.relatorio?.aprovadoEm)
                      .map((p) => (
                        <Link
                          key={p.id}
                          href={`/portal/relatorio/${p.id}`}
                          className="block text-[11px] font-semibold text-bordo hover:underline mt-1 whitespace-nowrap"
                        >
                          Ver relatório{itens.length > 1 ? ` · ${p.servico.nome}` : ""}
                        </Link>
                      ))}
                  </td>
                </tr>
              );
            })}
          </Tabela>
        )}
      </Cartao>

      {modo === "historico" && canceladas.length > 0 && (
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
