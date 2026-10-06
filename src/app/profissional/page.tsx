import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { Cartao, SeloStatus, Titulo, Vazio } from "@/components/ui";
import { formatarDataCurta, formatarDiaEData, hojeUTC, instanteDoAtendimento, proximosDias } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { parametros } from "@/lib/alocacao";
import { LOCAL_FECHADO, localRevelado } from "@/lib/sigilo";
import { linkAdicionarGoogleAgenda } from "@/lib/google-calendar-link";
import { houveAtraso } from "@/lib/atraso";
import { comEnderecoDoPedido } from "@/lib/endereco";
import { AceiteAlocacao, BotaoCheckin } from "./AcoesAtendimento";

type PedidoParaCalendario = {
  data: Date;
  horaInicio: string;
  servico: { nome: string; duracaoMin: number };
  clinica: { nome: string; endereco: string | null; numero: string | null; bairro: string | null; cidade: string | null };
  endereco: { endereco: string; numero: string | null; bairro: string | null; cidade: string | null } | null;
};

/**
 * O convite de calendário respeita o mesmo sigilo do endereço (lib/sigilo.ts,
 * ata de 14/09): antes da janela de revelação, nem o nome da clínica nem o
 * endereço entram no evento — só "quando", que é o que o profissional
 * precisa para reservar a data antes de saber onde é.
 */
function linkCalendarioDoPedido(pedido: PedidoParaCalendario, revelado: boolean): string {
  // O endereço do PEDIDO, quando a clínica escolheu outro que não o principal.
  const onde = comEnderecoDoPedido(pedido.clinica, pedido.endereco);
  const local = revelado
    ? [
        [onde.endereco, onde.numero].filter(Boolean).join(", "),
        onde.bairro,
        onde.cidade,
      ]
        .filter(Boolean)
        .join(" — ")
    : undefined;

  return linkAdicionarGoogleAgenda({
    titulo: revelado ? `${pedido.servico.nome} — ${pedido.clinica.nome}` : `${pedido.servico.nome} — Hemoderi`,
    local: local || undefined,
    inicio: instanteDoAtendimento(pedido.data, pedido.horaInicio),
    duracaoMin: pedido.servico.duracaoMin,
  });
}

export const dynamic = "force-dynamic";

