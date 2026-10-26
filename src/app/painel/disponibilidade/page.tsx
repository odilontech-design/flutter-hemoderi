import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirInterno } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { perfilPermite } from "@/lib/papeis";
import { Cartao, Tabela, Titulo, Vazio } from "@/components/ui";
import { hojeUTC, isoDeData, somarDias } from "@/lib/data";
import { disponibilidadeDaEquipe, TURNOS_GRADE, type EstadoTurno } from "@/lib/disponibilidade-equipe";

export const dynamic = "force-dynamic";

const DIAS_NA_GRADE = 7;

/** Filtros da tela (reunião de 27/10: "melhorar a visibilidade"). */
const FILTROS = [
  { valor: "", rotulo: "Todos" },
  { valor: "livres", rotulo: "Com turno livre" },
  { valor: "declarados", rotulo: "Que declararam" },
  { valor: "sem-declaracao", rotulo: "Que nunca declararam" },
];

const ROTULO_ESTADO: Record<EstadoTurno, string> = {
  livre: "Livre",
  ocupado: "Ocupado",
  ausente: "Ausente",
  "sem-declaracao": "Não declarou",
};

/** Cor da marca de cada turno — a mesma leitura de semáforo que a equipe já
 *  usa na esteira: verde livre, âmbar tem coisa, vermelho não vai. */
const COR_ESTADO: Record<EstadoTurno, string> = {
  livre: "bg-green-100 text-green-800",
  ocupado: "bg-amber-100 text-amber-800",
  ausente: "bg-red-100 text-red-700",
  "sem-declaracao": "bg-gray-100 text-gray-400",
};

function cabecalhoDoDia(iso: string): { dia: string; data: string } {
  // iso é yyyy-mm-dd em UTC (o dia já vem truncado de proximosDias).
  const d = new Date(`${iso}T00:00:00Z`);
  const dia = d.toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "short" }).replace(".", "");
  const data = d.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
  return { dia: dia.charAt(0).toUpperCase() + dia.slice(1), data };
}

/**
 * A grade de disponibilidade da equipe — a tela da logística (ata de 28/09).
 *
 * Fica no acesso da logística: é a Joyce que aloca, e é para ela ver quem
 * pode atender em cada dia sem abrir sessenta agendas. RESPONSAVEL também
 * alcança (responde pela operação inteira); os outros perfis não, porque não
 * alocam — a tela seria ruído no dia a dia deles.
 */
