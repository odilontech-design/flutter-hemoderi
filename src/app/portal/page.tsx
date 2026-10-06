import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { Cartao, Kpi, Tabela, Titulo, Vazio } from "@/components/ui";
import { formatarDataCurta, hojeUTC, instanteDoAtendimento, nomeDoProfissionalVisivel } from "@/lib/data";
import { STATUS_ATIVOS } from "@/lib/pedido";
import { SeloStatusCliente } from "@/components/SeloStatusCliente";
import { AcoesClinica } from "./AcoesClinica";
import { linkAdicionarGoogleAgenda } from "@/lib/google-calendar-link";

export const dynamic = "force-dynamic";

/**
 * O que a clínica vê: os próprios pedidos, e só. O valor cobrado aparece,
 * o repasse do profissional não — quanto a Hemoderi paga a quem executa não é
 * assunto do cliente.
 */
export default async function MeusAgendamentos() {
  const sessao = await exigirClinica();
  const hoje = hojeUTC();

  const [proximos, aAvaliar, aguardando] = await Promise.all([
    prisma.pedido.findMany({
      where: { clinicaId: sessao.clinicaId, data: { gte: hoje }, status: { in: STATUS_ATIVOS } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      include: {
        servico: { select: { nome: true, duracaoMin: true } },
        profissional: { select: { nome: true } },
      },
    }),
    // Só a contagem: a lista de avaliações pendentes mora em Histórico e
    // avaliações (ata de 05/10). Aqui fica o aviso de que existe.
    prisma.pedido.count({
      where: { clinicaId: sessao.clinicaId, status: "REALIZADO", profissionalId: { not: null }, avaliacao: { is: null } },
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

  // Os serviços de uma mesma visita viram UMA linha (ata de 05/10): o cliente
  // marcou um agendamento, não três.
  const visitas: { chave: string; itens: typeof proximos }[] = [];
  for (const pedido of proximos) {
    const existente = pedido.grupoId ? visitas.find((v) => v.chave === pedido.grupoId) : undefined;
    if (existente) existente.itens.push(pedido);
    else visitas.push({ chave: pedido.grupoId ?? pedido.id, itens: [pedido] });
  }

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

      <div className="grid grid-cols-2 gap-3 mb-6 max-w-lg">
        <Kpi rotulo="Agendados" valor={String(visitas.length)} />
        <Kpi
          rotulo="Aguardando confirmação"
          valor={String(
            visitas.filter((v) => v.itens.some((p) => p.status === "SOLICITADO")).length + aguardando.length
          )}
          sub="a central confirma"
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
        {visitas.length === 0 ? (
          <Vazio>Nenhum atendimento agendado.</Vazio>
        ) : (
          <Tabela cabecalho={["Data", "Horário", "Serviços", "Profissional", "Paciente", "Pagamento", "Status", ""]}>
            {visitas.map(({ chave, itens }) => {
              const primeiro = itens[0];
              // O status da visita é o menos avançado: basta um serviço ainda
              // solicitado para a visita inteira estar solicitada.
              const statusDaVisita = itens.some((p) => p.status === "SOLICITADO") ? "SOLICITADO" : primeiro.status;
              const duracaoTotal = itens.reduce((soma, p) => soma + p.duracaoMin, 0);
              const profissionais = Array.from(
                new Set(itens.map((p) => p.profissional?.nome).filter((n): n is string => Boolean(n)))
              );
              return (
                <tr key={chave} className="border-b border-gray-100 last:border-0 align-top">
                  <td className="py-2 pr-3 font-semibold whitespace-nowrap">{formatarDataCurta(primeiro.data)}</td>
                  <td className="py-2 pr-3">{primeiro.horaInicio}</td>
                  <td className="py-2 pr-3 text-gray-600">
                    {itens.map((pedido) => (
                      <div key={pedido.id}>
                        {pedido.servico.nome}
                        {pedido.quantidade > 1 && <span className="text-gray-400"> × {pedido.quantidade}</span>}
                      </div>
                    ))}
                  </td>
                  <td className="py-2 pr-3 text-gray-600">
                    {/* O nome só aparece na véspera (ata de 02/10); antes disso,
                        nem o valor entra no lugar — o histórico de consumo não
                        é para negociar desconto. */}
                    {!nomeDoProfissionalVisivel(primeiro.data, primeiro.horaInicio) ? (
                      <span className="text-gray-400" title="O nome de quem vai atender aparece um dia antes do atendimento.">
                        a confirmar
                      </span>
                    ) : profissionais.length > 0 ? (
                      profissionais.join(", ")
                    ) : (
                      <span className="text-gray-400">a definir</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-gray-500">{primeiro.pacienteNome ?? "—"}</td>
                  <td className="py-2 pr-3 text-gray-600">{primeiro.formaPagamento ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <SeloStatusCliente status={statusDaVisita} />
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/portal/resumo/${primeiro.id}`}
                        className="text-[11px] font-semibold text-bordo hover:underline whitespace-nowrap"
                      >
                        Ver resumo
                      </Link>
                      <AcoesClinica pedidoId={primeiro.id} />
                      {statusDaVisita !== "SOLICITADO" && (
                        <a
                          href={linkAdicionarGoogleAgenda({
                            titulo: `${itens.map((p) => p.servico.nome).join(" + ")} — Hemoderi`,
                            inicio: instanteDoAtendimento(primeiro.data, primeiro.horaInicio),
                            duracaoMin: duracaoTotal,
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
              );
            })}
          </Tabela>
        )}
      </Cartao>

      {/* Avaliações e histórico saíram desta tela (ata de 05/10): moram em
          Histórico e avaliações. Aqui fica só o chamado. */}
      {aAvaliar > 0 && (
        <Link
          href="/portal/historico"
          className="block rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4 text-xs text-bordo font-semibold hover:bg-amber-50"
        >
          Você tem {aAvaliar} atendimento{aAvaliar === 1 ? "" : "s"} para avaliar →
        </Link>
      )}
    </>
  );
}
