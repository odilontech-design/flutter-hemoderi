import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { Campo, Cartao, Rotulo, Titulo, Vazio } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { BotaoAcao } from "@/components/BotaoAcao";
import {
  adicionarDisponibilidade,
  limparDisponibilidade,
  marcarAusencia,
  removerAusencia,
  removerDisponibilidade,
  salvarDiaDoCalendario,
} from "@/app/actions/disponibilidade";
import {
  competenciaAtual,
  competenciaPorExtenso,
  dataDeISO,
  formatarData,
  formatarDataCurta,
  formatarDiaEData,
  gradeDoMes,
  hojeISO,
  hojeUTC,
  isoDeData,
  proximosDias,
} from "@/lib/data";
import { rotuloDaJanela, TURNOS } from "@/lib/turnos";
import { janelaValeNaData } from "@/lib/agenda";
import { turnosDisponiveis, TURNOS_DO_DIA } from "@/lib/disponibilidade-dia";

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
  searchParams: { ausenciaData?: string; mes?: string; dia?: string };
}) {
  const sessao = await exigirProfissional();
  const mes = searchParams.mes ?? competenciaAtual();
  const [anoMes, mesMes] = mes.split("-").map(Number);
  const inicioMes = new Date(Date.UTC(anoMes, mesMes - 1, 1));
  const fimMes = new Date(Date.UTC(anoMes, mesMes, 0));

  // O dia aberto para edição no calendário (pedido de 04/11). Só de hoje em diante.
  const diaEditado =
    searchParams.dia && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.dia) && dataDeISO(searchParams.dia) >= hojeUTC()
      ? dataDeISO(searchParams.dia)
      : null;

  const [janelas, ausencias, bloqueiosDoMes, eu] = await Promise.all([
    prisma.disponibilidade.findMany({
      // As de período já encerrado saem da tela: não valem mais para nada.
      where: { profissionalId: sessao.profissionalId, OR: [{ dataFim: null }, { dataFim: { gte: hojeUTC() } }] },
      orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }, { dataInicio: "asc" }],
    }),
    prisma.bloqueio.findMany({
      where: { profissionalId: sessao.profissionalId, data: { gte: new Date(Date.now() - 86400000) } },
      orderBy: { data: "asc" },
    }),
    prisma.bloqueio.findMany({
      where: { profissionalId: sessao.profissionalId, data: { gte: inicioMes, lte: fimMes } },
      select: { data: true, horaInicio: true, horaFim: true, motivo: true },
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
    // Uma janela de período igual a uma semanal aparece uma vez só.
    const janelasDoDia = janelas
      .filter((j) => janelaValeNaData(j, dia))
      .filter((j, i, lista) => lista.findIndex((o) => o.horaInicio === j.horaInicio && o.horaFim === j.horaFim) === i);
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
  const periodo = (j: { dataInicio: Date | null; dataFim: Date | null }) =>
    j.dataInicio && j.dataFim && j.dataInicio.getTime() === j.dataFim.getTime()
      ? `só em ${formatarDataCurta(j.dataInicio)}`
      : j.dataInicio && j.dataFim
      ? `de ${formatarDataCurta(j.dataInicio)} a ${formatarDataCurta(j.dataFim)}`
      : j.dataFim
        ? `até ${formatarDataCurta(j.dataFim)}`
        : j.dataInicio
          ? `a partir de ${formatarDataCurta(j.dataInicio)}`
          : "toda semana";

  return (
    <>
      <Titulo>Disponibilidade</Titulo>

      <Cartao className="mb-3">
        <div className="font-display font-bold text-bordo text-sm mb-1">Minha semana</div>
        <div className="text-[11px] text-gray-500 mb-3">
          Os próximos 7 dias — a disponibilidade de baixo cruzada com suas ausências.
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
          Clique num dia para marcar ausência nele. A central só oferece você nos horários da sua
          disponibilidade.
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
          Verde é disponível, vermelho é ausente e cinza é não declarado.
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
            const turnosDoDia = turnosDisponiveis(janelas, bloqueiosDoMes.filter((b) => isoDeData(b.data) === chave), dia);
            const ausente = (bloqueiosPorDia.get(chave)?.diaTodo ?? false) || (turnosDoDia.length === 0 && bloqueiosPorDia.has(chave));
            const temJanela = turnosDoDia.length > 0;
            const passado = dia < hojeUTC();
            const selecionado = diaEditado && isoDeData(diaEditado) === chave;
            const classe = `aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-semibold ${
              ausente
                ? "bg-red-100 text-red-700"
                : temJanela
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-gray-50 text-gray-400"
            } ${selecionado ? "ring-2 ring-bordo" : ""}`;
            const conteudo = (
              <>
                {dia.getUTCDate()}
                {temJanela && turnosDoDia.length < TURNOS_DO_DIA.length && (
                  <span className="text-[8px] font-normal leading-none mt-0.5">
                    {turnosDoDia.includes("MANHA") ? "manhã" : "tarde"}
                  </span>
                )}
              </>
            );
            const titulo = ausente ? "Ausente" : temJanela ? "Disponível" : "Não declarado";
            return passado ? (
              <div key={chave} title={titulo} className={`${classe} opacity-50`}>
                {conteudo}
              </div>
            ) : (
              <Link
                key={chave}
                href={`/profissional/disponibilidade?mes=${mes}&dia=${chave}#editar-dia`}
                scroll={false}
                title={`${titulo} — clique para editar`}
                className={`${classe} hover:ring-2 hover:ring-bordo/40`}
              >
                {conteudo}
              </Link>
            );
          })}
        </div>
        <div className="text-[10px] text-gray-400 mt-2">Clique num dia para editar a sua disponibilidade nele.</div>

        {diaEditado && (
          <div id="editar-dia" className="mt-4 rounded-xl border border-bordo/30 bg-bege/40 p-3">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <div className="font-display font-bold text-bordo text-sm">{formatarDiaEData(diaEditado)}</div>
              <Link href={`/profissional/disponibilidade?mes=${mes}`} scroll={false} className="text-[11px] text-gray-500">
                fechar
              </Link>
            </div>
            <FormularioAcao
              key={isoDeData(diaEditado)}
              acao={salvarDiaDoCalendario}
              botao="Salvar este dia"
              limparAoSalvar={false}
            >
              <input type="hidden" name="data" value={isoDeData(diaEditado)} />
              <div>
                <Rotulo>Disponível neste dia (desmarque tudo para ficar ausente)</Rotulo>
                <div className="flex flex-wrap gap-1.5">
                  {TURNOS_DO_DIA.map((turno) => (
                    <label
                      key={turno.chave}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-2 text-xs cursor-pointer has-[:checked]:bg-bordo has-[:checked]:text-white has-[:checked]:border-bordo"
                    >
                      <input
                        type="checkbox"
                        name="turno"
                        value={turno.chave}
                        defaultChecked={turnosDisponiveis(
                          janelas,
                          bloqueiosDoMes.filter((b) => isoDeData(b.data) === isoDeData(diaEditado)),
                          diaEditado
                        ).includes(turno.chave)}
                        className="sr-only"
                      />
                      {turno.rotulo} ({turno.horaInicio}–{turno.horaFim})
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Rotulo>Motivo, se não puder (opcional)</Rotulo>
                <Campo name="motivo" placeholder="Consulta médica, viagem…" />
              </div>
              <div className="text-[10px] text-gray-400">
                Vale só para este dia — o resto da sua disponibilidade não muda.
              </div>
            </FormularioAcao>
          </div>
        )}
      </Cartao>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-1">Minha disponibilidade</div>
          <div className="text-[11px] text-gray-500 mb-3">
            A central só oferece você nos dias, turnos e períodos marcados aqui.
          </div>

          {janelas.length === 0 ? (
            <Vazio>Nenhuma janela declarada — você não aparece para a central alocar.</Vazio>
          ) : (
            <div className="space-y-1 mb-4">
              {janelas.map((janela) => (
                <div key={janela.id} className="flex items-center justify-between gap-2 text-xs border-b border-gray-100 pb-1.5 last:border-0">
                  <span>
                    <strong className="text-bordo">{DIAS[janela.diaSemana]}</strong> ·{" "}
                    {rotuloDaJanela(janela.horaInicio, janela.horaFim)}{" "}
                    <span className="text-gray-500">· {periodo(janela)}</span>
                  </span>
                  <BotaoAcao acao={removerDisponibilidade.bind(null, janela.id)} variante="perigo">
                    Remover
                  </BotaoAcao>
                </div>
              ))}
            </div>
          )}

          <FormularioAcao acao={adicionarDisponibilidade} botao="Adicionar disponibilidade">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Rotulo>De</Rotulo>
                <Campo name="dataInicio" type="date" defaultValue={hojeISO()} />
              </div>
              <div>
                <Rotulo>Até (vazio = sem data para acabar)</Rotulo>
                <Campo name="dataFim" type="date" />
              </div>
            </div>
            <div>
              <Rotulo>Dias da semana (marque quantos quiser)</Rotulo>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 0].map((indice) => (
                  <label
                    key={indice}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-2 text-xs cursor-pointer has-[:checked]:bg-bordo has-[:checked]:text-white has-[:checked]:border-bordo"
                  >
                    <input type="checkbox" name="diaSemana" value={indice} className="sr-only" />
                    {DIAS[indice].slice(0, 3)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Rotulo>Turnos</Rotulo>
              <div className="flex flex-wrap gap-1.5">
                {TURNOS.map((turno) => (
                  <label
                    key={turno.chave}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-2 text-xs cursor-pointer has-[:checked]:bg-bordo has-[:checked]:text-white has-[:checked]:border-bordo"
                  >
                    <input type="checkbox" name="turno" value={turno.chave} className="sr-only" />
                    {turno.rotulo} ({turno.horaInicio}–{turno.horaFim})
                  </label>
                ))}
              </div>
            </div>
            <div className="text-[10px] text-gray-400">
              Ex.: de 10/11 até 30/11, Seg a Sex, Manhã + Tarde — declara o período inteiro de uma
              vez. Sem a data &quot;Até&quot;, vale toda semana dali em diante. Para férias ou um dia
              fora, use Ausências.
            </div>
          </FormularioAcao>
          {janelas.length > 0 && (
            <div className="mt-3 text-right">
              <BotaoAcao acao={limparDisponibilidade} variante="perigo" confirmar="Apagar toda a sua disponibilidade declarada?">
                Apagar toda a disponibilidade
              </BotaoAcao>
            </div>
          )}
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
