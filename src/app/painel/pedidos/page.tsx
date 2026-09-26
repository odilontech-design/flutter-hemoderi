import Link from "next/link";
import type { StatusPedido } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, SeloStatus, Titulo, Vazio } from "@/components/ui";
import { codigoDoPedido } from "@/lib/numeracao";
import { formatarDataCurta } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { STATUS_PENDENTES } from "@/lib/pedido";
import { profissionaisIndisponiveis } from "@/lib/alocacao";
import { AcoesPedido } from "./AcoesPedido";
import { CondicaoPagamento } from "./CondicaoPagamento";
import { ConferenciaRelatorio } from "./ConferenciaRelatorio";
import { FiltroPagamento } from "./FiltroPagamento";
import { ValorServico } from "./ValorServico";
import { perfilPermite } from "@/lib/papeis";
import { condicaoValida } from "@/lib/pagamento";

export const dynamic = "force-dynamic";

const FILTROS: { chave: string; rotulo: string; status?: StatusPedido[] }[] = [
  { chave: "pendentes", rotulo: "Aguardando ação", status: STATUS_PENDENTES },
  { chave: "alocados", rotulo: "Alocados", status: ["ALOCADO"] },
  { chave: "fechados", rotulo: "Fechados", status: ["REALIZADO", "FALTOU"] },
  { chave: "cancelados", rotulo: "Cancelados", status: ["CANCELADO"] },
  { chave: "todos", rotulo: "Todos" },
];

/**
 * A esteira. É a tela de trabalho da equipe, e abre no filtro do que está
 * parado — não na lista completa: com 1.500 atendimentos por mês, uma lista
 * ordenada por data é um arquivo, não uma fila de trabalho.
 */
