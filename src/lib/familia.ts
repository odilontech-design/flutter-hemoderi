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
/**
 * As categorias do catálogo oficial, NA ORDEM do sumário (página 2 do
 * catálogo 2026): os serviços clínicos são as categorias principais, e cada
 * procedimento é uma subcategoria. A ordem do sumário é a ordem da vitrine —
 * é como a Hemoderi apresenta o que vende.
 */
export const CATEGORIAS_DO_CATALOGO = [
  "AirFlow GBT Machine",
  "LiteTouch™",
  "Rotamix Sedação Consciente",
  "Piezosurgery Mectron Touch",
  "Cobertura Fotográfica",
  "Ultrassom Micro Focado",
  "Megaderme – Radiofrequência Microagulhada",
  "Platinum Platform",
  "Laser Therapy EC",
  "Bisturi Elétrico",
  "Motor de Implante",
  "PRF – Coleta e Produção",
] as const;

const [AIRFLOW, LITETOUCH, SEDACAO, PIEZO, FOTO, ULTRASSOM, MEGADERME, PLATINUM, LASER_THERAPY, BISTURI, IMPLANTE, PRF] =
  CATEGORIAS_DO_CATALOGO;

/**
 * Ordem importa: "Piezosurgery + Stickybone + Membranas" casa com Piezo e com
 * PRF, e a primeira regra que bate decide. Piezo vem antes porque é o
 * equipamento que define o procedimento; o PRF ali é insumo.
 */
const REGRAS: { familia: string; padrao: RegExp }[] = [
  { familia: PIEZO, padrao: /piezo/i },
  { familia: PRF, padrao: /\bi?-?prf\b|stickybone|membranas/i },
  // Cada laser é uma categoria própria (ata de 01/10): LiteTouch, Platinum e
  // Laser Therapy têm finalidade clínica diferente e agrupá-los sob "Laser"
  // escondia justamente a escolha que o cliente precisa fazer.
  { familia: LITETOUCH, padrao: /lite ?touch|light ?touch/i },
  { familia: LASER_THERAPY, padrao: /laser ?therapy|ilib/i },
  { familia: "Laser", padrao: /laser/i },
  { familia: ULTRASSOM, padrao: /ultrassom|atria/i },
  { familia: MEGADERME, padrao: /radiofrequ|megaderme/i },
  { familia: AIRFLOW, padrao: /airflow|gbt/i },
  { familia: PLATINUM, padrao: /platinum/i },
  { familia: IMPLANTE, padrao: /implante/i },
  { familia: BISTURI, padrao: /bisturi/i },
  { familia: SEDACAO, padrao: /seda[çc]/i },
  { familia: FOTO, padrao: /fotogr/i },
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
 *
 * `ordemDoCatalogo` troca "mais opções primeiro" pela ordem do sumário do
 * catálogo — é a ordem que o portal usa; a vitrine pública, que premia o que
 * mais vende, continua pelo tamanho.
 */
export function agruparPorFamilia<T extends { nome: string; familia?: string | null }>(
  servicos: T[],
  {
    fundirSolitarias = true,
    ordemDoCatalogo = false,
  }: { fundirSolitarias?: boolean; ordemDoCatalogo?: boolean } = {}
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
      if (ordemDoCatalogo) {
        const ia = (CATEGORIAS_DO_CATALOGO as readonly string[]).indexOf(a.familia);
        const ib = (CATEGORIAS_DO_CATALOGO as readonly string[]).indexOf(b.familia);
        // Categoria fora do sumário (cadastrada à mão) vem depois das oficiais.
        if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      }
      // Família com mais opções primeiro: é a que a operação mais vende, e a
      // vitrine deve abrir pelo que mais sai.
      if (a.servicos.length !== b.servicos.length) return b.servicos.length - a.servicos.length;
      return a.familia.localeCompare(b.familia, "pt-BR");
    });
}