/** "· ajuda de custo R$ 150,00" quando a logística combinou uma na alocação. */
function ajudaDeCusto(centavos: number | null) {
  return centavos != null ? ` · ajuda de custo ${formatarReais(centavos)}` : "";
}

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
    clinica: { select: { nome: true, endereco: true, numero: true, bairro: true, cidade: true, uf: true } },
    endereco: { select: { endereco: true, numero: true, bairro: true, cidade: true, uf: true } },
    servico: { select: { nome: true, duracaoMin: true, descricao: true } },
  };

  // A agenda dos próximos 7 dias (ata de 05/10): hoje mais seis, com os dias
  // livres visíveis — é o que o profissional olha para planejar a semana.
  const semana = proximosDias(7);
  const fimDaSemana = semana[semana.length - 1];

  const [config, devolvidos, aguardandoAceite, deHoje, atrasados, proximos, daSemana] = await Promise.all([
    parametros(),
    // Relatórios que a central recusou: vêm antes de tudo, porque travam o
    // repasse e só o próprio profissional resolve.
    prisma.relatorioAtendimento.count({
      where: { profissionalId: sessao.profissionalId, aprovadoEm: null, devolvidoEm: { not: null } },
    }),
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
      where: { ...meus, aceitoEm: { not: null }, data: { gt: fimDaSemana } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      include: dadosDoPedido,
    }),
    prisma.pedido.findMany({
      where: { ...meus, data: { gte: hoje, lte: fimDaSemana } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      include: dadosDoPedido,
    }),
  ]);

  return (
    <>
      <Titulo>Minha agenda</Titulo>

      {devolvidos > 0 && (
        <Cartao className="mb-3 border-red-300">
          <div className="font-display font-bold text-red-700 text-sm mb-1">
            {devolvidos} relatório(s) devolvido(s) para correção
          </div>
          <div className="text-[11px] text-gray-500 mb-2">A central pediu um ajuste. O valor do profissional espera o reenvio.</div>
          <Link href="/profissional/relatorios" className="text-xs font-semibold text-bordo hover:underline">
            Ver o que corrigir →
          </Link>
        </Cartao>
      )}

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
                <div className="text-[11px] text-gray-500 mb-1">
                  {localRevelado(pedido.data, pedido.horaInicio, config.horasRevelarLocal) ? (
                    pedido.clinica.nome
                  ) : (
                    <span className="italic text-gray-400">{LOCAL_FECHADO}</span>
                  )}{" "}
                  · valor do profissional: {formatarReais(pedido.valorRepasseCentavos)}
                  {ajudaDeCusto(pedido.ajudaCustoCentavos)}
                </div>
                {/* A cidade aparece já no aceite (ata de 02/10): aceitar às cegas
                    inviabiliza planejar o dia quando há compromissos em lugares
                    distantes. O endereço exato continua fechado até a janela de
                    revelação — só a cidade e o que é o serviço. */}
                {(() => {
                  const onde = comEnderecoDoPedido(pedido.clinica, pedido.endereco);
                  const cidade = [onde.cidade, onde.uf].filter(Boolean).join("/");
                  return (
                    <div className="text-[11px] text-gray-600 mb-2 space-y-0.5">
                      {cidade && (
                        <div>
                          <strong>Cidade:</strong> {cidade}
                        </div>
                      )}
                      <div>
                        <strong>Serviço:</strong> {pedido.servico.nome}
                        {pedido.quantidade > 1 ? ` × ${pedido.quantidade}` : ""} · {pedido.servico.duracaoMin} min
                      </div>
                      {pedido.servico.descricao && (
                        <div className="text-gray-400 line-clamp-2">{pedido.servico.descricao}</div>
                      )}
                    </div>
                  );
                })()}
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
                  {pedido.servico.nome} · valor do profissional: {formatarReais(pedido.valorRepasseCentavos)}
                  {ajudaDeCusto(pedido.ajudaCustoCentavos)}
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
                    <BotaoCheckin
                      pedidoId={pedido.id}
                      atrasado={houveAtraso(pedido.data, pedido.horaInicio, new Date())}
                    />
                  )}
                  <a
                    href={linkCalendarioDoPedido(
                      pedido,
                      localRevelado(pedido.data, pedido.horaInicio, config.horasRevelarLocal)
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-bordo hover:underline"
                  >
                    + Google Agenda
                  </a>
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
            O valor do profissional é liberado quando o relatório é enviado e a central confere.
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
                    {pedido.servico.nome} · valor do profissional: {formatarReais(pedido.valorRepasseCentavos)}
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

      <Cartao className="mb-3">
        <div className="font-display font-bold text-bordo text-sm mb-1">Próximos 7 dias</div>
        <div className="text-[11px] text-gray-500 mb-3">
          A clínica aparece {config.horasRevelarLocal}h antes do atendimento — até lá, só o dia, o horário
          e o serviço.
        </div>
        <div className="divide-y divide-gray-100">
          {semana.map((dia) => {
            const doDia = daSemana.filter((p) => p.data.getTime() === dia.getTime());
            return (
              <div key={dia.toISOString()} className="py-2 flex gap-3">
                <div className="w-28 shrink-0 text-xs font-semibold text-bordo">
                  {formatarDiaEData(dia)}
                  {dia.getTime() === hoje.getTime() && (
                    <span className="block text-[10px] font-normal text-gray-400">hoje</span>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  {doDia.length === 0 ? (
                    <div className="text-[11px] text-gray-400">Livre</div>
                  ) : (
                    doDia.map((pedido) => (
                      <div key={pedido.id} className="text-xs">
                        <div className="font-semibold">
                          {pedido.horaInicio} · {pedido.servico.nome}
                          {pedido.quantidade > 1 ? ` × ${pedido.quantidade}` : ""}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {localRevelado(pedido.data, pedido.horaInicio, config.horasRevelarLocal) ? (
                            <>
                              {pedido.clinica.nome}
                              {pedido.doutorNome ? ` · Dr(a). ${pedido.doutorNome}` : ""}
                            </>
                          ) : (
                            <span className="italic text-gray-400">{LOCAL_FECHADO}</span>
                          )}{" "}
                          · valor do profissional: {formatarReais(pedido.valorRepasseCentavos)}
                          {ajudaDeCusto(pedido.ajudaCustoCentavos)}
                          {!pedido.aceitoEm && <span className="ml-1 font-semibold text-amber-700">· aguardando seu aceite</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Cartao>

      <Cartao>
        <div className="font-display font-bold text-bordo text-sm mb-3">Mais adiante</div>
        <div className="text-[11px] text-gray-500 mb-3">
          A clínica aparece {config.horasRevelarLocal}h antes do atendimento, junto com o lembrete —
          a distribuição é feita por disponibilidade, não por endereço.
        </div>
        {proximos.length === 0 ? (
          <Vazio>Nada confirmado além dos próximos 7 dias.</Vazio>
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
                  <a
                    href={linkCalendarioDoPedido(
                      pedido,
                      localRevelado(pedido.data, pedido.horaInicio, config.horasRevelarLocal)
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-bordo hover:underline"
                  >
                    + Google Agenda
                  </a>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-400">valor do profissional</div>
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
