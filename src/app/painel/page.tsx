import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Kpi, SeloStatus, Tabela, Titulo, Vazio } from "@/components/ui";
import { competenciaAtual, formatarData, hojeUTC } from "@/lib/data";
import { formatarReaisCurto } from "@/lib/dinheiro";
import { STATUS_ATIVOS, STATUS_PENDENTES } from "@/lib/pedido";
import { estrelas, formatarMedia, mediaDeNotas } from "@/lib/avaliacao";
import { MostrarEstrelas } from "@/components/Estrelas";
import { falhasRecentes } from "@/lib/integracoes/google-agenda";
import { Aviso } from "@/components/ui";
import { FiltroProdutividade } from "./FiltroProdutividade";
import { formatarAtraso, statusDeChegada } from "@/lib/atraso";
import { linkWhatsapp, mensagemDeAtraso } from "@/lib/whatsapp-link";
import { formatarDataCurta } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * O painel do dia. Responde três perguntas, nesta ordem: o que acontece hoje,
 * o que está parado esperando alguém, e como o mês está indo. A terceira é a
 * menos urgente e por isso vem por último — a fila de pendências é o que faz
 * a operação escalar de 400 para 1.500 atendimentos sem contratar mais gente.
 */
export default async function Hoje({ searchParams }: { searchParams: { servico?: string } }) {
  const sessao = await exigirInterno();

  const hoje = hojeUTC();
  const competencia = competenciaAtual();
  const inicioMes = new Date(`${competencia}-01T00:00:00.000Z`);
  const servicoFiltro = searchParams.servico || undefined;

  const [
    doDia,
    pendentes,
    agendados,
    semProfissional,
    realizadosMes,
    aReceber,
    porProfissional,
    faltasMes,
    servicosAtivos,
  ] = await Promise.all([
    prisma.pedido.findMany({
      where: { data: hoje, status: { notIn: ["CANCELADO"] } },
      orderBy: { horaInicio: "asc" },
      include: {
        clinica: { select: { nome: true, telefone: true } },
        servico: { select: { nome: true } },
        profissional: { select: { nome: true } },
      },
    }),
    prisma.pedido.count({ where: { status: { in: STATUS_PENDENTES } } }),
    // "Agendados" é o que está de pé daqui para a frente — o compromisso que
    // a operação ainda tem que cumprir, não o histórico.
    prisma.pedido.count({ where: { data: { gte: hoje }, status: { in: STATUS_ATIVOS } } }),
    prisma.pedido.count({ where: { status: "CONFIRMADO", profissionalId: null } }),
    prisma.pedido.aggregate({
      where: { status: "REALIZADO", data: { gte: inicioMes } },
      _count: true,
      _sum: { valorServicoCentavos: true, valorRepasseCentavos: true },
    }),
    prisma.fatura.aggregate({ where: { status: "ABERTA" }, _sum: { valorCentavos: true } }),
    // Produtividade da competência: quem atendeu quanto. O valor gerado e a
    // participação percentual saíram na ata de 14/09 — a operação lê esta
    // tabela para saber QUEM fez O QUÊ, e o dinheiro por profissional é
    // conversa do financeiro, não do painel do dia. Ordem alfabética (não por
    // volume) e filtro por serviço saíram da ata de 21/09 — a equipe usa esta
    // tabela para achar um nome específico, não só para ver quem lidera.
    prisma.pedido.groupBy({
      by: ["profissionalId"],
      where: {
        status: "REALIZADO",
        data: { gte: inicioMes },
        profissionalId: { not: null },
        ...(servicoFiltro ? { servicoId: servicoFiltro } : {}),
      },
      _count: true,
    }),
    prisma.pedido.count({ where: { status: "FALTOU", data: { gte: inicioMes } } }),
    prisma.servico.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const profissionais = await prisma.profissional.findMany({
    where: { id: { in: porProfissional.map((p) => p.profissionalId as string) } },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  const porProfissionalOrdenado = [...porProfissional].sort((a, b) => {
    const nomeA = profissionais.find((p) => p.id === a.profissionalId)?.nome ?? "";
    const nomeB = profissionais.find((p) => p.id === b.profissionalId)?.nome ?? "";
    return nomeA.localeCompare(nomeB, "pt-BR");
  });

  // O que cada um executou, por serviço: é a leitura que substitui o valor
  // gerado. "A Ana fez 12 PRF e 3 clareamentos" diz mais sobre a operação do
  // que "a Ana gerou R$ 4.200".
  const servicosPorProfissional = await prisma.pedido.groupBy({
    by: ["profissionalId", "servicoId"],
    where: {
      status: "REALIZADO",
      data: { gte: inicioMes },
      profissionalId: { not: null },
      ...(servicoFiltro ? { servicoId: servicoFiltro } : {}),
    },
    _count: true,
  });

  const nomesDeServico = new Map(
    (
      await prisma.servico.findMany({
        where: { id: { in: [...new Set(servicosPorProfissional.map((l) => l.servicoId))] } },
        select: { id: true, nome: true },
      })
    ).map((s) => [s.id, s.nome])
  );

  const [notasPorProfissional, comentariosRecentes, todasAsNotas] = await Promise.all([
    // Média de TODAS as avaliações do profissional, não só as do mês: a tabela
    // é do mês, mas a nota serve para decidir a quem mandar a próxima vaga, e
    // três avaliações de setembro dizem menos que trinta do ano.
    prisma.avaliacao.groupBy({
      by: ["profissionalId"],
      where: { profissionalId: { in: porProfissional.map((p) => p.profissionalId as string) } },
      _avg: { nota: true },
      _count: true,
    }),
    // Só as que têm comentário: uma lista de cinco estrelas sem texto não é
    // leitura, é enfeite. O que a equipe age em cima é o que foi escrito.
    prisma.avaliacao.findMany({
      where: { comentario: { not: null } },
      orderBy: { criadaEm: "desc" },
      take: 5,
      select: {
        id: true,
        nota: true,
        comentario: true,
        criadaEm: true,
        clinica: { select: { nome: true } },
        profissional: { select: { nome: true } },
      },
    }),
    prisma.avaliacao.findMany({ select: { nota: true } }),
  ]);

  // Uma integração que falha calada é pior que integração nenhuma: a equipe
  // continua confiando na agenda do celular do profissional, que parou de
  // receber há duas semanas.
  const falhasNaAgenda = await falhasRecentes();

  const mediaGeral = mediaDeNotas(todasAsNotas.map((a) => a.nota));

  // O resumo de agendamentos e o histórico moram na tela principal (ata de
  // 02/10); produtividade e feedback foram para a barra lateral.
  const amanha = new Date(hoje.getTime() + 24 * 60 * 60 * 1000);
  const [proximos, historicoRecente] = await Promise.all([
    prisma.pedido.findMany({
      where: { data: { gte: amanha }, status: { in: STATUS_ATIVOS } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      take: 8,
      select: {
        id: true,
        data: true,
        horaInicio: true,
        status: true,
        clinica: { select: { nome: true } },
        servico: { select: { nome: true } },
        profissional: { select: { nome: true } },
      },
    }),
    prisma.pedido.findMany({
      where: { status: { in: ["REALIZADO", "FALTOU", "CANCELADO"] } },
      orderBy: [{ data: "desc" }, { horaInicio: "desc" }],
      take: 8,
      select: {
        id: true,
        data: true,
        horaInicio: true,
        status: true,
        clinica: { select: { nome: true } },
        servico: { select: { nome: true } },
      },
    }),
  ]);
  const agora = new Date();

  // Taxa de comparecimento: dos atendimentos que chegaram ao fim no mês,
  // quantos aconteceram. É o número que diz se o problema de capacidade é de
  // agenda ou de falta — e as duas coisas se resolvem de formas diferentes.
  const fechadosMes = realizadosMes._count + faltasMes;
  const comparecimento = fechadosMes > 0 ? Math.round((realizadosMes._count / fechadosMes) * 100) : null;

  const faturado = realizadosMes._sum.valorServicoCentavos ?? 0;

  return (
    <>
      <Titulo>Hoje · {formatarData(hoje)}</Titulo>

      {falhasNaAgenda > 0 && (
        <div className="mb-4">
          <Aviso tom="alerta">
            <strong>Google Agenda:</strong> {falhasNaAgenda} sincronização
            {falhasNaAgenda === 1 ? "" : "ões"} falhou nas últimas 24h. Os atendimentos estão no
            sistema normalmente, mas podem não ter chegado à agenda do profissional. Causa mais
            comum: a agenda dele deixou de estar compartilhada com a conta de serviço.
          </Aviso>
        </div>
      )}

      {/* Os quatro números que a operação pediu na reunião de 14/09. O que a
          Hemoderi paga aos profissionais saiu daqui de propósito: o painel
          fica aberto o dia inteiro, às vezes com a clínica olhando junto, e
          custo de prestador não é informação de tela compartilhada. Continua
          em Financeiro → A pagar, que é onde ele é trabalhado. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi
          rotulo="Atendimentos hoje"
          valor={String(doDia.length)}
          sub={semProfissional ? `${semProfissional} sem profissional` : "nada parado"}
        />
        <Kpi
          rotulo="Agendados"
          valor={String(agendados)}
          sub={pendentes ? `${pendentes} aguardando ação` : "nada na fila"}
        />
        <Kpi
          rotulo="Faturamento do mês"
          valor={formatarReaisCurto(faturado)}
          sub={`${realizadosMes._count} atendimento(s) realizado(s)`}
        />
        <Kpi
          rotulo="A receber"
          valor={formatarReaisCurto(aReceber._sum.valorCentavos ?? 0)}
          sub="faturas em aberto"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        {/* Coluna principal: o que acontece hoje, o que vem, o que já foi. */}
        <div className="lg:col-span-2 space-y-3 min-w-0">
          <Cartao>
            <div className="font-display font-bold text-bordo text-sm mb-3">Agenda do dia</div>
            {doDia.length === 0 ? (
              <Vazio>Nenhum atendimento marcado para hoje.</Vazio>
            ) : (
              <Tabela cabecalho={["Hora", "Clínica", "Serviço", "Profissional", "Chegada", "Status"]}>
                {doDia.map((pedido) => {
                  // Chegada e atraso só fazem sentido para quem já tem
                  // profissional e ainda não fechou o atendimento — é o que a
                  // recepção da clínica pergunta.
                  const chegada =
                    pedido.profissionalId && (pedido.status === "ALOCADO" || pedido.checkinEm)
                      ? statusDeChegada(pedido.data, pedido.horaInicio, pedido.checkinEm, agora)
                      : null;
                  const avisar =
                    chegada?.tipo === "atrasado"
                      ? linkWhatsapp(
                          pedido.clinica.telefone,
                          mensagemDeAtraso({
                            clinica: pedido.clinica.nome,
                            servico: pedido.servico.nome,
                            hora: pedido.horaInicio,
                            minutos: chegada.minutos,
                          })
                        )
                      : null;
                  return (
                    <tr key={pedido.id} className="border-b border-gray-100 last:border-0 align-top">
                      <td className="py-2 pr-3 font-semibold">{pedido.horaInicio}</td>
                      <td className="py-2 pr-3">{pedido.clinica.nome}</td>
                      <td className="py-2 pr-3 text-gray-500">{pedido.servico.nome}</td>
                      <td className="py-2 pr-3">
                        {pedido.profissional?.nome ?? <span className="text-red-600 font-semibold">a alocar</span>}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {chegada === null ? (
                          <span className="text-gray-300">—</span>
                        ) : chegada.tipo === "chegou" ? (
                          <span className={`text-[11px] font-semibold ${chegada.atrasado ? "text-amber-700" : "text-green-700"}`}>
                            chegou{chegada.atrasado ? ` · ${formatarAtraso(chegada.minutos)} de atraso` : ""}
                          </span>
                        ) : chegada.tipo === "atrasado" ? (
                          <div>
                            <span className="text-[11px] font-semibold text-red-600">
                              atrasado há {formatarAtraso(chegada.minutos)}
                            </span>
                            {avisar && (
                              <a
                                href={avisar}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-[10px] font-semibold text-[#1EA952] hover:underline"
                              >
                                avisar a clínica →
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400">aguardando</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <SeloStatus status={pedido.status} />
                      </td>
                    </tr>
                  );
                })}
              </Tabela>
            )}
          </Cartao>

          <Cartao>
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <div className="font-display font-bold text-bordo text-sm">Próximos agendamentos</div>
              <Link href="/painel/pedidos" className="text-[11px] font-semibold text-bordo hover:underline">
                ver esteira →
              </Link>
            </div>
            {proximos.length === 0 ? (
              <Vazio>Nada agendado para os próximos dias.</Vazio>
            ) : (
              <Tabela cabecalho={["Quando", "Clínica", "Serviço", "Profissional", "Status"]}>
                {proximos.map((pedido) => (
                  <tr key={pedido.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3 font-semibold whitespace-nowrap">
                      <Link href={`/painel/pedidos/${pedido.id}`} className="hover:underline">
                        {formatarDataCurta(pedido.data)} {pedido.horaInicio}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{pedido.clinica.nome}</td>
                    <td className="py-2 pr-3 text-gray-500">{pedido.servico.nome}</td>
                    <td className="py-2 pr-3">
                      {pedido.profissional?.nome ?? <span className="text-gray-300">a alocar</span>}
                    </td>
                    <td className="py-2 pr-3">
                      <SeloStatus status={pedido.status} />
                    </td>
                  </tr>
                ))}
              </Tabela>
            )}
          </Cartao>

          <Cartao>
            <div className="font-display font-bold text-bordo text-sm mb-3">Histórico recente</div>
            {historicoRecente.length === 0 ? (
              <Vazio>Ainda sem histórico.</Vazio>
            ) : (
              <Tabela cabecalho={["Data", "Clínica", "Serviço", "Status"]}>
                {historicoRecente.map((pedido) => (
                  <tr key={pedido.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <Link href={`/painel/pedidos/${pedido.id}`} className="hover:underline">
                        {formatarDataCurta(pedido.data)} {pedido.horaInicio}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{pedido.clinica.nome}</td>
                    <td className="py-2 pr-3 text-gray-500">{pedido.servico.nome}</td>
                    <td className="py-2 pr-3">
                      <SeloStatus status={pedido.status} />
                    </td>
                  </tr>
                ))}
              </Tabela>
            )}
          </Cartao>
        </div>

        {/* Barra lateral (ata de 02/10): produtividade e feedback das clínicas,
            o que se consulta de relance e não disputa espaço com a agenda. */}
        <aside className="space-y-3 min-w-0">
          <Link
            href="/painel/pedidos"
            className="block bg-bordo text-white rounded-2xl p-4 text-center text-xs font-semibold hover:bg-bordoEscuro"
          >
            Trabalhar a esteira →
          </Link>
          {sessao.perfil === "RESPONSAVEL" && (
            <Link
              href="/painel/financeiro"
              className="block bg-white border border-gray-200 rounded-2xl p-4 text-center text-xs font-semibold text-bordo hover:bg-gray-50"
            >
              Financeiro e repasses →
            </Link>
          )}

          <Cartao>
            <div className="text-[11px] text-gray-500 mb-1">Comparecimento do mês</div>
            <div className="text-lg font-display font-extrabold text-bordo">
              {comparecimento != null ? `${comparecimento}%` : "—"}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              {fechadosMes > 0
                ? `${faltasMes} falta${faltasMes === 1 ? "" : "s"} em ${fechadosMes} fechados`
                : "nenhum atendimento fechado ainda"}
            </div>
          </Cartao>

          <Cartao>
            <div className="font-display font-bold text-bordo text-sm mb-2">Produtividade do mês</div>
            <FiltroProdutividade servicoId={servicoFiltro ?? ""} servicos={servicosAtivos} />
            {porProfissionalOrdenado.length === 0 ? (
              <Vazio>
                {servicoFiltro ? "Nenhum atendimento neste serviço ainda." : "Nenhum atendimento realizado ainda."}
              </Vazio>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100">
                {porProfissionalOrdenado.map((linha) => {
                  const profissional = profissionais.find((p) => p.id === linha.profissionalId);
                  const nota = notasPorProfissional.find((n) => n.profissionalId === linha.profissionalId);
                  const media = nota?._avg.nota != null ? Math.round(nota._avg.nota * 10) / 10 : null;
                  const executados = servicosPorProfissional
                    .filter((l) => l.profissionalId === linha.profissionalId)
                    .sort((a, b) => b._count - a._count);
                  return (
                    <li key={linha.profissionalId} className="py-2">
                      <details>
                        <summary className="flex cursor-pointer select-none items-center justify-between gap-2 list-none [&::-webkit-details-marker]:hidden">
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-bordo truncate">
                              {profissional?.nome ?? "—"}
                            </span>
                            <span className="block text-[10px] text-gray-400">
                              {linha._count} atendimento{linha._count === 1 ? "" : "s"}
                              {media !== null && (
                                <>
                                  {" · "}
                                  <span className="text-amber-500">{estrelas(media)}</span> {formatarMedia(media)}
                                </>
                              )}
                            </span>
                          </span>
                          <span aria-hidden className="text-[9px] text-gray-400">▾</span>
                        </summary>
                        <div className="mt-1.5 space-y-0.5 text-[11px] text-gray-600">
                          {executados.map((item) => (
                            <div key={item.servicoId}>
                              <span className="font-semibold text-gray-700">{item._count}×</span>{" "}
                              {nomesDeServico.get(item.servicoId) ?? "serviço removido"}
                            </div>
                          ))}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </Cartao>

          <Cartao>
            <div className="font-display font-bold text-bordo text-sm mb-1">
              O que as clínicas disseram <span className="font-normal text-gray-400">(CESAT)</span>
            </div>
            {mediaGeral !== null && (
              <div className="text-[11px] text-gray-500 mb-3">
                Média geral: <strong className="text-bordo">{formatarMedia(mediaGeral)}</strong> em{" "}
                {todasAsNotas.length} avaliação{todasAsNotas.length === 1 ? "" : "ões"}
              </div>
            )}
            {comentariosRecentes.length === 0 ? (
              <Vazio>Nenhum comentário ainda.</Vazio>
            ) : (
              <div className="space-y-3">
                {comentariosRecentes.map((avaliacao) => (
                  <div key={avaliacao.id} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
                      <MostrarEstrelas nota={avaliacao.nota} />
                      <span className="text-[11px] font-semibold text-bordo">{avaliacao.clinica.nome}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mb-1">
                      sobre {avaliacao.profissional.nome} · {formatarData(avaliacao.criadaEm)}
                    </div>
                    <div className="text-xs text-gray-600 leading-relaxed">{avaliacao.comentario}</div>
                  </div>
                ))}
              </div>
            )}
          </Cartao>
        </aside>
      </div>
    </>
  );
}
