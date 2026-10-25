import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { Cartao, SeloStatus, Titulo, Vazio } from "@/components/ui";
import { formatarDataCurta, formatarDiaEData, hojeUTC, instanteDoAtendimento, isoDeData, proximosDias } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { parametros } from "@/lib/alocacao";
import { LOCAL_FECHADO, localRevelado } from "@/lib/sigilo";
import { AdicionarAgenda } from "@/components/AdicionarAgenda";
import { houveAtraso } from "@/lib/atraso";
import { comEnderecoDoPedido } from "@/lib/endereco";
import { ResumoDoAtendimento } from "@/components/ResumoDoAtendimento";
import { ROTULO_ESTADO_DO_DIA, situacaoDoDia } from "@/lib/minha-disponibilidade";
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
function eventoDoPedido(pedido: PedidoParaCalendario & { id: string }, revelado: boolean) {
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

  return {
    id: pedido.id,
    titulo: revelado ? `${pedido.servico.nome} — ${pedido.clinica.nome}` : `${pedido.servico.nome} — Hemoderi`,
    local: local || undefined,
    inicio: instanteDoAtendimento(pedido.data, pedido.horaInicio),
    duracaoMin: pedido.servico.duracaoMin,
  };
}

export const dynamic = "force-dynamic";

/** "Campinas/SP" — a cidade aparece desde a alocação (ata de 13/10), mesmo com a clínica ainda em sigilo. */
function cidadeDoPedido(pedido: {
  clinica: { cidade: string | null; uf?: string | null };
  endereco: { cidade: string | null; uf?: string | null } | null;
}) {
  const onde = comEnderecoDoPedido(pedido.clinica, pedido.endereco);
  return [onde.cidade, onde.uf].filter(Boolean).join("/");
}

/** A clínica quando já revelada; antes disso, o aviso de sigilo com a cidade. */
function ondeE(revelado: boolean, pedido: Parameters<typeof cidadeDoPedido>[0] & { clinica: { nome: string } }) {
  const cidade = cidadeDoPedido(pedido);
  if (revelado) return <>{pedido.clinica.nome}{cidade ? ` · ${cidade}` : ""}</>;
  return (
    <>
      {cidade && <strong className="font-semibold text-gray-600">{cidade} · </strong>}
      <span className="italic text-gray-400">{LOCAL_FECHADO}</span>
    </>
  );
}

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
 * Depois os compromissos (hoje e os próximos 7 dias) e só então os
 * relatórios por preencher ou corrigir (ata de 20/10): relatório atrasado
 * trava o pagamento da própria pessoa, o que é grave mas não é de ninguém
 * mais.
 */