export default async function DisponibilidadeDaEquipe({
  searchParams,
}: {
  searchParams: { semana?: string; q?: string; filtro?: string };
}) {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "LOGISTICA")) redirect("/painel");

  // Semana navegável: 0 = a partir de hoje, 1 = a seguinte… (até 8 à frente).
  const semana = Math.min(Math.max(Math.trunc(Number(searchParams.semana)) || 0, 0), 8);
  const primeiro = somarDias(hojeUTC(), semana * DIAS_NA_GRADE);
  const dias = Array.from({ length: DIAS_NA_GRADE }, (_, i) => somarDias(primeiro, i));
  const [todos, ausencias] = await Promise.all([
    disponibilidadeDaEquipe(dias),
    // O que cada profissional declarou como indisponível (reunião de 27/10):
    // dia, horário e motivo, para a logística não precisar perguntar.
    prisma.bloqueio.findMany({
      where: { data: { gte: dias[0], lte: dias[dias.length - 1] }, profissional: { ativo: true } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      select: {
        profissionalId: true,
        data: true,
        horaInicio: true,
        horaFim: true,
        motivo: true,
        profissional: { select: { nome: true } },
      },
    }),
  ]);
  const horarioDaAusencia = (a: { horaInicio: string | null; horaFim: string | null }) =>
    a.horaInicio && a.horaFim ? `${a.horaInicio}–${a.horaFim}` : "dia inteiro";
  const ausenciasDoDia = new Map<string, typeof ausencias>();
  for (const a of ausencias) {
    const chave = `${a.profissionalId}|${isoDeData(a.data)}`;
    ausenciasDoDia.set(chave, [...(ausenciasDoDia.get(chave) ?? []), a]);
  }
  const colunas = dias.map((d) => isoDeData(d));

  const busca = (searchParams.q ?? "").trim().toLowerCase();
  const filtro = FILTROS.some((f) => f.valor === searchParams.filtro) ? (searchParams.filtro as string) : "";
  const temLivre = (l: (typeof todos)[number]) => l.dias.some((d) => d.turnos.some((t) => t.estado === "livre"));
  const declarou = (l: (typeof todos)[number]) => l.dias.some((d) => d.turnos.some((t) => t.estado !== "sem-declaracao"));
  const equipe = todos
    .filter((l) => !busca || l.nome.toLowerCase().includes(busca))
    .filter((l) =>
      filtro === "livres" ? temLivre(l) : filtro === "declarados" ? declarou(l) : filtro === "sem-declaracao" ? !declarou(l) : true
    )
    // Quem declarou vem antes: é com quem a logística conta.
    .sort((a, b) => Number(declarou(b)) - Number(declarou(a)) || a.nome.localeCompare(b.nome, "pt-BR"));

  // Quantos livres em cada dia e turno — o resumo que responde "dá para
  // alocar terça à tarde?" sem ler a grade inteira.
  const livresPorDia = colunas.map((iso) =>
    TURNOS_GRADE.map((t) => ({
      turno: t.rotulo,
      livres: todos.filter((l) => l.dias.find((d) => d.iso === iso)?.turnos.find((x) => x.turno === t.chave)?.estado === "livre")
        .length,
    }))
  );
  const nuncaDeclararam = todos.filter((l) => !declarou(l)).length;
  const url = (troca: Record<string, string | number>) => {
    const p = new URLSearchParams();
    const final = { semana, q: searchParams.q ?? "", filtro, ...troca };
    if (Number(final.semana)) p.set("semana", String(final.semana));
    if (final.q) p.set("q", String(final.q));
    if (final.filtro) p.set("filtro", String(final.filtro));
    const consulta = p.toString();
    return consulta ? `/painel/disponibilidade?${consulta}` : "/painel/disponibilidade";
  };

  return (
    <>
      <Titulo
        acao={
          <div className="flex items-center gap-1 text-xs">
            {semana > 0 && (
              <Link href={url({ semana: semana - 1 })} className="px-3 py-2 text-gray-500">
                ‹ semana anterior
              </Link>
            )}
            {semana > 0 && (
              <Link href={url({ semana: 0 })} className="px-3 py-2 font-semibold text-bordo">
                hoje
              </Link>
            )}
            {semana < 8 && (
              <Link href={url({ semana: semana + 1 })} className="px-3 py-2 text-gray-500">
                semana seguinte ›
              </Link>
            )}
          </div>
        }
      >
        Disponibilidade da equipe
      </Titulo>

      {/* Resumo por dia: quantos estão livres em cada turno. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
        {colunas.map((iso, i) => {
          const { dia, data } = cabecalhoDoDia(iso);
          return (
            <div key={iso} className="rounded-xl border border-gray-200 bg-white p-2">
              <div className="text-[11px] font-semibold text-bordo">
                {dia} {data}
              </div>
              {livresPorDia[i].map((t) => (
                <div key={t.turno} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500">{t.turno}</span>
                  <span className={`font-bold ${t.livres > 0 ? "text-green-700" : "text-gray-300"}`}>{t.livres} livre{t.livres === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <form className="flex flex-wrap items-center gap-2 mb-3" action="/painel/disponibilidade">
        {semana > 0 && <input type="hidden" name="semana" value={semana} />}
        {filtro && <input type="hidden" name="filtro" value={filtro} />}
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Buscar profissional"
          className="border border-gray-300 rounded-lg px-3 py-2 text-xs flex-1 min-w-[180px] max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <Link
              key={f.valor || "todos"}
              href={url({ filtro: f.valor })}
              className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-full border ${
                filtro === f.valor ? "bg-bordo text-white border-bordo" : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.rotulo}
            </Link>
          ))}
        </div>
      </form>

      {nuncaDeclararam > 0 && (
        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
          {nuncaDeclararam} de {todos.length} profissionais ainda não declararam disponibilidade nesta semana — peça para
          marcarem em &quot;Disponibilidade&quot; no app.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4 text-[11px] text-gray-500">
        {(Object.keys(ROTULO_ESTADO) as EstadoTurno[]).map((estado) => (
          <span key={estado} className="inline-flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded ${COR_ESTADO[estado]}`} />
            {ROTULO_ESTADO[estado]}
          </span>
        ))}
        <span className="text-gray-400">· M = manhã, T = tarde</span>
      </div>

      <Cartao>
        {equipe.length === 0 ? (
          <Vazio>{todos.length === 0 ? "Nenhum profissional ativo cadastrado." : "Ninguém com esse filtro."}</Vazio>
        ) : (
          <Tabela
            cabecalho={[
              "Profissional",
              ...colunas.map((iso) => {
                const { dia, data } = cabecalhoDoDia(iso);
                return `${dia} ${data}`;
              }),
            ]}
          >
            {equipe.map((linha) => (
              <tr key={linha.profissionalId} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-3 font-semibold text-bordo whitespace-nowrap">{linha.nome}</td>
                {linha.dias.map((dia) => (
                  <td key={dia.iso} className="py-2 pr-3">
                    <div className="flex gap-1">
                      {dia.turnos.map((t) => {
                        const inicial = TURNOS_GRADE.find((g) => g.chave === t.turno)?.rotulo.charAt(0) ?? "?";
                        const doDia = t.estado === "ausente" ? ausenciasDoDia.get(`${linha.profissionalId}|${dia.iso}`) ?? [] : [];
                        const detalheAusencia = doDia
                          .map((a) => `${horarioDaAusencia(a)}${a.motivo ? ` — ${a.motivo}` : ""}`)
                          .join("; ");
                        const titulo = `${ROTULO_ESTADO[t.estado]}${t.atendimentos > 0 ? ` · ${t.atendimentos} atendimento(s)` : ""}${detalheAusencia ? ` · ${detalheAusencia}` : ""}`;
                        return (
                          <span
                            key={t.turno}
                            title={titulo}
                            className={`inline-flex items-center justify-center min-w-[34px] h-7 rounded-md text-[11px] font-bold ${COR_ESTADO[t.estado]}`}
                          >
                            {inicial}
                            {t.estado === "ocupado" && t.atendimentos > 1 ? `·${t.atendimentos}` : ""}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      {/* A lista do que foi declarado como indisponível, por extenso. */}
      <Cartao className="mt-3">
        <div className="font-display font-bold text-bordo text-sm mb-2">Indisponibilidades declaradas</div>
        {ausencias.length === 0 ? (
          <Vazio>Ninguém declarou indisponibilidade nestes dias.</Vazio>
        ) : (
          <Tabela cabecalho={["Profissional", "Dia", "Horário", "Motivo"]}>
            {ausencias
              .filter((a) => !busca || a.profissional.nome.toLowerCase().includes(busca))
              .map((a, i) => {
                const { dia, data } = cabecalhoDoDia(isoDeData(a.data));
                return (
                  <tr key={`${a.profissionalId}-${i}`} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3 font-semibold text-bordo whitespace-nowrap">{a.profissional.nome}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {dia} {data}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{horarioDaAusencia(a)}</td>
                    <td className="py-2 pr-3 text-gray-600">{a.motivo || <span className="text-gray-300">não informado</span>}</td>
                  </tr>
                );
              })}
          </Tabela>
        )}
      </Cartao>

      <div className="text-[10px] text-gray-400 mt-3 leading-relaxed">
        {DIAS_NA_GRADE} dias a partir de {cabecalhoDoDia(colunas[0]).data}. Passe o mouse em cada turno para ver o detalhe. Cada profissional declara a própria disponibilidade e as
        ausências no portal dele; aqui a logística vê o conjunto. &quot;Ocupado&quot; não impede
        alocar outro horário no mesmo turno — o turno comporta mais de um atendimento.
      </div>
    </>
  );
}
