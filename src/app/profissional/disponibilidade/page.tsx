import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { Campo, Cartao, Rotulo, Selecao, Titulo, Vazio } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { BotaoAcao } from "@/components/BotaoAcao";
import {
  adicionarDisponibilidade,
  marcarAusencia,
  removerAusencia,
  removerDisponibilidade,
} from "@/app/actions/disponibilidade";
import {
  competenciaAtual,
  competenciaPorExtenso,
  formatarData,
  formatarDiaEData,
  gradeDoMes,
  isoDeData,
  proximosDias,
} from "@/lib/data";
import { rotuloDaJanela, TURNOS } from "@/lib/turnos";

export const dynamic = "force-dynamic";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function mesVizinho(competencia: string, passo: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 + passo, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function Disponibilidade({
  searchParams,
}: {
  searchParams: { ausenciaData?: string; mes?: string };
}) {
  const sessao = await exigirProfissional();
  const mes = searchParams.mes ?? competenciaAtual();
  const [anoMes, mesMes] = mes.split("-").map(Number);
  const inicioMes = new Date(Date.UTC(anoMes, mesMes - 1, 1));
  const fimMes = new Date(Date.UTC(anoMes, mesMes, 0));

  const [janelas, ausencias, bloqueiosDoMes, eu] = await Promise.all([
    prisma.disponibilidade.findMany({
      where: { profissionalId: sessao.profissionalId },
      orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
    }),
    prisma.bloqueio.findMany({
      where: { profissionalId: sessao.profissionalId, data: { gte: new Date(Date.now() - 86400000) } },
      orderBy: { data: "asc" },
    }),
    prisma.bloqueio.findMany({
      where: { profissionalId: sessao.profissionalId, data: { gte: inicioMes, lte: fimMes } },
      select: { data: true, horaInicio: true },
    }),
    prisma.profissional.findUnique({
      where: { id: sessao.profissionalId },
      select: { googleAgendaId: true },
    }),
  ]);


  // A grade dos próximos 7 dias, cruzando o padrão semanal (Disponibilidade,
  // recorrente por dia-da-semana) com as ausências específicas de cada data
  // — é a "Minha Semana" que a ata de 21/09 pediu: nome do dia e data reais,
  // não mais "Segunda-feira" solta sem dizer qual segunda.
  const semana = proximosDias(7).map((dia) => {
    const diaSemana = dia.getUTCDay();
    const janelasDoDia = janelas.filter((j) => j.diaSemana === diaSemana);
    const bloqueiosDesteDia = ausencias.filter((a) => isoDeData(a.data) === isoDeData(dia));
    const diaTodoBloqueado = bloqueiosDesteDia.some((b) => !b.horaInicio);
    return { dia, janelasDoDia, bloqueiosDesteDia, diaTodoBloqueado };
  });

  const bloqueiosPorDia = new Map<string, { diaTodo: boolean }>();
  for (const b of bloqueiosDoMes) {
    const chave = isoDeData(b.data);
    const atual = bloqueiosPorDia.get(chave);
    if (!atual || !atual.diaTodo) bloqueiosPorDia.set(chave, { diaTodo: !b.horaInicio || Boolean(atual?.diaTodo) });
  }
  const diasDaSemanaComJanela = new Set(janelas.map((j) => j.diaSemana));

  return (
    <>
      <Titulo>Disponibilidade</Titulo>

      <Cartao className="mb-3">
        <div className="font-display font-bold text-bordo text-sm mb-1">Minha semana</div>
        <div className="text-[11px] text-gray-500 mb-3">
          Os próximos 7 dias — o padrão de baixo cruzado com suas ausências específicas.
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {semana.map(({ dia, janelasDoDia, diaTodoBloqueado }) => {
            const chave = isoDeData(dia);
            return (
              <Link
                key={chave}
                href={`/profissional/disponibilidade?ausenciaData=${chave}#ausencia`}
                className={`rounded-xl border p-2.5 text-[11px] hover:border-bordo/40 transition-colors ${
                  diaTodoBloqueado
                    ? "border-red-200 bg-red-50"
                    : janelasDoDia.length === 0
                      ? "border-gray-100 bg-gray-50"
                      : "border-gray-200 bg-white"
                }`}
              >
                <div className="font-semibold text-bordo">{formatarDiaEData(dia)}</div>
                {diaTodoBloqueado ? (
                  <div className="text-red-600 font-semibold mt-1">Ausente</div>
                ) : janelasDoDia.length === 0 ? (
                  <div className="text-gray-400 mt-1">Não declarado</div>
                ) : (
                  <div className="text-gray-600 mt-1 space-y-0.5">
                    <div className="text-emerald-700 font-semibold">Disponível</div>
                    {janelasDoDia.map((j) => (
                      <div key={j.id}>{rotuloDaJanela(j.horaInicio, j.horaFim)}</div>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
        <div className="text-[10px] text-gray-400 mt-2">
          Clique num dia para marcar ausência nele. A central só oferece você em horários dentro
          das janelas do padrão semanal.
        </div>
      </Cartao>

      <Cartao className="mb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <div className="font-display font-bold text-bordo text-sm">Agenda do mês</div>
          <div className="flex items-center gap-2 text-xs">
            <Link
              href={`/profissional/disponibilidade?mes=${mesVizinho(mes, -1)}`}
              className="px-2 py-1.5 min-h-[36px] sm:min-h-0 inline-flex items-center text-gray-500"
            >
              ‹
            </Link>
            <span className="font-semibold text-bordo">{competenciaPorExtenso(mes)}</span>
            <Link
              href={`/profissional/disponibilidade?mes=${mesVizinho(mes, 1)}`}
              className="px-2 py-1.5 min-h-[36px] sm:min-h-0 inline-flex items-center text-gray-500"
            >
              ›
            </Link>
          </div>
        </div>
        <div className="text-[11px] text-gray-500 mb-3">
          Verde é disponível (janela no padrão semanal), vermelho é ausente e cinza é não declarado.
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400 mb-1">
          {DIAS.map((d) => (
            <div key={d}>{d.slice(0, 3)}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {gradeDoMes(mes).map((dia, indice) => {
            if (!dia) return <div key={indice} />;
            const chave = isoDeData(dia);
            const ausente = bloqueiosPorDia.get(chave)?.diaTodo ?? false;
            const temJanela = diasDaSemanaComJanela.has(dia.getUTCDay());
            return (
              <div
                key={chave}
                title={ausente ? "Ausente" : temJanela ? "Disponível" : "Não declarado"}
                className={`aspect-square rounded-lg flex items-center justify-center text-[11px] font-semibold ${
                  ausente
                    ? "bg-red-100 text-red-700"
                    : temJanela
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-50 text-gray-400"
                }`}
              >
                {dia.getUTCDate()}
              </div>
            );
          })}
        </div>
      </Cartao>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-1">Padrão semanal</div>
          <div className="text-[11px] text-gray-500 mb-3">
            A central só oferece você em horários dentro dessas janelas, toda semana.
          </div>

          {janelas.length === 0 ? (
            <Vazio>Nenhuma janela declarada — você não aparece para a central alocar.</Vazio>
          ) : (
            <div className="space-y-1 mb-4">
              {janelas.map((janela) => (
                <div key={janela.id} className="flex items-center justify-between gap-2 text-xs border-b border-gray-100 pb-1.5 last:border-0">
                  <span>
                    <strong className="text-bordo">{DIAS[janela.diaSemana]}</strong> ·{" "}
                    {rotuloDaJanela(janela.horaInicio, janela.horaFim)}
                  </span>
                  <BotaoAcao acao={removerDisponibilidade.bind(null, janela.id)} variante="perigo">
                    Remover
                  </BotaoAcao>
                </div>
              ))}
            </div>
          )}

          <FormularioAcao acao={adicionarDisponibilidade} botao="Adicionar disponibilidade">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Rotulo>Dia</Rotulo>
                <Selecao name="diaSemana" defaultValue="1">
                  {DIAS.map((dia, indice) => (
                    <option key={dia} value={indice}>
                      {dia}
                    </option>
                  ))}
                </Selecao>
              </div>
              <div>
                <Rotulo>Turno</Rotulo>
                <Selecao name="turno" defaultValue="MANHA">
                  {TURNOS.map((turno) => (
                    <option key={turno.chave} value={turno.chave}>
                      {turno.rotulo} ({turno.horaInicio}–{turno.horaFim})
                    </option>
                  ))}
                </Selecao>
              </div>
            </div>
            <div className="text-[10px] text-gray-400">
              O dia inteiro vale o horário de funcionamento da operação. A manhã é onde a central
              mais precisa de gente.
            </div>
          </FormularioAcao>
        </Cartao>

        <Cartao id="ausencia">
          <div className="font-display font-bold text-bordo text-sm mb-1">Ausências</div>
          <div className="text-[11px] text-gray-500 mb-3">
            Vence a janela da semana num dia específico, ou num período inteiro — férias, viagem,
            mestrado. Não cancela atendimento já alocado; para isso, avise a central.
          </div>

          {ausencias.length === 0 ? (
            <Vazio>Nenhuma ausência marcada.</Vazio>
          ) : (
            <div className="space-y-1 mb-4">
              {ausencias.map((ausencia) => (
                <div key={ausencia.id} className="flex items-center justify-between gap-2 text-xs border-b border-gray-100 pb-1.5 last:border-0">
                  <span>
                    <strong className="text-bordo">{formatarData(ausencia.data)}</strong>{" "}
                    {ausencia.horaInicio ? `· ${ausencia.horaInicio}–${ausencia.horaFim}` : "· dia inteiro"}
                    {ausencia.motivo ? ` · ${ausencia.motivo}` : ""}
                  </span>
                  <BotaoAcao acao={removerAusencia.bind(null, ausencia.id)} variante="perigo">
                    Remover
                  </BotaoAcao>
                </div>
              ))}
            </div>
          )}

          <FormularioAcao acao={marcarAusencia} botao="Marcar ausência">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Rotulo>De</Rotulo>
                <Campo name="data" type="date" defaultValue={searchParams.ausenciaData ?? ""} required />
              </div>
              <div>
                <Rotulo>Até (opcional — período)</Rotulo>
                <Campo name="dataFim" type="date" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Rotulo>Das (opcional)</Rotulo>
                <Campo name="horaInicio" type="time" />
              </div>
              <div>
                <Rotulo>Às (opcional)</Rotulo>
                <Campo name="horaFim" type="time" />
              </div>
            </div>
            <div>
              <Rotulo>Motivo (opcional)</Rotulo>
              <Campo name="motivo" placeholder="Férias, viagem, mestrado…" />
            </div>
            <div className="text-[10px] text-gray-400">
              Sem &quot;Até&quot;, só o dia &quot;De&quot; é bloqueado — com horário, se preencher.
              Com &quot;Até&quot;, o período inteiro fica bloqueado (dia inteiro, sem horário).
            </div>
          </FormularioAcao>
        </Cartao>

        {/* A conexão com a agenda do Google mudou para Meus dados (ata de 20/10). */}
        <Cartao className="lg:col-span-2">
          <div className="text-[11px] text-gray-500">
            {eu?.googleAgendaId ? (
              <>Seus atendimentos vão para a agenda do Google <strong>{eu.googleAgendaId}</strong>. </>
            ) : (
              <>Quer seus atendimentos na agenda do celular? </>
            )}
            <Link href="/profissional/meus-dados" className="font-semibold text-bordo hover:underline">
              Configurar em Meus dados →
            </Link>
          </div>
        </Cartao>
      </div>
    </>
  );
}