export default async function MinhaAgenda() {
  const sessao = await exigirProfissional();
  const hoje = hojeUTC();

  const meus = { profissionalId: sessao.profissionalId, status: "ALOCADO" as const };
  const dadosDoPedido = {
    clinica: {
      select: { nome: true, endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true },
    },
    endereco: {
      select: { endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true, observacoes: true },
    },
    servico: { select: { nome: true, duracaoMin: true, descricao: true } },
  };

  // A agenda dos próximos 7 dias (ata de 05/10): hoje mais seis, com os dias
  // livres visíveis — é o que o profissional olha para planejar a semana.
  const semana = proximosDias(7);
  const fimDaSemana = semana[semana.length - 1];

  const [config, devolvidos, aguardandoAceite, deHoje, atrasados, proximos, daSemana, janelas, bloqueios] = await Promise.all([
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
    // A disponibilidade declarada da semana, para a coluna "Minha
    // disponibilidade" (ata de 13/10).
    prisma.disponibilidade.findMany({
      where: { profissionalId: sessao.profissionalId },
      select: { diaSemana: true, horaInicio: true, horaFim: true },
      orderBy: { horaInicio: "asc" },
    }),
    prisma.bloqueio.findMany({
      where: { profissionalId: sessao.profissionalId, data: { gte: hoje, lte: fimDaSemana } },
      select: { data: true, horaInicio: true, horaFim: true, motivo: true },
    }),
  ]);

  // Cadastro incompleto (revisão de 25/10): sem telefone a central não fala
  // com a pessoa nem o aviso de alocação chega; sem chave Pix não há repasse.
  const cadastro = await prisma.profissional.findUnique({
    where: { id: sessao.profissionalId },
    select: { telefone: true, chavePix: true },
  });
  const faltando = [!cadastro?.telefone && "telefone (WhatsApp)", !cadastro?.chavePix && "chave Pix"].filter(Boolean);

  return (
    <>
      <Titulo>Minha agenda</Titulo>

      {faltando.length > 0 && (
        <Cartao className="mb-3 border-amber-300 bg-amber-50/50">
          <div className="text-[11px] text-amber-900">
            <strong>Complete seu cadastro:</strong> falta {faltando.join(" e ")}. Sem isso a central não consegue
            avisar você dos atendimentos{!cadastro?.chavePix && " nem pagar o seu repasse"}.{" "}
            <Link href="/profissional/meus-dados" className="font-semibold text-bordo hover:underline">
              Completar agora →
            </Link>
          </div>
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
                        {pedido.quantidade > 1 ? ` × ${pedido.quantidade}` : ""}
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
                {/* Endereço e resumo à mão o tempo todo (ata de 13/10): é o que
                    o profissional procura na hora de chegar e de registrar a
                    chegada. */}
                {localRevelado(pedido.data, pedido.horaInicio, config.horasRevelarLocal) ? (
                  <div className="mb-2">
                    <ResumoDoAtendimento
                      dados={{
                        ...pedido,
                        onde: comEnderecoDoPedido(pedido.clinica, pedido.endereco),
                        referencias: pedido.endereco?.observacoes ?? null,
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-500 mb-2">{ondeE(false, pedido)}</div>
                )}
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
                  <AdicionarAgenda variante="link" evento={eventoDoPedido(pedido, localRevelado(pedido.data, pedido.horaInicio, config.horasRevelarLocal))} />
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

      {/* Duas colunas (ata de 13/10): o que EU declarei e o que a Hemoderi
          marcou. Juntas numa lista só, "livre" ficava ambíguo — livre porque
          está disponível, ou livre porque não disse nada? */}
      <Cartao className="mb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <div className="font-display font-bold text-bordo text-sm">Próximos 7 dias</div>
          <Link href="/profissional/disponibilidade" className="text-[11px] font-semibold text-bordo hover:underline">
            Atualizar minha disponibilidade →
          </Link>
        </div>
        <div className="text-[11px] text-gray-500 mb-3">
          A cidade aparece desde a alocação; a clínica e o endereço, {config.horasRevelarLocal}h antes do atendimento.
        </div>
        <div className="hidden sm:grid grid-cols-[7rem_minmax(0,1fr)_minmax(0,1.6fr)] gap-3 pb-1 border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          <div>Dia</div>
          <div>Minha disponibilidade</div>
          <div>Agendamentos Hemoderi</div>
        </div>
        <div className="divide-y divide-gray-100">
          {semana.map((dia) => {
            const doDia = daSemana.filter((p) => p.data.getTime() === dia.getTime());
            const situacao = situacaoDoDia(
              janelas.filter((j) => j.diaSemana === dia.getUTCDay()),
              bloqueios.filter((b) => isoDeData(b.data) === isoDeData(dia))
            );
            const cor =
              situacao.estado === "disponivel"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : situacao.estado === "ausente"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-gray-50 text-gray-500 border-gray-200";
            return (
              <div
                key={dia.toISOString()}
                className="py-2 grid grid-cols-1 sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1.6fr)] gap-x-3 gap-y-1.5"
              >
                <div className="text-xs font-semibold text-bordo">
                  {formatarDiaEData(dia)}
                  {dia.getTime() === hoje.getTime() && (
                    <span className="sm:block text-[10px] font-normal text-gray-400"> hoje</span>
                  )}
                </div>
                <div className="text-[11px]">
                  <span className="sm:hidden text-[10px] text-gray-400 mr-1">Minha disponibilidade:</span>
                  <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${cor}`}>
                    {ROTULO_ESTADO_DO_DIA[situacao.estado]}
                  </span>
                  {situacao.janelas.length > 0 && (
                    <span className="ml-1 text-gray-500">{situacao.janelas.join(", ")}</span>
                  )}
                  {situacao.ausenciasParciais.length > 0 && (
                    <div className="text-[10px] text-red-600 mt-0.5">
                      {situacao.estado === "ausente" ? situacao.ausenciasParciais.join(", ") : `ausente ${situacao.ausenciasParciais.join(", ")}`}
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-2">
                  {doDia.length === 0 ? (
                    <div className="text-[11px] text-gray-400">
                      <span className="sm:hidden text-[10px] mr-1">Agendamentos Hemoderi:</span>
                      Nenhum agendamento
                    </div>
                  ) : (
                    doDia.map((pedido) => (
                      <div key={pedido.id} className="text-xs">
                        <div className="font-semibold">
                          {pedido.horaInicio} · {pedido.servico.nome}
                          {pedido.quantidade > 1 ? ` × ${pedido.quantidade}` : ""}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {ondeE(localRevelado(pedido.data, pedido.horaInicio, config.horasRevelarLocal), pedido)}
                          {localRevelado(pedido.data, pedido.horaInicio, config.horasRevelarLocal) && pedido.doutorNome
                            ? ` · ${/^dr/i.test(pedido.doutorNome) ? pedido.doutorNome : `Dr(a). ${pedido.doutorNome}`}`
                            : ""}{" "}
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

      {/* Relatórios depois dos compromissos (ata de 20/10): quem abre a agenda
          quer saber primeiro aonde vai; o que falta preencher vem em seguida. */}
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
                    {ondeE(localRevelado(pedido.data, pedido.horaInicio, config.horasRevelarLocal), pedido)} ·{" "}
                    {pedido.servico.nome}
                  </div>
                  <AdicionarAgenda variante="link" evento={eventoDoPedido(pedido, localRevelado(pedido.data, pedido.horaInicio, config.horasRevelarLocal))} />
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
