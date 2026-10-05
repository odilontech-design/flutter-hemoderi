import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { Cartao, Kpi, Tabela, Titulo, Vazio } from "@/components/ui";
import { formatarDataCurta, hojeUTC, instanteDoAtendimento, nomeDoProfissionalVisivel } from "@/lib/data";
import { COR_STATUS, ROTULO_STATUS_CLIENTE, STATUS_ATIVOS, statusParaCliente } from "@/lib/pedido";
import type { StatusPedido } from "@prisma/client";
import { AcoesClinica } from "./AcoesClinica";
import { AvaliarAtendimento } from "./AvaliarAtendimento";
import { ResponderNps } from "./ResponderNps";
import { formatarMedia, mediaDeNotas } from "@/lib/avaliacao";
import { linkAdicionarGoogleAgenda } from "@/lib/google-calendar-link";

export const dynamic = "force-dynamic";

/**
 * O status como o CLIENTE lê (ata de 02/10): solicitado, confirmado ou
 * cancelado. "Alocado" é detalhe interno e aparece como confirmado.
 */
function SeloStatusCliente({ status }: { status: StatusPedido }) {
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${COR_STATUS[statusParaCliente(status)]}`}
    >
      {ROTULO_STATUS_CLIENTE[status]}
    </span>
  );
}

/**
 * O que a clínica vê: os próprios pedidos, e só. O valor cobrado aparece,
 * o repasse do profissional não — quanto a Hemoderi paga a quem executa não é
 * assunto do cliente.
 */
export default async function MeusAgendamentos() {
  const sessao = await exigirClinica();
  const hoje = hojeUTC();

  const [proximos, historico, total, aAvaliar, notasDadas, npsPendente, aguardando] = await Promise.all([
    prisma.pedido.findMany({
      where: { clinicaId: sessao.clinicaId, data: { gte: hoje }, status: { in: STATUS_ATIVOS } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      include: {
        servico: { select: { nome: true, duracaoMin: true } },
        profissional: { select: { nome: true } },
      },
    }),
    prisma.pedido.findMany({
      where: { clinicaId: sessao.clinicaId, status: { in: ["REALIZADO", "FALTOU", "CANCELADO"] } },
      orderBy: [{ data: "desc" }],
      take: 60,
      include: {
        servico: { select: { nome: true } },
        profissional: { select: { nome: true } },
        avaliacao: { select: { nota: true, comentario: true } },
      },
    }),
    prisma.pedido.count({ where: { clinicaId: sessao.clinicaId, status: "REALIZADO" } }),
    // A fila de avaliação é o atendimento realizado que ainda não tem nota.
    // Fica limitada aos cinco mais recentes: a clínica que voltou depois de um
    // mês não pode ser recebida por trinta formulários abertos.
    prisma.pedido.findMany({
      where: { clinicaId: sessao.clinicaId, status: "REALIZADO", avaliacao: { is: null } },
      orderBy: [{ data: "desc" }, { horaInicio: "desc" }],
      take: 5,
      include: { servico: { select: { nome: true } }, profissional: { select: { nome: true } } },
    }),
    prisma.avaliacao.findMany({
      where: { clinicaId: sessao.clinicaId },
      select: { nota: true },
    }),
    // No máximo uma pesquisa pendente por vez na prática (cadência de 60
    // dias): `findFirst`, não lista, porque não há "fila" para paginar aqui.
    prisma.pesquisaNps.findFirst({
      where: { clinicaId: sessao.clinicaId, respondidaEm: null },
      orderBy: { criadaEm: "asc" },
      select: { id: true },
    }),
    // O que a clínica pediu pelo site e a equipe ainda não triou. Sem isto o
    // pedido feito no site sumia até alguém do outro lado vinculá-lo, e quem
    // pediu ficava sem saber se chegou (ata de 28/09).
    prisma.solicitacaoPublica.findMany({
      where: { clinicaId: sessao.clinicaId, status: "NOVA" },
      orderBy: { criadaEm: "desc" },
      select: {
        id: true,
        dataDesejada: true,
        horarioDesejado: true,
        doutorNome: true,
        pacienteNome: true,
        servico: { select: { nome: true } },
      },
    }),
  ]);

  const minhaMedia = mediaDeNotas(notasDadas.map((a) => a.nota));
  // "Procedimentos realizados" (ata de 02/10): o que aconteceu. Cancelados saem
  // dessa lista e ficam recolhidos à parte.
  const realizados = historico.filter((p) => p.status !== "CANCELADO");
  const cancelados = historico.filter((p) => p.status === "CANCELADO");

  return (
    <>
      <Titulo
        acao={
          <Link
            href="/portal/agendar"
            className="bg-bordo text-white text-xs font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-lg hover:bg-bordoEscuro"
          >
            + Agendar atendimento
          </Link>
        }
      >
        Meus agendamentos
      </Titulo>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <Kpi rotulo="Agendados" valor={String(proximos.length)} />
        <Kpi rotulo="Já realizados" valor={String(total)} />
        <Kpi
          rotulo="Aguardando confirmação"
          valor={String(proximos.filter((p) => p.status === "SOLICITADO").length + aguardando.length)}
          sub="a central confirma"
        />
        <Kpi
          rotulo="Média que você deu"
          valor={formatarMedia(minhaMedia)}
          sub={notasDadas.length ? `${notasDadas.length} avaliação(ões)` : "nenhuma avaliação ainda"}
        />
      </div>

      {aguardando.length > 0 && (
        <Cartao className="mb-3 border-amber-200 bg-amber-50/40">
          <div className="font-display font-bold text-bordo text-sm mb-1">Aguardando confirmação</div>
          <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
            Pedidos que você fez pelo site. A central confere a agenda e o equipamento, confirma o
            horário e avisa pelo WhatsApp — aí eles aparecem em Próximos.
          </div>
          <Tabela cabecalho={["Data", "Hora", "Serviço", "Doutor(a)", "Paciente", "Status"]}>
            {aguardando.map((solicitacao) => (
              <tr key={solicitacao.id} className="border-b border-amber-200/70 last:border-0">
                <td className="py-2 pr-3 font-semibold">{formatarDataCurta(solicitacao.dataDesejada)}</td>
                <td className="py-2 pr-3">{solicitacao.horarioDesejado}</td>
                <td className="py-2 pr-3 text-gray-600">{solicitacao.servico.nome}</td>
                <td className="py-2 pr-3 text-gray-600">{solicitacao.doutorNome ?? "—"}</td>
                <td className="py-2 pr-3 text-gray-500">{solicitacao.pacienteNome ?? "—"}</td>
                <td className="py-2 whitespace-nowrap">
                  <span className="text-[10px] font-semibold text-amber-700">Aguardando</span>
                </td>
              </tr>
            ))}
          </Tabela>
        </Cartao>
      )}

      <Cartao className="mb-3 border-bordo/40 shadow-sm">
        <div className="font-display font-bold text-bordo text-sm mb-3">Próximos agendamentos</div>
        {proximos.length === 0 ? (
          <Vazio>Nenhum atendimento agendado.</Vazio>
        ) : (
          <Tabela cabecalho={["Data", "Horário", "Serviço", "Profissional", "Paciente", "Pagamento", "Status", ""]}>
            {proximos.map((pedido) => (
              <tr key={pedido.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-3 font-semibold">{formatarDataCurta(pedido.data)}</td>
                <td className="py-2 pr-3">{pedido.horaInicio}</td>
                <td className="py-2 pr-3 text-gray-600">
                  {pedido.servico.nome}
                  {pedido.quantidade > 1 && <span className="text-gray-400"> × {pedido.quantidade}</span>}
                </td>
                <td className="py-2 pr-3 text-gray-600">
                  {/* O nome só aparece na véspera (ata de 02/10); antes disso,
                      nem o valor entra no lugar — o histórico de consumo não
                      é para negociar desconto. */}
                  {!nomeDoProfissionalVisivel(pedido.data, pedido.horaInicio) ? (
                    <span className="text-gray-400" title="O nome de quem vai atender aparece um dia antes do atendimento.">
                      a confirmar
                    </span>
                  ) : (
                    pedido.profissional?.nome ?? <span className="text-gray-400">a definir</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-gray-500">{pedido.pacienteNome ?? "—"}</td>
                <td className="py-2 pr-3 text-gray-600">{pedido.formaPagamento ?? "—"}</td>
                <td className="py-2 pr-3">
                  <SeloStatusCliente status={pedido.status} />
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <AcoesClinica pedidoId={pedido.id} />
                    {pedido.status !== "SOLICITADO" && (
                      <a
                        href={linkAdicionarGoogleAgenda({
                          titulo: `${pedido.servico.nome} — Hemoderi`,
                          inicio: instanteDoAtendimento(pedido.data, pedido.horaInicio),
                          duracaoMin: pedido.servico.duracaoMin,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-bordo hover:underline whitespace-nowrap"
                      >
                        + Google Agenda
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      {aAvaliar.length > 0 && (
        <Cartao className="mb-3 border-amber-200 bg-amber-50/40">
          <div className="font-display font-bold text-bordo text-sm mb-1">
            Como foi o atendimento?
          </div>
          <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
            Sua nota é o que nos diz qual profissional mandar de volta para você. Leva dez
            segundos e só a equipe da Hemoderi lê.
          </div>
          <div className="space-y-4">
            {aAvaliar.map((pedido) => (
              <div key={pedido.id} className="border-t border-amber-200/70 pt-3 first:border-0 first:pt-0">
                <div className="text-xs font-semibold text-bordo">
                  {pedido.servico.nome}
                  <span className="font-normal text-gray-500">
                    {" · "}
                    {formatarDataCurta(pedido.data)}
                    {pedido.profissional ? ` · ${pedido.profissional.nome}` : ""}
                  </span>
                </div>
                {pedido.pacienteNome && (
                  <div className="text-[10px] text-gray-400 mb-2">Paciente: {pedido.pacienteNome}</div>
                )}
                <AvaliarAtendimento pedidoId={pedido.id} atual={null} />
              </div>
            ))}
          </div>
        </Cartao>
      )}

      {npsPendente && (
        <Cartao className="mb-3 border-bordo/20 bg-bege/60">
          <div className="font-display font-bold text-bordo text-sm mb-1">Pesquisa de satisfação</div>
          <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
            Faz um tempo que a gente não vê muito movimento — e é exatamente por
            isso que a sua opinião vale mais agora. Duas perguntas, sem
            compromisso.
          </div>
          <ResponderNps pesquisaId={npsPendente.id} />
        </Cartao>
      )}

      <Cartao className="mb-3">
        <div className="font-display font-bold text-bordo text-sm mb-3">Procedimentos realizados</div>
        {realizados.length === 0 ? (
          <Vazio>Nenhum procedimento realizado ainda.</Vazio>
        ) : (
          <Tabela cabecalho={["Data", "Serviço", "Profissional", "Status", "Sua avaliação"]}>
            {realizados.map((pedido) => (
              <tr key={pedido.id} className="border-b border-gray-100 last:border-0 align-top">
                <td className="py-2 pr-3">{formatarDataCurta(pedido.data)}</td>
                <td className="py-2 pr-3 text-gray-600">
                  {pedido.servico.nome}
                  {pedido.quantidade > 1 && <span className="text-gray-400"> × {pedido.quantidade}</span>}
                </td>
                <td className="py-2 pr-3 text-gray-600">{pedido.profissional?.nome ?? "—"}</td>
                <td className="py-2 pr-3">
                  <SeloStatusCliente status={pedido.status} />
                </td>
                <td className="py-2 min-w-[180px]">
                  {/* Só atendimento realizado com profissional se avalia:
                      cancelado e falta não são trabalho de ninguém. */}
                  {pedido.status === "REALIZADO" && pedido.profissional ? (
                    <AvaliarAtendimento
                      pedidoId={pedido.id}
                      atual={pedido.avaliacao}
                      compacto
                    />
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      {cancelados.length > 0 && (
        <details className="mb-3 bg-white rounded-2xl border border-gray-200 px-5 py-3">
          <summary className="cursor-pointer select-none text-xs font-semibold text-gray-500">
            Agendamentos cancelados ({cancelados.length})
          </summary>
          <div className="mt-3">
            <Tabela cabecalho={["Data", "Serviço", "Status"]}>
              {cancelados.map((pedido) => (
                <tr key={pedido.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-3">{formatarDataCurta(pedido.data)}</td>
                  <td className="py-2 pr-3 text-gray-600">{pedido.servico.nome}</td>
                  <td className="py-2 pr-3">
                    <SeloStatusCliente status={pedido.status} />
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
