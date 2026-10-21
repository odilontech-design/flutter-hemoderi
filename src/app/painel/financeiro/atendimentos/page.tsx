import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirResponsavel } from "@/lib/sessao";
import { Cartao, Kpi, Tabela, Titulo, Vazio } from "@/components/ui";
import { competenciaAtual, competenciaPorExtenso, formatarDataCurta } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { codigoDoPedido } from "@/lib/numeracao";

export const dynamic = "force-dynamic";

function competenciaVizinha(competencia: string, passo: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 + passo, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Atendimentos do mês, um por linha, com quem é cobrado e quem é pago lado a
 * lado (ata de 20/10). A clínica que agendou — e o responsável financeiro
 * dela, quando é outro — é quem paga; o profissional Hemoderi que executou é
 * quem recebe o repasse. No CRM os dois apareciam misturados (a clínica Oral
 * Company e o profissional que atendeu nela), e a cobrança ia para o lugar
 * errado. Dois filtros separados: por clínica (o que cobrar) e por
 * profissional (o que pagar).
 */
export default async function AtendimentosDoMes({
  searchParams,
}: {
  searchParams: { competencia?: string; clinica?: string; profissional?: string; visao?: string };
}) {
  await exigirResponsavel();
  const competencia = searchParams.competencia ?? competenciaAtual();
  const [ano, mes] = competencia.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 1));
  const visao = searchParams.visao === "profissionais" ? "profissionais" : "clinicas";

  const onde: Prisma.PedidoWhereInput = {
    status: { in: ["REALIZADO", "FALTOU"] },
    data: { gte: inicio, lt: fim },
    ...(searchParams.clinica ? { clinicaId: searchParams.clinica } : {}),
    ...(searchParams.profissional ? { profissionalId: searchParams.profissional } : {}),
  };

  const [pedidos, clinicasDoMes, profissionaisDoMes] = await Promise.all([
    prisma.pedido.findMany({
      where: onde,
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      take: 500,
      select: {
        id: true,
        numero: true,
        data: true,
        horaInicio: true,
        status: true,
        valorServicoCentavos: true,
        valorRepasseCentavos: true,
        doutorNome: true,
        clinica: { select: { id: true, nome: true, cnpj: true, financeiroNome: true, financeiroDocumento: true } },
        profissional: { select: { id: true, nome: true } },
        servico: { select: { nome: true } },
        criadoPor: { select: { nome: true } },
        fatura: { select: { status: true } },
        repasse: { select: { status: true } },
        relatorio: { select: { aprovadoEm: true, recebimento: true } },
      },
    }),
    prisma.pedido.findMany({
      where: { status: { in: ["REALIZADO", "FALTOU"] }, data: { gte: inicio, lt: fim } },
      distinct: ["clinicaId"],
      select: { clinica: { select: { id: true, nome: true } } },
    }),
    prisma.pedido.findMany({
      where: { status: { in: ["REALIZADO", "FALTOU"] }, data: { gte: inicio, lt: fim }, profissionalId: { not: null } },
      distinct: ["profissionalId"],
      select: { profissional: { select: { id: true, nome: true } } },
    }),
  ]);

  const cobrar = pedidos.reduce((s, p) => s + (p.status === "REALIZADO" ? p.valorServicoCentavos : 0), 0);
  const pagar = pedidos.reduce((s, p) => s + (p.status === "REALIZADO" ? p.valorRepasseCentavos : 0), 0);
  const link = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const tudo = { competencia, clinica: searchParams.clinica, profissional: searchParams.profissional, visao, ...extra };
    for (const [k, v] of Object.entries(tudo)) if (v) p.set(k, v);
    return `/painel/financeiro/atendimentos?${p}`;
  };
  const clinicas = clinicasDoMes.map((c) => c.clinica).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const profissionais = profissionaisDoMes
    .map((p) => p.profissional!)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <>
      <Titulo
        acao={
          <div className="flex items-center gap-2 text-xs">
            <Link href={link({ competencia: competenciaVizinha(competencia, -1) })} className="px-3 py-2 text-gray-500">
              ‹
            </Link>
            <span className="font-semibold text-bordo">{competenciaPorExtenso(competencia)}</span>
            <Link href={link({ competencia: competenciaVizinha(competencia, 1) })} className="px-3 py-2 text-gray-500">
              ›
            </Link>
            <Link href="/painel/financeiro" className="ml-2 font-semibold text-bordo hover:underline">
              ← Financeiro
            </Link>
          </div>
        }
      >
        Atendimentos do mês
      </Titulo>

      <div className="flex flex-wrap gap-2 mb-3">
        {(["clinicas", "profissionais"] as const).map((v) => (
          <Link
            key={v}
            href={link({ visao: v })}
            className={`text-xs font-semibold px-3 py-2 rounded-lg border ${
              visao === v ? "bg-bordo text-white border-bordo" : "bg-white text-bordo border-gray-200"
            }`}
          >
            {v === "clinicas" ? "Clínicas · o que cobrar" : "Profissionais · o que pagar"}
          </Link>
        ))}
      </div>

      <Cartao className="mb-3">
        <form className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end text-xs">
          <input type="hidden" name="competencia" value={competencia} />
          <input type="hidden" name="visao" value={visao} />
          <label>
            <span className="block text-gray-500 mb-1">Clínica (quem paga)</span>
            <select name="clinica" defaultValue={searchParams.clinica ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Todas</option>
              {clinicas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="block text-gray-500 mb-1">Profissional Hemoderi (quem recebe)</span>
            <select
              name="profissional"
              defaultValue={searchParams.profissional ?? ""}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">Todos</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="bg-bordo text-white font-semibold px-4 py-2 rounded-lg">
            Filtrar
          </button>
        </form>
      </Cartao>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <Kpi rotulo="Atendimentos" valor={String(pedidos.length)} />
        <Kpi rotulo="A cobrar das clínicas" valor={formatarReais(cobrar)} />
        <Kpi rotulo="A pagar aos profissionais" valor={formatarReais(pagar)} />
      </div>

      <Cartao>
        {pedidos.length === 0 ? (
          <Vazio>Nenhum atendimento fechado com esses filtros.</Vazio>
        ) : visao === "clinicas" ? (
          <Tabela cabecalho={["Pedido", "Data", "Clínica (cobrada)", "Responsável financeiro", "Agendado por", "Serviço", "Valor", "Cobrança"]}>
            {pedidos.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 last:border-0 align-top">
                <td className="py-2 pr-3 font-semibold whitespace-nowrap">
                  <Link href={`/painel/pedidos/${p.id}`} className="hover:underline">
                    {codigoDoPedido(p.numero, p.clinica.nome, p.data)}
                  </Link>
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">{formatarDataCurta(p.data)}</td>
                <td className="py-2 pr-3">{p.clinica.nome}</td>
                <td className="py-2 pr-3 text-gray-600">
                  {p.clinica.financeiroDocumento ? `${p.clinica.financeiroNome} · ${p.clinica.financeiroDocumento}` : `a própria clínica${p.clinica.cnpj ? ` · ${p.clinica.cnpj}` : ""}`}
                </td>
                <td className="py-2 pr-3 text-gray-600">{p.criadoPor?.nome ?? "—"}</td>
                <td className="py-2 pr-3 text-gray-600">
                  {p.servico.nome}
                  {p.doutorNome && <span className="block text-[10px] text-gray-400">Dr(a). {p.doutorNome}</span>}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap font-semibold">
                  {p.status === "FALTOU" ? <span className="text-gray-400">faltou</span> : formatarReais(p.valorServicoCentavos)}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap text-[11px]">
                  {p.fatura ? `fatura ${p.fatura.status.toLowerCase()}` : p.relatorio?.recebimento && p.relatorio.recebimento !== "NAO" ? "recebido no ato" : "a faturar"}
                </td>
              </tr>
            ))}
          </Tabela>
        ) : (
          <Tabela cabecalho={["Pedido", "Data", "Profissional (recebe)", "Clínica onde atendeu", "Serviço", "Valor do serviço", "Repasse", "Situação"]}>
            {pedidos.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 last:border-0 align-top">
                <td className="py-2 pr-3 font-semibold whitespace-nowrap">
                  <Link href={`/painel/pedidos/${p.id}`} className="hover:underline">
                    {codigoDoPedido(p.numero, p.clinica.nome, p.data)}
                  </Link>
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">{formatarDataCurta(p.data)}</td>
                <td className="py-2 pr-3">{p.profissional?.nome ?? <span className="text-red-600">sem profissional</span>}</td>
                <td className="py-2 pr-3 text-gray-600">{p.clinica.nome}</td>
                <td className="py-2 pr-3 text-gray-600">{p.servico.nome}</td>
                <td className="py-2 pr-3 whitespace-nowrap text-gray-500">{formatarReais(p.valorServicoCentavos)}</td>
                <td className="py-2 pr-3 whitespace-nowrap font-semibold">
                  {p.status === "FALTOU" ? <span className="text-gray-400">faltou</span> : formatarReais(p.valorRepasseCentavos)}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap text-[11px]">
                  {p.repasse?.status === "PAGO"
                    ? "pago"
                    : p.repasse?.status === "PENDENTE"
                      ? "a pagar"
                      : p.relatorio?.aprovadoEm
                        ? "aprovado"
                        : p.relatorio
                          ? "relatório em conferência"
                          : "sem relatório"}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
        {pedidos.length === 500 && <div className="text-[10px] text-gray-400 mt-2">Mostrando os 500 primeiros.</div>}
      </Cartao>
    </>
  );
}
