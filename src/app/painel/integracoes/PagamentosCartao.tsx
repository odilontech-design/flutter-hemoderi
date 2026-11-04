import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Cartao, Kpi, Tabela, Vazio } from "@/components/ui";
import { BotaoAcao } from "@/components/BotaoAcao";
import { formatarDataHora } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { asaasConfigurado, ambienteAsaas, tabelaDeJuros } from "@/lib/integracoes/asaas";
import { emAberto, ROTULO_STATUS_CARTAO, type StatusCartao } from "@/lib/asaas-status";
import {
  cancelarCobrancaCartao,
  conferirCobrancaCartao,
  conferirCobrancasEmAberto,
  reabrirAtendimentosEstornados,
  testarConexaoAsaas,
} from "@/app/actions/asaas";

const COR: Record<StatusCartao, string> = {
  PENDENTE: "bg-amber-100 text-amber-800",
  PAGA: "bg-green-100 text-green-800",
  VENCIDA: "bg-gray-200 text-gray-700",
  CANCELADA: "bg-gray-100 text-gray-500",
  ESTORNADA: "bg-purple-100 text-purple-800",
  CONTESTADA: "bg-red-100 text-red-700",
  RECUSADA: "bg-red-100 text-red-700",
};

const TRES_DIAS = 3 * 24 * 60 * 60 * 1000;

/**
 * As cobranças de cartão do Asaas à vista da equipe: o que está aguardando, o
 * que foi pago, e o que pede decisão — estorno, contestação, pagamento em
 * duplicidade, link velho. Antes só dava para saber olhando o painel do
 * Asaas; um webhook que falhasse deixava o atendimento "não pago" sem ninguém
 * ver. Aqui a equipe confere com o Asaas, cancela um link velho e reabre o que
 * foi estornado.
 */
