import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, SeloStatus, Titulo, Vazio } from "@/components/ui";
import { codigoDoPedido } from "@/lib/numeracao";
import { formatarDataCurta } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { ETAPAS, etapaDoPerfil, etapaPorChave } from "@/lib/esteira";
import { profissionaisIndisponiveis } from "@/lib/alocacao";
import { AcoesPedido } from "./AcoesPedido";
import { CondicaoPagamento } from "./CondicaoPagamento";
import { ConferenciaRelatorio } from "./ConferenciaRelatorio";
import { FiltroPagamento } from "./FiltroPagamento";
import { ValorServico } from "./ValorServico";
import { perfilPermite } from "@/lib/papeis";
import { condicaoValida } from "@/lib/pagamento";

export const dynamic = "force-dynamic";

/**
 * A esteira. É a tela de trabalho da equipe, e abre na ETAPA de quem entrou
 * (lib/esteira.ts) — não na lista completa: com 1.500 atendimentos por mês,
 * uma lista ordenada por data é um arquivo, não uma fila de trabalho.
 *
 * A separação por setor é da ata de 28/09: a triagem é da Ana e a alocação é
 * da Joyce, e enquanto as duas dividiam o mesmo balde ("Aguardando ação")
 * cada uma via o trabalho da outra como ruído. Abrir na própria fila resolve
 * isso sem esconder as demais — a interface é a mesma para todos os setores,
 * como a ata pediu.
 */
export default async function Esteira({
  searchParams,
}: {
  searchParams: { filtro?: string; pagamento?: string };
}) {
  const sessao = await exigirInterno();

  const minhaEtapa = etapaDoPerfil(sessao.perfil);
  const filtro = etapaPorChave(searchParams.filtro) ?? minhaEtapa;
  const pagamento = condicaoValida(searchParams.pagamento ?? "") ? searchParams.pagamento! : "";

  const ondePagamento = pagamento ? { condicaoPagamento: pagamento } : {};

  const [pedidos, profissionais, contagens] = await Promise.all([
    prisma.pedido.findMany({
      where: { ...filtro.onde, ...ondePagamento },
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
    // O tamanho de cada fila, no mesmo recorte de pagamento que está na tela.
    // É o número que diz "tem trabalho ali" sem a pessoa precisar clicar em
    // cada etapa para descobrir — e é o que faz a separação por setor render:
    // a Joyce vê quantos esperam alocação enquanto trabalha a triagem.
    Promise.all(
      ETAPAS.map((etapa) => prisma.pedido.count({ where: { ...etapa.onde, ...ondePagamento } }))
    ),
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

      <div className="flex flex-wrap items-center gap-2 mb-2">
        {ETAPAS.map((etapa, i) => {
          const minha = etapa.chave === minhaEtapa.chave;
          const selecionada = etapa.chave === filtro.chave;
          return (
            <Link
              key={etapa.chave}
              href={`/painel/pedidos?filtro=${etapa.chave}${pagamento ? `&pagamento=${encodeURIComponent(pagamento)}` : ""}`}
              title={etapa.descricao}
              className={`text-[11px] font-semibold px-3 py-2.5 sm:py-1.5 rounded-full border ${
                selecionada
                  ? "bg-bordo text-white border-bordo"
                  : minha
                    ? "bg-white text-bordo border-bordo/50 hover:bg-bordo/5"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {etapa.rotulo}
              {contagens[i] > 0 && <span className="ml-1 opacity-70">· {contagens[i]}</span>}
            </Link>
          );
        })}
        <FiltroPagamento filtroStatus={filtro.chave} pagamento={pagamento} />
      </div>

      <div className="text-[11px] text-gray-500 mb-4">
        {filtro.descricao}
        {filtro.chave === minhaEtapa.chave && minhaEtapa.dono && (
          <span className="text-bordo font-semibold"> · esta é a sua fila</span>
        )}
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
