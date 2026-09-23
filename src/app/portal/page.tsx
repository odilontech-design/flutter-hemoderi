import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { Cartao, Kpi, SeloStatus, Tabela, Titulo, Vazio } from "@/components/ui";
import { formatarDataCurta, hojeUTC, instanteDoAtendimento, nomeDoProfissionalVisivel } from "@/lib/data";
import { STATUS_ATIVOS } from "@/lib/pedido";
import { AcoesClinica } from "./AcoesClinica";
import { AvaliarAtendimento } from "./AvaliarAtendimento";
import { ResponderNps } from "./ResponderNps";
import { CartaoDivulgacao } from "@/components/CartaoDivulgacao";
import { formatarMedia, mediaDeNotas } from "@/lib/avaliacao";
import { formatarReais } from "@/lib/dinheiro";
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

  const [proximos, historico, total, clinica, aAvaliar, notasDadas, npsPendente] = await Promise.all([
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
      take: 30,
      include: {
        servico: { select: { nome: true } },
        profissional: { select: { nome: true } },
        avaliacao: { select: { nota: true, comentario: true } },
      },
    }),
    prisma.pedido.count({ where: { clinicaId: sessao.clinicaId, status: "REALIZADO" } }),
    prisma.clinica.findUnique({ where: { id: sessao.clinicaId }, select: { slug: true, nome: true } }),
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
  ]);

  const minhaMedia = mediaDeNotas(notasDadas.map((a) => a.nota));

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
          valor={String(proximos.filter((p) => p.status === "SOLICITADO").length)}
          sub="a central confirma"
        />
        <Kpi
          rotulo="Média que você deu"
          valor={formatarMedia(minhaMedia)}
          sub={notasDadas.length ? `${notasDadas.length} avaliação(ões)` : "nenhuma avaliação ainda"}
        />
      </div>

      <Cartao className="mb-3">
        <div className="font-display font-bold text-bordo text-sm mb-3">Próximos</div>
        {proximos.length === 0 ? (
          <Vazio>Nenhum atendimento agendado.</Vazio>
        ) : (
          <Tabela cabecalho={["Data", "Hora", "Serviço", "Profissional", "Paciente", "Status", ""]}>
            {proximos.map((pedido) => (
              <tr key={pedido.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-3 font-semibold">{formatarDataCurta(pedido.data)}</td>
                <td className="py-2 pr-3">{pedido.horaInicio}</td>
                <td className="py-2 pr-3 text-gray-600">{pedido.servico.nome}</td>
                <td className="py-2 pr-3 text-gray-600">
                  {!nomeDoProfissionalVisivel(pedido.data, pedido.horaInicio) ? (
                    <span title="O nome de quem vai atender aparece 24h antes do atendimento.">
                      {formatarReais(pedido.valorServicoCentavos)}
                    </span>
                  ) : (
                    pedido.profissional?.nome ?? <span className="text-gray-400">a definir</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-gray-500">{pedido.pacienteNome ?? "—"}</td>
                <td className="py-2 pr-3">
                  <SeloStatus status={pedido.status} />
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
        <div className="font-display font-bold text-bordo text-sm mb-3">Histórico</div>
        {historico.length === 0 ? (
          <Vazio>Ainda sem histórico.</Vazio>
        ) : (
          <Tabela cabecalho={["Data", "Serviço", "Profissional", "Status", "Sua avaliação"]}>
            {historico.map((pedido) => (
              <tr key={pedido.id} className="border-b border-gray-100 last:border-0 align-top">
                <td className="py-2 pr-3">{formatarDataCurta(pedido.data)}</td>
                <td className="py-2 pr-3 text-gray-600">{pedido.servico.nome}</td>
                <td className="py-2 pr-3 text-gray-600">{pedido.profissional?.nome ?? "—"}</td>
                <td className="py-2 pr-3">
                  <SeloStatus status={pedido.status} />
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

      {clinica && <CartaoDivulgacao slug={clinica.slug} nome={clinica.nome} />}
    </>
  );
}