export async function PagamentosCartao() {
  const configurado = asaasConfigurado();
  const trintaDias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [cobrancas, porStatus, pagas30, eventos, ultimoEvento] = await Promise.all([
    prisma.cobrancaCartao.findMany({ orderBy: { criadaEm: "desc" }, take: 40 }),
    prisma.cobrancaCartao.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.cobrancaCartao.aggregate({
      where: { status: "PAGA", pagoEm: { gte: trintaDias } },
      _sum: { valorTotalCentavos: true },
      _count: { _all: true },
    }),
    prisma.eventoAsaas.findMany({ orderBy: { recebidoEm: "desc" }, take: 8 }),
    prisma.eventoAsaas.findFirst({ orderBy: { recebidoEm: "desc" }, select: { recebidoEm: true } }),
  ]);

  const contagem = Object.fromEntries(porStatus.map((g) => [g.status, g._count._all])) as Record<string, number>;
  const clinicas = await prisma.clinica.findMany({
    where: { id: { in: Array.from(new Set(cobrancas.map((c) => c.clinicaId))) } },
    select: { id: true, nome: true },
  });
  const nomeDe = new Map(clinicas.map((c) => [c.id, c.nome]));

  const agora = Date.now();
  const alertas = [
    ...cobrancas
      .filter((c) => c.duplicada)
      .map((c) => `${nomeDe.get(c.clinicaId) ?? "Clínica"}: pagou em duplicidade (${formatarReais(c.valorTotalCentavos)}). Estorne uma das cobranças no painel do Asaas.`),
    ...cobrancas
      .filter((c) => c.status === "ESTORNADA" && !c.observacao)
      .map((c) => `${nomeDe.get(c.clinicaId) ?? "Clínica"}: cobrança de ${formatarReais(c.valorTotalCentavos)} estornada. Se o dinheiro voltou ao cliente, reabra os atendimentos.`),
    ...cobrancas
      .filter((c) => c.status === "CONTESTADA")
      .map((c) => `${nomeDe.get(c.clinicaId) ?? "Clínica"}: contestação (chargeback) de ${formatarReais(c.valorTotalCentavos)}. Acompanhe no painel do Asaas.`),
  ];
  const velhas = cobrancas.filter((c) => emAberto(c.status) && agora - c.criadaEm.getTime() > TRES_DIAS).length;
  const abertas = (contagem.PENDENTE ?? 0) + (contagem.VENCIDA ?? 0) + (contagem.RECUSADA ?? 0);

  const urlDoWebhook = `${process.env.NEXTAUTH_URL?.trim() || "https://app.hemoderi.com.br"}/api/asaas/webhook`;
  const webhookProtegido = Boolean(process.env.ASAAS_WEBHOOK_TOKEN?.trim());
  const comJuros = tabelaDeJuros().some((j) => j > 0);

  return (
    <div className="mb-6">
      <div className="font-display font-bold text-bordo text-base mb-2">Cartão (Asaas)</div>

      {!configurado ? (
        <Cartao className="mb-3 border-amber-200 bg-amber-50/40">
          <div className="text-[11px] text-amber-800 leading-relaxed">
            O pagamento com cartão ainda não está ligado. Falta cadastrar na Vercel (nunca no chat) a chave{" "}
            <code>ASAAS_API_KEY</code>, o token <code>ASAAS_WEBHOOK_TOKEN</code> e, se houver acréscimo no parcelamento, a tabela{" "}
            <code>ASAAS_JUROS_PARCELAS</code>. No painel do Asaas, cadastre o webhook em <code>{urlDoWebhook}</code> com o mesmo token.
          </div>
        </Cartao>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
            <div className="mr-auto text-xs">
              <div className="font-semibold text-bordo">Conexão: {ambienteAsaas()}</div>
              <div className="text-[10px] text-gray-500">
                Webhook {webhookProtegido ? "com token" : "SEM TOKEN (rejeitando tudo)"}
                {ultimoEvento ? ` · último aviso: ${formatarDataHora(ultimoEvento.recebidoEm)}` : " · nenhum aviso recebido ainda"}
                {" · "}
                {comJuros ? "parcelamento com acréscimo" : "parcelamento sem acréscimo"}
              </div>
              <div className="text-[10px] text-gray-400 break-all">Endereço do webhook no Asaas: {urlDoWebhook}</div>
            </div>
            <BotaoAcao tela acao={testarConexaoAsaas}>Testar conexão</BotaoAcao>
            {abertas > 0 && <BotaoAcao tela acao={conferirCobrancasEmAberto}>Conferir em aberto ({abertas})</BotaoAcao>}
          </div>

          {!webhookProtegido && (
            <Cartao className="mb-3 border-amber-200 bg-amber-50/40">
              <div className="text-[11px] text-amber-800">
                <code>ASAAS_WEBHOOK_TOKEN</code> não está configurado: os avisos de pagamento são rejeitados e só a conferência
                (botão acima, e de hora em hora) baixa os pagamentos.
              </div>
            </Cartao>
          )}

          {alertas.length > 0 && (
            <Cartao className="mb-3 border-red-200 bg-red-50/40">
              <div className="font-display font-bold text-red-700 text-sm mb-1">Pede uma decisão</div>
              <ul className="text-[11px] text-red-800 space-y-0.5 list-disc pl-4">
                {alertas.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Cartao>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <Kpi rotulo="Aguardando pagamento" valor={String(abertas)} sub={velhas ? `${velhas} com mais de 3 dias` : "links ainda abertos"} />
            <Kpi rotulo="Pagas (30 dias)" valor={String(pagas30._count._all)} sub={formatarReais(pagas30._sum.valorTotalCentavos ?? 0)} />
            <Kpi rotulo="Estornadas" valor={String(contagem.ESTORNADA ?? 0)} />
            <Kpi rotulo="Contestadas / recusadas" valor={String((contagem.CONTESTADA ?? 0) + (contagem.RECUSADA ?? 0))} />
          </div>

          <Cartao className="mb-3">
            <div className="font-display font-bold text-bordo text-sm mb-3">Cobranças recentes</div>
            {cobrancas.length === 0 ? (
              <Vazio>Nenhuma cobrança de cartão ainda.</Vazio>
            ) : (
              <Tabela cabecalho={["Criada", "Clínica", "Atendimentos", "Total", "Situação", "Ação"]}>
                {cobrancas.map((c) => {
                  const status = (c.status in ROTULO_STATUS_CARTAO ? c.status : "PENDENTE") as StatusCartao;
                  return (
                    <tr key={c.id} className="border-b border-gray-100 last:border-0 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap text-gray-500">{formatarDataHora(c.criadaEm)}</td>
                      <td className="py-2 pr-3 min-w-[140px]">
                        <Link href={`/painel/clinicas/${c.clinicaId}`} className="font-semibold text-bordo hover:underline">
                          {nomeDe.get(c.clinicaId) ?? "Clínica"}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{c.pedidoIds.length}</td>
                      <td className="py-2 pr-3 whitespace-nowrap font-semibold">
                        {formatarReais(c.valorTotalCentavos)}
                        <div className="text-[10px] font-normal text-gray-400">
                          {c.parcelas > 1 ? `${c.parcelas}x` : "à vista"}
                          {c.valorTotalCentavos !== c.valorCentavos && ` · juros ${formatarReais(c.valorTotalCentavos - c.valorCentavos)}`}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${COR[status]}`}>
                          {ROTULO_STATUS_CARTAO[status]}
                        </span>
                        {c.pagoEm && <div className="text-[10px] text-gray-400 mt-0.5">pago em {formatarDataHora(c.pagoEm)}</div>}
                        {c.duplicada && <div className="text-[10px] font-semibold text-red-600 mt-0.5">pagamento em duplicidade</div>}
                        {c.observacao && <div className="text-[10px] text-gray-500 mt-0.5">{c.observacao}</div>}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-col gap-1 items-start">
                          {(emAberto(c.status) || c.status === "PAGA" || c.status === "CONTESTADA") && (
                            <BotaoAcao acao={conferirCobrancaCartao.bind(null, c.id)}>Conferir no Asaas</BotaoAcao>
                          )}
                          {emAberto(c.status) && (
                            <BotaoAcao
                              variante="perigo"
                              acao={cancelarCobrancaCartao.bind(null, c.id)}
                              confirmar="Cancelar esta cobrança no Asaas? O link deixa de funcionar."
                            >
                              Cancelar
                            </BotaoAcao>
                          )}
                          {c.status === "ESTORNADA" && !c.observacao && (
                            <BotaoAcao
                              acao={reabrirAtendimentosEstornados.bind(null, c.id)}
                              confirmar="O dinheiro voltou ao cliente? Os atendimentos voltam a constar como não pagos no cartão."
                            >
                              Reabrir atendimentos
                            </BotaoAcao>
                          )}
                          {c.linkPagamento && emAberto(c.status) && (
                            <a href={c.linkPagamento} target="_blank" rel="noreferrer" className="text-[11px] text-bordo hover:underline">
                              ver link
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </Tabela>
            )}
          </Cartao>

          <Cartao>
            <div className="font-display font-bold text-bordo text-sm mb-3">Últimos avisos do Asaas</div>
            {eventos.length === 0 ? (
              <Vazio>Nenhum aviso de cobrança do sistema recebido ainda. Confira se o webhook está cadastrado no Asaas.</Vazio>
            ) : (
              <Tabela cabecalho={["Recebido", "Evento", "Resultado"]}>
                {eventos.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-500">{formatarDataHora(e.recebidoEm)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{e.tipo}</td>
                    <td className={`py-2 ${e.erro ? "text-red-600" : "text-gray-600"}`}>{e.erro ?? e.resultado}</td>
                  </tr>
                ))}
              </Tabela>
            )}
          </Cartao>
        </>
      )}
    </div>
  );
}
