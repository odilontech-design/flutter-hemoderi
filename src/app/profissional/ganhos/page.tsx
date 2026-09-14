import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { Cartao, Kpi, Tabela, Titulo, Vazio } from "@/components/ui";
import { competenciaAtual, competenciaPorExtenso, formatarData, formatarDataCurta } from "@/lib/data";
import { codigoDoPedido } from "@/lib/numeracao";
import { formatarReais } from "@/lib/dinheiro";

export const dynamic = "force-dynamic";

function competenciaVizinha(competencia: string, passo: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 + passo, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * O que já foi ganho e o que ainda vai cair, atendimento a atendimento.
 *
 * Aberto por linha de propósito: um total sozinho não resolve a única
 * pergunta que o profissional traz para a central — "faltou pagar aquele dia
 * na clínica X".
 */
export default async function Ganhos({ searchParams }: { searchParams: { competencia?: string } }) {
  const sessao = await exigirProfissional();
  const competencia = searchParams.competencia ?? competenciaAtual();

  const repasses = await prisma.repasse.findMany({
    where: { profissionalId: sessao.profissionalId, competencia },
    orderBy: { criadoEm: "asc" },
    include: {
      pedido: {
        select: {
          numero: true,
          data: true,
          horaInicio: true,
          clinica: { select: { nome: true } },
          servico: { select: { nome: true } },
        },
      },
    },
  });

  const pendente = repasses.filter((r) => r.status === "PENDENTE").reduce((s, r) => s + r.valorCentavos, 0);
  const pago = repasses.filter((r) => r.status === "PAGO").reduce((s, r) => s + r.valorCentavos, 0);

  return (
    <>
      <Titulo
        acao={
          <div className="flex items-center gap-2 text-xs">
            <Link
              href={`/profissional/ganhos?competencia=${competenciaVizinha(competencia, -1)}`}
              className="px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center text-gray-500"
            >
              ‹
            </Link>
            <span className="font-semibold text-bordo">{competenciaPorExtenso(competencia)}</span>
            <Link
              href={`/profissional/ganhos?competencia=${competenciaVizinha(competencia, 1)}`}
              className="px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center text-gray-500"
            >
              ›
            </Link>
          </div>
        }
      >
        Meus ganhos
      </Titulo>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Kpi rotulo="Atendimentos" valor={String(repasses.length)} />
        <Kpi rotulo="A receber" valor={formatarReais(pendente)} />
        <Kpi rotulo="Já recebido" valor={formatarReais(pago)} />
      </div>

      <Cartao>
        {repasses.length === 0 ? (
          <Vazio>Nenhum atendimento fechado em {competenciaPorExtenso(competencia)}.</Vazio>
        ) : (
          <Tabela cabecalho={["Pedido", "Data", "Clínica", "Serviço", "Valor", "Situação"]}>
            {repasses.map((repasse) => (
              <tr key={repasse.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-3 font-semibold whitespace-nowrap">
                  {codigoDoPedido(repasse.pedido.numero, repasse.pedido.clinica.nome, repasse.pedido.data)}
                </td>
                <td className="py-2 pr-3">
                  {formatarDataCurta(repasse.pedido.data)} {repasse.pedido.horaInicio}
                </td>
                <td className="py-2 pr-3 text-gray-600">{repasse.pedido.clinica.nome}</td>
                <td className="py-2 pr-3 text-gray-500">{repasse.pedido.servico.nome}</td>
                <td className="py-2 pr-3 font-semibold">{formatarReais(repasse.valorCentavos)}</td>
                <td className="py-2 pr-3">
                  {repasse.status === "PAGO" ? (
                    <span className="text-emerald-700 font-semibold">
                      pago {repasse.pagoEm ? `em ${formatarData(repasse.pagoEm)}` : ""}
                    </span>
                  ) : (
                    <span className="text-amber-700 font-semibold">a receber</span>
                  )}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>
    </>
  );
}
