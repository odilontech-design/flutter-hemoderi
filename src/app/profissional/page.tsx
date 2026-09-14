import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { Cartao, SeloStatus, Titulo, Vazio } from "@/components/ui";
import { formatarDataCurta, hojeUTC } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { parametros } from "@/lib/alocacao";
import { LOCAL_FECHADO, localRevelado } from "@/lib/sigilo";

export const dynamic = "force-dynamic";

/**
 * A agenda do profissional, e o pendente em primeiro lugar.
 *
 * Atendimento já passado e sem relatório é o que trava o pagamento dele — por
 * isso abre a tela, antes até do que vem a seguir.
 */
export default async function MinhaAgenda() {
  const sessao = await exigirProfissional();
  const hoje = hojeUTC();

  const [config, aRelatar, proximos] = await Promise.all([
    parametros(),
    prisma.pedido.findMany({
      where: {
        profissionalId: sessao.profissionalId,
        status: "ALOCADO",
        data: { lte: hoje },
        relatorio: { is: null },
      },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      include: { clinica: { select: { nome: true } }, servico: { select: { nome: true } } },
    }),
    prisma.pedido.findMany({
      where: { profissionalId: sessao.profissionalId, status: "ALOCADO", data: { gt: hoje } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      include: { clinica: { select: { nome: true } }, servico: { select: { nome: true } } },
    }),
  ]);

  return (
    <>
      <Titulo>Minha agenda</Titulo>

      {aRelatar.length > 0 && (
        <Cartao className="mb-3 border-red-200">
          <div className="font-display font-bold text-red-600 text-sm mb-1">
            {aRelatar.length} atendimento(s) esperando relatório
          </div>
          <div className="text-[11px] text-gray-500 mb-3">
            O repasse é liberado quando o relatório é enviado.
          </div>
          <div className="space-y-2">
            {aRelatar.map((pedido) => (
              <div
                key={pedido.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2 last:border-0 last:pb-0"
              >
                <div className="text-xs">
                  <div className="font-semibold text-bordo">
                    {formatarDataCurta(pedido.data)} · {pedido.horaInicio} · {pedido.clinica.nome}
                  </div>
                  <div className="text-gray-500">
                    {pedido.servico.nome} · {formatarReais(pedido.valorRepasseCentavos)}
                  </div>
                </div>
                <Link
                  href={`/profissional/relatorio/${pedido.id}`}
                  className="bg-bordo text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-bordoEscuro"
                >
                  Preencher relatório
                </Link>
              </div>
            ))}
          </div>
        </Cartao>
      )}

      <Cartao>
        <div className="font-display font-bold text-bordo text-sm mb-3">Próximos atendimentos</div>
        <div className="text-[11px] text-gray-500 mb-3">
          A clínica aparece {config.horasRevelarLocal}h antes do atendimento, junto com o lembrete —
          a distribuição é feita por disponibilidade, não por endereço.
        </div>
        {proximos.length === 0 ? (
          <Vazio>Nada agendado. Declare sua disponibilidade para receber atendimentos.</Vazio>
        ) : (
          <div className="space-y-2">
            {proximos.map((pedido) => (
              <div key={pedido.id} className="flex items-center justify-between gap-3 text-xs border-b border-gray-100 pb-2 last:border-0">
                <div>
                  <div className="font-semibold text-bordo">
                    {formatarDataCurta(pedido.data)} · {pedido.horaInicio}
                  </div>
                  <div className="text-gray-500">
                    {localRevelado(pedido.data, pedido.horaInicio, config.horasRevelarLocal) ? (
                      <>
                        {pedido.clinica.nome}
                        {pedido.doutorNome ? ` · Dr(a). ${pedido.doutorNome}` : ""}
                      </>
                    ) : (
                      <span className="italic text-gray-400">{LOCAL_FECHADO}</span>
                    )}{" "}
                    · {pedido.servico.nome}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatarReais(pedido.valorRepasseCentavos)}</div>
                  <SeloStatus status={pedido.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Cartao>
    </>
  );
}
