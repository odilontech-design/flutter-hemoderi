import { redirect } from "next/navigation";
import { exigirInterno } from "@/lib/sessao";
import { perfilPermite } from "@/lib/papeis";
import { Cartao, Tabela, Titulo, Vazio } from "@/components/ui";
import { proximosDias } from "@/lib/data";
import { disponibilidadeDaEquipe, TURNOS_GRADE, type EstadoTurno } from "@/lib/disponibilidade-equipe";

export const dynamic = "force-dynamic";

const DIAS_NA_GRADE = 7;

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
export default async function DisponibilidadeDaEquipe() {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "LOGISTICA")) redirect("/painel");

  const dias = proximosDias(DIAS_NA_GRADE);
  const equipe = await disponibilidadeDaEquipe(dias);
  const colunas = dias.map((d) => d.toISOString().slice(0, 10));

  return (
    <>
      <Titulo>Disponibilidade da equipe</Titulo>

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
          <Vazio>Nenhum profissional ativo cadastrado.</Vazio>
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
                        const titulo = `${ROTULO_ESTADO[t.estado]}${t.atendimentos > 0 ? ` · ${t.atendimentos} atendimento(s)` : ""}`;
                        return (
                          <span
                            key={t.turno}
                            title={titulo}
                            className={`inline-flex items-center justify-center min-w-[28px] h-6 rounded text-[10px] font-semibold ${COR_ESTADO[t.estado]}`}
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

      <div className="text-[10px] text-gray-400 mt-3 leading-relaxed">
        Próximos {DIAS_NA_GRADE} dias. Cada profissional declara a própria disponibilidade e as
        ausências no portal dele; aqui a logística vê o conjunto. &quot;Ocupado&quot; não impede
        alocar outro horário no mesmo turno — o turno comporta mais de um atendimento.
      </div>
    </>
  );
}
