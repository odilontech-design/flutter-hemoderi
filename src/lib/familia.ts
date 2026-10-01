/**
 * A família comercial do procedimento — PRF, Piezo, Laser.
 *
 * É um agrupamento ORTOGONAL à categoria: "PRF" aparece em odontologia, em
 * estética e em saúde, e é assim que a Hemoderi fala dos serviços ("os PRF",
 * "os Piezo"). A categoria organiza o relatório; a família organiza a vitrine
 * de quem está escolhendo o que contratar.
 *
 * A família é inferida do nome como ponto de partida, e o cadastro pode
 * sobrescrever. Inferir evita que a vitrine nasça com dezoito itens soltos
 * esperando alguém classificar um por um — que é como ela não nasce.
 */

/**
 * Ordem importa: "Piezosurgery + Stickybone + Membranas" casa com Piezo e com
 * PRF, e a primeira regra que bate decide. Piezo vem antes porque é o
 * equipamento que define o procedimento; o PRF ali é insumo.
 */
const REGRAS: { familia: string; padrao: RegExp }[] = [
  { familia: "Piezosurgery", padrao: /piezo/i },
  { familia: "PRF", padrao: /\bi?-?prf\b|stickybone|membranas/i },
  // Cada laser é uma categoria própria (ata de 01/10): LiteTouch, Platinum e
  // Laser Therapy têm finalidade clínica diferente e agrupá-los sob "Laser"
  // escondia justamente a escolha que o cliente precisa fazer.
  { familia: "LiteTouch", padrao: /lite ?touch|light ?touch/i },
  { familia: "Laser Therapy EC", padrao: /laser ?therapy|ilib/i },
  { familia: "Laser", padrao: /laser/i },
  { familia: "Ultrassom Micro Focado", padrao: /ultrassom|atria/i },
  { familia: "Megaderme", padrao: /radiofrequ|megaderme/i },
  { familia: "AirFlow GBT Machine", padrao: /airflow|gbt/i },
  { familia: "Platinum", padrao: /platinum/i },
  { familia: "Motor de Implante", padrao: /implante/i },
  { familia: "Bisturi Elétrico", padrao: /bisturi/i },
  { familia: "Sedação Consciente", padrao: /seda[çc]/i },
  { familia: "Cobertura Fotográfica", padrao: /fotogr/i },
];

export const OUTROS = "Outros";

export function familiaDoNome(nome: string): string {
  return REGRAS.find((regra) => regra.padrao.test(nome ?? ""))?.familia ?? OUTROS;
}

/**
 * Agrupa serviços por família para a vitrine.
 *
 * Famílias de um item só são fundidas em "Outros": um cabeçalho para uma
 * linha é cabeçalho a mais, e com seis deles metade da página vira título em
 * vez de conteúdo. O nome do serviço já diz o que ele é — a família serve
 * para quem tem várias opções para comparar.
 *
 * A fusão não acontece quando NENHUMA família tem duas opções: aí tudo
 * viraria "Outros" e o agrupamento deixaria de existir.
 *
 * O portal logado desliga a fusão (`fundirSolitarias: false`): lá cada
 * equipamento é uma categoria, mesmo com um procedimento só — é a estrutura
 * do catálogo oficial da Hemoderi, e o cliente que procura "Platinum" não
 * pode achá-lo dentro de "Outros".
 */
export function agruparPorFamilia<T extends { nome: string; familia?: string | null }>(
  servicos: T[],
  { fundirSolitarias = true }: { fundirSolitarias?: boolean } = {}
): { familia: string; servicos: T[] }[] {
  const grupos = new Map<string, T[]>();

  for (const servico of servicos) {
    const familia = servico.familia?.trim() || familiaDoNome(servico.nome);
    const lista = grupos.get(familia);
    if (lista) lista.push(servico);
    else grupos.set(familia, [servico]);
  }

  const temFamiliaReal = [...grupos.entries()].some(
    ([familia, lista]) => familia !== OUTROS && lista.length > 1
  );

  if (fundirSolitarias && temFamiliaReal) {
    const solitarios: T[] = [];
    for (const [familia, lista] of [...grupos.entries()]) {
      if (familia !== OUTROS && lista.length === 1) {
        solitarios.push(...lista);
        grupos.delete(familia);
      }
    }
    if (solitarios.length > 0) {
      grupos.set(OUTROS, [...(grupos.get(OUTROS) ?? []), ...solitarios]);
    }
  }

  return [...grupos.entries()]
    .map(([familia, lista]) => ({
      familia,
      servicos: [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    }))
    .sort((a, b) => {
      if (a.familia === OUTROS) return 1;
      if (b.familia === OUTROS) return -1;
      // Família com mais opções primeiro: é a que a operação mais vende, e a
      // vitrine deve abrir pelo que mais sai.
      if (a.servicos.length !== b.servicos.length) return b.servicos.length - a.servicos.length;
      return a.familia.localeCompare(b.familia, "pt-BR");
    });
}
