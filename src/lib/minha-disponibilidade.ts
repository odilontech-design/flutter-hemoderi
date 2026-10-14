import { rotuloDaJanela } from "@/lib/turnos";

/**
 * A disponibilidade de um dia, do jeito que o profissional declarou (ata de
 * 13/10): três situações, e só três.
 *
 *   - AUSENTE: marcou ausência no dia inteiro. Vence o padrão semanal.
 *   - DISPONÍVEL: tem janela no padrão semanal para esse dia da semana (com a
 *     ressalva de uma ausência parcial, quando houver).
 *   - NÃO DECLARADO: nem janela nem ausência — não é "não pode", é "não
 *     disse". A logística trata caso a caso.
 *
 * É só a declaração do profissional: os agendamentos da Hemoderi ficam em
 * outra coluna, de propósito, para não se confundir o que ele disse com o
 * que a central marcou.
 */
export type EstadoDoDia = "disponivel" | "ausente" | "nao-declarado";

export const ROTULO_ESTADO_DO_DIA: Record<EstadoDoDia, string> = {
  disponivel: "Disponível",
  ausente: "Ausente",
  "nao-declarado": "Não declarado",
};

export type SituacaoDoDia = {
  estado: EstadoDoDia;
  /** "Manhã", "08:00 às 12:00"… — as janelas do padrão, quando disponível. */
  janelas: string[];
  /** Ausências de parte do dia ("14:00–16:00 · dentista"). */
  ausenciasParciais: string[];
};

export function situacaoDoDia(
  janelasDoDia: { horaInicio: string; horaFim: string }[],
  bloqueiosDoDia: { horaInicio: string | null; horaFim: string | null; motivo?: string | null }[]
): SituacaoDoDia {
  const diaTodo = bloqueiosDoDia.find((b) => !b.horaInicio);
  if (diaTodo) {
    return { estado: "ausente", janelas: [], ausenciasParciais: diaTodo.motivo ? [diaTodo.motivo] : [] };
  }
  const ausenciasParciais = bloqueiosDoDia.map(
    (b) => `${b.horaInicio}–${b.horaFim ?? "?"}${b.motivo ? ` · ${b.motivo}` : ""}`
  );
  if (janelasDoDia.length === 0) return { estado: "nao-declarado", janelas: [], ausenciasParciais };
  return {
    estado: "disponivel",
    janelas: janelasDoDia.map((j) => rotuloDaJanela(j.horaInicio, j.horaFim)),
    ausenciasParciais,
  };
}