export default async function Esteira({
  searchParams,
}: {
  searchParams: { filtro?: string; pagamento?: string };
}) {
  const sessao = await exigirInterno();

  const filtro = FILTROS.find((f) => f.chave === searchParams.filtro) ?? FILTROS[0];
  const pagamento = condicaoValida(searchParams.pagamento ?? "") ? searchParams.pagamento! : "";

  const [pedidos, profissionais] = await Promise.all([
    prisma.pedido.findMany({
      where: {
        ...(filtro.status ? { status: { in: filtro.status } } : {}),
        ...(pagamento ? { condicaoPagamento: pagamento } : {}),
      },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      take: 200,
      include: {
        clinica: { select: { nome: true } },
        servico: { select: { nome: true } },
        profissional: { select: { nome: true } },
        relatorio: {
          select: {
            latitude: true,
            longitude: true,
            aprovadoEm: true,
            servicosAdicionais: true,
            ajudaCustoCentavos: true,
            ajudaCustoJustificativa: true,
            servicoValidadoEm: true,
            valorValidadoEm: true,
            ajudaCustoValidadaEm: true,
          },
        },
      },
    }),
    prisma.profissional.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  // Só quem está "Confirmado" mostra o seletor de alocar (ver AcoesPedido) —
  // é só para esses que vale calcular quem está livre. Com dezenas de
  // profissionais cadastrados, oferecer a lista toda e deixar a equipe
  // descobrir por tentativa quem está ocupado não escala; o profissional que
  // a clínica pediu continua na lista mesmo ocupado, para a equipe ver que o
  // pedido dela esbarrou em alguma coisa, e não simplesmente sumir da tela.
  const indisponiveisPorPedido = new Map<string, Set<string>>();
  await Promise.all(
    pedidos
      .filter((p) => p.status === "CONFIRMADO")
      .map(async (p) => {
        indisponiveisPorPedido.set(p.id, await profissionaisIndisponiveis(p.data, p.horaInicio, p.duracaoMin, p.id));
      })
  );

  return (
    <>
      <Titulo
        acao={
          <Link
            href="/painel/pedidos/novo"
            className="bg-bordo text-white text-xs font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-lg hover:bg-bordoEscuro"
          >
            + Novo agendamento
          </Link>
        }
      >
        Esteira de agendamentos
      </Titulo>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTROS.map((f) => (
          <Link
            key={f.chave}
            href={`/painel/pedidos?filtro=${f.chave}${pagamento ? `&pagamento=${encodeURIComponent(pagamento)}` : ""}`}
            className={`text-[11px] font-semibold px-3 py-2.5 sm:py-1.5 rounded-full border ${
              f.chave === filtro.chave
                ? "bg-bordo text-white border-bordo"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {f.rotulo}
          </Link>
        ))}
        <FiltroPagamento filtroStatus={filtro.chave} pagamento={pagamento} />
      </div>

      {pedidos.length === 0 ? (
        <Cartao>
          <Vazio>
            Nada em {filtro.rotulo.toLowerCase()}
            {pagamento ? ` com pagamento "${pagamento}"` : ""}.
          </Vazio>
        </Cartao>
      ) : (
        <div className="space-y-2">
          {pedidos.map((pedido) => (
            <Cartao key={pedido.id} className="!p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/painel/pedidos/${pedido.id}`}
                      className="font-display font-bold text-bordo text-sm hover:underline"
                      title="Ver relatório detalhado"
                    >
                      {codigoDoPedido(pedido.numero, pedido.clinica.nome, pedido.data)}
                    </Link>
                    <SeloStatus status={pedido.status} />
                    {pedido.origem === "PORTAL_CLINICA" && (
                      <span className="text-[9px] uppercase tracking-wide text-gray-400">portal</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-700">
                    {formatarDataCurta(pedido.data)} às {pedido.horaInicio} · {pedido.servico.nome}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {pedido.clinica.nome} ·{" "}
                    {pedido.profissional ? (
                      pedido.profissional.nome
                    ) : (
                      <span className="text-red-600 font-semibold">sem profissional</span>
                    )}
                    {pedido.doutorNome && <> · Dr(a). {pedido.doutorNome}</>}
                    {pedido.pacienteNome && <> · paciente {pedido.pacienteNome}</>}
                  </div>
                  {/* Alocado não quer dizer que alguém assumiu: desde a ata
                      de 21/09 o profissional confirma, e a esteira precisa
                      mostrar quem ainda não respondeu — é o pedido que corre
                      risco de chegar na véspera sem ninguém. */}
                  {pedido.status === "ALOCADO" && (
                    <div className="text-[10px] mt-0.5 flex flex-wrap items-center gap-x-2">
                      {pedido.aceitoEm ? (
                        <span className="font-semibold text-green-700">aceito pelo profissional</span>
                      ) : (
                        <span className="font-semibold text-amber-700">aguardando aceite</span>
                      )}
                      {pedido.checkinEm &&
                        (pedido.checkinLatitude != null && pedido.checkinLongitude != null ? (
                          <a
                            href={`https://www.google.com/maps?q=${pedido.checkinLatitude},${pedido.checkinLongitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-green-700 hover:underline"
                          >
                            📍 chegada registrada
                          </a>
                        ) : (
                          <span className="font-semibold text-green-700">chegada registrada</span>
                        ))}
                    </div>
                  )}
                  <div className="mt-1.5">
                    <CondicaoPagamento pedidoId={pedido.id} atual={pedido.condicaoPagamento} />
                  </div>
                  {pedido.observacoes && (
                    <div className="text-[11px] text-gray-400 mt-1">{pedido.observacoes}</div>
                  )}
                  {/* O que a pessoa declarou a mais é o que o pós-venda vai
                      conferir — precisa estar à vista, não escondido atrás
                      de um clique. */}
                  {pedido.relatorio?.servicosAdicionais && (
                    <div className="text-[11px] text-amber-800 mt-1">
                      <strong>Além do contratado:</strong> {pedido.relatorio.servicosAdicionais}
                    </div>
                  )}
                  {pedido.relatorio?.ajudaCustoCentavos != null && (
                    <div className="text-[11px] text-amber-800">
                      <strong>Ajuda de custo:</strong>{" "}
                      {formatarReais(pedido.relatorio.ajudaCustoCentavos)}
                      {pedido.relatorio.ajudaCustoJustificativa
                        ? ` · ${pedido.relatorio.ajudaCustoJustificativa}`
                        : ""}
                    </div>
                  )}
                  {pedido.relatorio &&
                    !pedido.relatorio.aprovadoEm &&
                    perfilPermite(sessao.perfil, "POS_VENDA") && (
                      <ConferenciaRelatorio
                        pedidoId={pedido.id}
                        servicoValidado={pedido.relatorio.servicoValidadoEm != null}
                        valorValidado={pedido.relatorio.valorValidadoEm != null}
                        ajudaCustoValidada={pedido.relatorio.ajudaCustoValidadaEm != null}
                      />
                    )}
                  {pedido.relatorio?.aprovadoEm && (
                    <div className="text-[10px] font-semibold text-green-700 mt-1">
                      relatório conferido · repasse liberado
                    </div>
                  )}
                  {pedido.relatorio?.latitude != null && pedido.relatorio?.longitude != null && (
                    <a
                      href={`https://www.google.com/maps?q=${pedido.relatorio.latitude},${pedido.relatorio.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 mt-1 hover:underline"
                    >
                      📍 local confirmado no relatório
                    </a>
                  )}
                </div>

                <div className="text-right shrink-0">
                  {perfilPermite(sessao.perfil, "COMERCIAL") && pedido.status !== "CANCELADO" ? (
                    <ValorServico pedidoId={pedido.id} valorCentavos={pedido.valorServicoCentavos} />
                  ) : (
                    <div
                      className={`text-xs font-semibold ${
                        pedido.valorServicoCentavos > 0 ? "text-bordo" : "text-amber-700"
                      }`}
                    >
                      {formatarReais(pedido.valorServicoCentavos)}
                    </div>
                  )}
                  {pedido.valorRepasseCentavos > 0 && (
                    <div className="text-[10px] text-gray-400">
                      repasse {formatarReais(pedido.valorRepasseCentavos)}
                    </div>
                  )}
                </div>
              </div>

              <AcoesPedido
                pedidoId={pedido.id}
                status={pedido.status}
                perfil={sessao.perfil}
                profissionais={profissionais.filter((p) => {
                  const indisponiveis = indisponiveisPorPedido.get(pedido.id);
                  return !indisponiveis || p.id === pedido.profissionalId || !indisponiveis.has(p.id);
                })}
                profissionalSolicitadoId={pedido.profissionalId}
              />
            </Cartao>
          ))}
        </div>
      )}

      {pedidos.length === 200 && (
        <div className="text-[10px] text-gray-400 mt-4">
          Mostrando os 200 primeiros. Use os filtros para chegar no que importa.
        </div>
      )}
    </>
  );
}
