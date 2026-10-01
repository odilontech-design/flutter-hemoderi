import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { Cartao, Kpi, Tabela, Titulo, Vazio } from "@/components/ui";
import { formatarDataCurta, hojeUTC } from "@/lib/data";
import { codigoDoPedido } from "@/lib/numeracao";

export const dynamic = "force-dynamic";

const BOTAO =
  "text-[11px] font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-lg whitespace-nowrap";

/**
 * Todos os relatórios do profissional num lugar só: o que ainda falta enviar
 * e o que já foi enviado, com a situação de cada um.
 *
 * Antes o relatório só aparecia como botão na agenda, dentro de cada
 * atendimento — quem queria saber "quais eu ainda devo?" ou "aquele foi
 * aprovado?" tinha de caçar atendimento por atendimento. E é do relatório
 * aprovado que nasce o repasse, então a situação aqui explica o "a receber".
 */
export default async function Relatorios() {
  const sessao = await exigirProfissional();
  const hoje = hojeUTC();

  const dadosDoPedido = {
    numero: true,
    data: true,
    horaInicio: true,
    clinica: { select: { nome: true } },
    servico: { select: { nome: true } },
  } as const;

  const [faltam, enviados] = await Promise.all([
    // Atendimento já aceito, de hoje para trás, ainda sem relatório. Futuro não
    // entra: não há o que relatar.
    prisma.pedido.findMany({
      where: {
        profissionalId: sessao.profissionalId,
        status: "ALOCADO",
        aceitoEm: { not: null },
        data: { lte: hoje },
        relatorio: { is: null },
      },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      select: { id: true, ...dadosDoPedido },
    }),
    prisma.relatorioAtendimento.findMany({
      where: { profissionalId: sessao.profissionalId },
      orderBy: { enviadoEm: "desc" },
      take: 200,
      select: {
        id: true,
        compareceu: true,
        aprovadoEm: true,
        devolvidoEm: true,
        motivoDevolucao: true,
        pedido: { select: { id: true, ...dadosDoPedido } },
        _count: { select: { adicionais: true } },
      },
    }),
  ]);

  const aprovados = enviados.filter((r) => r.aprovadoEm).length;
  // Devolvido pelo pós-venda: é a bola do profissional, não do pós-venda.
  const devolvidos = enviados.filter((r) => r.devolvidoEm && !r.aprovadoEm);
  const emConferencia = enviados.length - aprovados - devolvidos.length;

  return (
    <>
      <Titulo>Relatórios</Titulo>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi rotulo="Faltam enviar" valor={String(faltam.length)} />
        <Kpi rotulo="Para corrigir" valor={String(devolvidos.length)} />
        <Kpi rotulo="Em conferência" valor={String(emConferencia)} />
        <Kpi rotulo="Aprovados" valor={String(aprovados)} />
      </div>

      {devolvidos.length > 0 && (
        <Cartao className="mb-4 border-red-300">
          <div className="font-display font-bold text-red-700 text-sm mb-1">Devolvidos para correção</div>
          <div className="text-[11px] text-gray-500 mb-3">
            A central recusou estes relatórios. Corrija o que foi pedido e reenvie — o repasse só é liberado depois
            que o relatório é aprovado.
          </div>
          <div className="space-y-3">
            {devolvidos.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
              >
                <div className="text-xs min-w-0">
                  <div className="font-semibold text-bordo">
                    {codigoDoPedido(r.pedido.numero, r.pedido.clinica.nome, r.pedido.data)} ·{" "}
                    {formatarDataCurta(r.pedido.data)} {r.pedido.horaInicio}
                  </div>
                  <div className="text-gray-500">
                    {r.pedido.clinica.nome} · {r.pedido.servico.nome}
                  </div>
                  <div className="mt-1 text-red-800">
                    <strong>O que corrigir:</strong> {r.motivoDevolucao ?? "—"}
                  </div>
                </div>
                <Link href={`/profissional/relatorio/${r.pedido.id}`} className={`${BOTAO} bg-bordo text-white hover:bg-bordoEscuro`}>
                  Corrigir relatório
                </Link>
              </div>
            ))}
          </div>
        </Cartao>
      )}

      <Cartao className={`mb-4 ${faltam.length > 0 ? "border-bordo" : ""}`}>
        <div className="font-display font-bold text-bordo text-sm mb-1">Faltam enviar</div>
        <div className="text-[11px] text-gray-500 mb-3">
          O repasse só é liberado depois que o relatório é enviado e conferido pela central.
        </div>
        {faltam.length === 0 ? (
          <Vazio>Nenhum relatório pendente. Tudo em dia.</Vazio>
        ) : (
          <Tabela cabecalho={["Pedido", "Data", "Clínica", "Serviço", ""]}>
            {faltam.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-3 font-semibold whitespace-nowrap">{codigoDoPedido(p.numero, p.clinica.nome, p.data)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {formatarDataCurta(p.data)} {p.horaInicio}
                </td>
                <td className="py-2 pr-3 text-gray-600">{p.clinica.nome}</td>
                <td className="py-2 pr-3 text-gray-500">{p.servico.nome}</td>
                <td className="py-2 text-right">
                  <Link href={`/profissional/relatorio/${p.id}`} className={`${BOTAO} bg-bordo text-white hover:bg-bordoEscuro`}>
                    Preencher relatório
                  </Link>
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      <Cartao>
        <div className="font-display font-bold text-bordo text-sm mb-3">Já enviados</div>
        {enviados.length === 0 ? (
          <Vazio>Você ainda não enviou nenhum relatório.</Vazio>
        ) : (
          <Tabela cabecalho={["Pedido", "Data", "Clínica", "Serviço", "Situação", ""]}>
            {enviados.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-3 font-semibold whitespace-nowrap">
                  {codigoDoPedido(r.pedido.numero, r.pedido.clinica.nome, r.pedido.data)}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {formatarDataCurta(r.pedido.data)} {r.pedido.horaInicio}
                </td>
                <td className="py-2 pr-3 text-gray-600">{r.pedido.clinica.nome}</td>
                <td className="py-2 pr-3 text-gray-500">
                  {r.pedido.servico.nome}
                  {r._count.adicionais > 0 && (
                    <span className="block text-[10px] text-amber-700">+ {r._count.adicionais} serviço(s) além do agendado</span>
                  )}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {r.aprovadoEm ? (
                    <span className="text-emerald-700 font-semibold">aprovado</span>
                  ) : r.devolvidoEm ? (
                    <span className="text-red-700 font-semibold">devolvido</span>
                  ) : (
                    <span className="text-amber-700 font-semibold">em conferência</span>
                  )}
                  {!r.compareceu && <span className="block text-[10px] text-gray-400">paciente faltou</span>}
                </td>
                <td className="py-2 text-right">
                  <Link
                    href={`/profissional/relatorio/${r.pedido.id}`}
                    className={`${BOTAO} border border-gray-300 text-gray-600 hover:bg-gray-50`}
                  >
                    {r.aprovadoEm ? "Ver" : "Ver / corrigir"}
                  </Link>
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>
    </>
  );
}
