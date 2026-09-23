import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { Cartao, SeloStatus, Titulo, Vazio } from "@/components/ui";
import { formatarDataCurta, hojeUTC } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { parametros } from "@/lib/alocacao";
import { LOCAL_FECHADO, localRevelado } from "@/lib/sigilo";
import { AceiteAlocacao, BotaoCheckin } from "./AcoesAtendimento";

export const dynamic = "force-dynamic";

/**
 * A agenda do profissional, em quatro blocos que não se sobrepõem: o que
 * espera resposta, o que é hoje, o que ficou para trás sem relatório e o que
 * vem pela frente.
 *
 * A ordem é por urgência de QUEM ABRE a tela. O aceite vem primeiro desde a
 * ata de 21/09: é a única coisa aqui que alguém do outro lado está esperando
 * — a clínica tem horário marcado e a logística não sabe se vai ter gente.
 * Relatório atrasado trava o pagamento da própria pessoa, o que é grave mas
 * não é de ninguém mais.
 */
export default async function MinhaAgenda() {
  const sessao = await exigirProfissional();
  const hoje = hojeUTC();

  const meus = { profissionalId: sessao.profissionalId, status: "ALOCADO" as const };
  const dadosDoPedido = {
    clinica: { select: { nome: true } },
    servico: { select: { nome: true } },
  };

  const [config, aguardandoAceite, deHoje, atrasados, proximos] = await Promise.all([
    parametros(),
    prisma.pedido.findMany({
      where: { ...meus, aceitoEm: null },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      include: dadosDoPedido,
    }),
    prisma.pedido.findMany({
      where: { ...meus, aceitoEm: { not: null }, data: hoje },
      orderBy: { horaInicio: "asc" },
      include: { ...dadosDoPedido, relatorio: { select: { id: true } } },
    }),
    prisma.pedido.findMany({
      where: { ...meus, data: { lt: hoje }, relatorio: { is: null } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      include: dadosDoPedido,
    }),
    prisma.pedido.findMany({
      where: { ...meus, aceitoEm: { not: null }, data: { gt: hoje } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      include: dadosDoPedido,
    }),
  ]);

  return (
    <>
      <Titulo>Minha agenda</Titulo>

      {aguardandoAceite.length > 0 && (
        <Cartao className="mb-3 border-bordo">
          <div className="font-display font-bold text-bordo text-sm mb-1">
            {aguardandoAceite.length} atendimento(s) esperando sua confirmação
          </div>
          <div className="text-[11px] text-gray-500 mb-3">
            Depois de aceitar, a remoção passa a ser com a logística — avise agora se não puder.
          </div>
          <div className="space-y-3">
            {aguardandoAceite.map((pedido) => (
              <div key={pedido.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div className="text-xs font-semibold text-bordo">
                  {formatarDataCurta(pedido.data)} · {pedido.horaInicio} · {pedido.servico.nome}
                </div>
                <div className="text-[11px] text-gray-500 mb-2">
                  {localRevelado(pedido.data, pedido.horaInicio, config.horasRevelarLocal) ? (
                    pedido.clinica.nome
                  ) : (
                    <span className="italic text-gray-400">{LOCAL_FECHADO}</span>
                  )}{" "}
                  · {formatarReais(pedido.valorRepasseCentavos)}
                </div>
                <AceiteAlocacao pedidoId={pedido.id} />
              </div>
            ))}
          </div>
        </Cartao>
      )}

      {deHoje.length > 0 && (
        <Cartao className="mb-3">
          <div className="font-display font-bold text-bordo text-sm mb-3">Hoje</div>
          <div className="space-y-3">
            {deHoje.map((pedido) => (
              <div key={pedido.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div className="text-xs font-semibold text-bordo">
                  {pedido.horaInicio} · {pedido.clinica.nome}
                </div>
                <div className="text-[11px] text-gray-500 mb-2">
                  {pedido.servico.nome} · {formatarReais(pedido.valorRepasseCentavos)}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {pedido.checkinEm ? (
                    <span className="text-[11px] font-semibold text-green-700">
                      chegada registrada às{" "}
                      {pedido.checkinEm.toLocaleTimeString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : (
                    <BotaoCheckin pedidoId={pedido.id} />
                  )}
                  {pedido.relatorio ? (
                    <Link
                      href={`/profissional/relatorio/${pedido.id}`}
                      className="text-[11px] font-semibold text-bordo hover:underline"
                    >
                      Corrigir relatório
                    </Link>
                  ) : (
                    <Link
                      href={`/profissional/relatorio/${pedido.id}`}
                      className="bg-bordo text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-bordoEscuro"
                    >
                      Preencher relatório
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Cartao>
      )}

      {atrasados.length > 0 && (
        <Cartao className="mb-3 border-red-200">
          <div className="font-display font-bold text-red-600 text-sm mb-1">
            {atrasados.length} atendimento(s) esperando relatório
          </div>
          <div className="text-[11px] text-gray-500 mb-3">
            O repasse é liberado quando o relatório é enviado e a central confere.
          </div>
          <div className="space-y-2">
            {atrasados.map((pedido) => (
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
          <Vazio>Nada confirmado à frente. Declare sua disponibilidade para receber atendimentos.</Vazio>
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
