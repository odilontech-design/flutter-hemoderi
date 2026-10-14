import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { Cartao, Kpi, Tabela, Titulo, Vazio } from "@/components/ui";
import { competenciaAtual, competenciaPorExtenso, formatarData, formatarDataCurta, hojeUTC } from "@/lib/data";
import { COR_SITUACAO_GANHO, ROTULO_SITUACAO_GANHO, situacaoDoGanho } from "@/lib/ganhos";
import { codigoDoPedido } from "@/lib/numeracao";
import { formatarReais } from "@/lib/dinheiro";

export const dynamic = "force-dynamic";

function competenciaVizinha(competencia: string, passo: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 + passo, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * O que já foi ganho e o que ainda vai cair, atendimento a atendimento — com
 * a situação do relatório de cada um (ata de 13/10): pendente, em
 * conferência, devolvido, aprovado ou pago.
 *
 * Aberto por linha de propósito: um total sozinho não resolve a única
 * pergunta que o profissional traz para a central — "faltou pagar aquele dia
 * na clínica X".
 */
export default async function Ganhos({ searchParams }: { searchParams: { competencia?: string } }) {
  const sessao = await exigirProfissional();
  const competencia = searchParams.competencia ?? competenciaAtual();
  const [ano, mes] = competencia.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 1));
  const hoje = hojeUTC();

  // Todo atendimento do mês (competência = mês do atendimento, a mesma regra
  // do repasse), e não só os que já viraram repasse.
  const atendimentos = await prisma.pedido.findMany({
    where: {
      profissionalId: sessao.profissionalId,
      data: { gte: inicio, lt: fim },
      // Alocado só depois do aceite: antes disso o atendimento ainda não é dele.
      OR: [{ status: { in: ["REALIZADO", "FALTOU"] } }, { status: "ALOCADO", aceitoEm: { not: null } }],
    },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
    select: {
      id: true,
      numero: true,
      data: true,
      horaInicio: true,
      status: true,
      valorRepasseCentavos: true,
      clinica: { select: { nome: true } },
      servico: { select: { nome: true } },
      relatorio: { select: { aprovadoEm: true, devolvidoEm: true } },
      repasse: { select: { status: true, valorCentavos: true, pagoEm: true } },
    },
  });

  const linhas = atendimentos.map((a) => ({
    ...a,
    situacao: situacaoDoGanho({ ...a, hoje }),
    valor: a.repasse?.valorCentavos ?? (a.status === "FALTOU" ? 0 : a.valorRepasseCentavos),
  }));
  const soma = (filtro: (l: (typeof linhas)[number]) => boolean) =>
    linhas.filter(filtro).reduce((s, l) => s + l.valor, 0);
  const emConferencia = soma((l) => l.situacao === "em-conferencia" || l.situacao === "devolvido" || l.situacao === "relatorio-pendente");
  const aReceber = soma((l) => l.situacao === "a-receber");
  const pago = soma((l) => l.situacao === "pago");

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi rotulo="Atendimentos" valor={String(linhas.length)} />
        <Kpi rotulo="Aguardando relatório ou conferência" valor={formatarReais(emConferencia)} />
        <Kpi rotulo="Aprovado, a receber" valor={formatarReais(aReceber)} />
        <Kpi rotulo="Já recebido" valor={formatarReais(pago)} />
      </div>

      <Cartao>
        {linhas.length === 0 ? (
          <Vazio>Nenhum atendimento em {competenciaPorExtenso(competencia)}.</Vazio>
        ) : (
          <Tabela cabecalho={["Pedido", "Data", "Clínica", "Serviço", "Valor do profissional", "Situação"]}>
            {linhas.map((linha) => (
              <tr key={linha.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-3 font-semibold whitespace-nowrap">
                  {codigoDoPedido(linha.numero, linha.clinica.nome, linha.data)}
                </td>
                <td className="py-2 pr-3">
                  {formatarDataCurta(linha.data)} {linha.horaInicio}
                </td>
                <td className="py-2 pr-3 text-gray-600">{linha.clinica.nome}</td>
                <td className="py-2 pr-3 text-gray-500">{linha.servico.nome}</td>
                <td className="py-2 pr-3 font-semibold">{formatarReais(linha.valor)}</td>
                <td className="py-2 pr-3">
                  <span className={`font-semibold ${COR_SITUACAO_GANHO[linha.situacao]}`}>
                    {ROTULO_SITUACAO_GANHO[linha.situacao]}
                    {linha.situacao === "pago" && linha.repasse?.pagoEm ? ` em ${formatarData(linha.repasse.pagoEm)}` : ""}
                  </span>
                  {(linha.situacao === "devolvido" || linha.situacao === "relatorio-pendente") && (
                    <Link
                      href={`/profissional/relatorio/${linha.id}`}
                      className="block text-[11px] font-semibold text-bordo hover:underline"
                    >
                      {linha.situacao === "devolvido" ? "Corrigir relatório →" : "Preencher relatório →"}
                    </Link>
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
