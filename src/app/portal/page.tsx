import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { Cartao, Kpi, SeloStatus, Tabela, Titulo, Vazio } from "@/components/ui";
import { formatarDataCurta, hojeUTC } from "@/lib/data";
import { STATUS_ATIVOS } from "@/lib/pedido";
import { AcoesClinica } from "./AcoesClinica";
import { CartaoDivulgacao } from "@/components/CartaoDivulgacao";

export const dynamic = "force-dynamic";

/**
 * O que a clínica vê: os próprios pedidos, e só. O valor cobrado aparece,
 * o repasse do profissional não — quanto a Hemoderi paga a quem executa não é
 * assunto do cliente.
 */
export default async function MeusAgendamentos() {
  const sessao = await exigirClinica();
  const hoje = hojeUTC();

  const [proximos, historico, total, clinica] = await Promise.all([
    prisma.pedido.findMany({
      where: { clinicaId: sessao.clinicaId, data: { gte: hoje }, status: { in: STATUS_ATIVOS } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      include: { servico: { select: { nome: true } }, profissional: { select: { nome: true } } },
    }),
    prisma.pedido.findMany({
      where: { clinicaId: sessao.clinicaId, status: { in: ["REALIZADO", "FALTOU", "CANCELADO"] } },
      orderBy: [{ data: "desc" }],
      take: 30,
      include: { servico: { select: { nome: true } }, profissional: { select: { nome: true } } },
    }),
    prisma.pedido.count({ where: { clinicaId: sessao.clinicaId, status: "REALIZADO" } }),
    prisma.clinica.findUnique({ where: { id: sessao.clinicaId }, select: { slug: true, nome: true } }),
  ]);

  return (
    <>
      <Titulo
        acao={
          <Link
            href="/portal/agendar"
            className="bg-navy text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-navyDeep"
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
      </div>

      <Cartao className="mb-3">
        <div className="font-display font-bold text-navy text-sm mb-3">Próximos</div>
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
                  {pedido.profissional?.nome ?? <span className="text-gray-400">a definir</span>}
                </td>
                <td className="py-2 pr-3 text-gray-500">{pedido.pacienteNome ?? "—"}</td>
                <td className="py-2 pr-3">
                  <SeloStatus status={pedido.status} />
                </td>
                <td className="py-2">
                  <AcoesClinica pedidoId={pedido.id} />
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      <Cartao className="mb-3">
        <div className="font-display font-bold text-navy text-sm mb-3">Histórico</div>
        {historico.length === 0 ? (
          <Vazio>Ainda sem histórico.</Vazio>
        ) : (
          <Tabela cabecalho={["Data", "Serviço", "Profissional", "Status"]}>
            {historico.map((pedido) => (
              <tr key={pedido.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-3">{formatarDataCurta(pedido.data)}</td>
                <td className="py-2 pr-3 text-gray-600">{pedido.servico.nome}</td>
                <td className="py-2 pr-3 text-gray-600">{pedido.profissional?.nome ?? "—"}</td>
                <td className="py-2 pr-3">
                  <SeloStatus status={pedido.status} />
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
