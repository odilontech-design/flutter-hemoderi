/**
 * Regras puras da pesquisa de NPS. Sem banco, para os testes cobrirem.
 *
 * Decisão da reunião de 14/09: a cada 60 dias, para a clínica que NÃO teve
 * múltiplos atendimentos no período. Ao contrário de um NPS comum — que
 * ouviria primeiro quem mais usa —, este mira o oposto de propósito: quem
 * está esfriando é quem tem alguma coisa a dizer que a taxa de uso ainda não
 * denunciou sozinha. A clínica que atende toda semana já mostra satisfação
 * pelo próprio volume.
 */

export const JANELA_NPS_DIAS = 60;

/** 2 ou mais atendimentos no período conta como "múltiplos" — fica de fora. */
export const LIMITE_ATENDIMENTOS_MULTIPLOS = 2;

export const NOTA_NPS_MINIMA = 0;
export const NOTA_NPS_MAXIMA = 10;

/** Limite de cada campo de texto livre — a mesma cautela do comentário da estrela. */
export const LIMITE_TEXTO_NPS = 1000;

export function elegivelParaNps(atendimentosNoPeriodo: number): boolean {
  return atendimentosNoPeriodo < LIMITE_ATENDIMENTOS_MULTIPLOS;
}

export function notaNpsValida(valor: unknown): valor is number {
  // A escala começa em 0 — diferente da de estrelas (mínimo 1) —, então
  // `Number("")` e `Number(null)` caindo em 0 não podem passar como resposta
  // válida: ausência é "não respondeu", não "deu nota zero". Precisa barrar
  // esses dois casos antes de converter, e não só checar o número resultante.
  if (valor === null || valor === undefined) return false;
  if (typeof valor === "string" && valor.trim() === "") return false;
  const n = Number(valor);
  return Number.isInteger(n) && n >= NOTA_NPS_MINIMA && n <= NOTA_NPS_MAXIMA;
}

/**
 * Classificação clássica do NPS: 0-6 detrator, 7-8 neutro, 9-10 promotor.
 * Sem isso a nota é só um número — é a faixa que diz o que fazer com ela.
 */
export type FaixaNps = "DETRATOR" | "NEUTRO" | "PROMOTOR";

export function faixaDaNota(nota: number): FaixaNps {
  if (nota >= 9) return "PROMOTOR";
  if (nota >= 7) return "NEUTRO";
  return "DETRATOR";
}

export const ROTULO_FAIXA_NPS: Record<FaixaNps, string> = {
  PROMOTOR: "Promotor",
  NEUTRO: "Neutro",
  DETRATOR: "Detrator",
};

/**
 * Score de NPS clássico: % promotores − % detratores, de -100 a 100.
 * Devolve null para lista vazia — "sem resposta" e "score zero" (metade
 * promotor, metade detrator) são leituras opostas da operação.
 */
export function scoreNps(notas: number[]): number | null {
  if (notas.length === 0) return null;
  const promotores = notas.filter((n) => faixaDaNota(n) === "PROMOTOR").length;
  const detratores = notas.filter((n) => faixaDaNota(n) === "DETRATOR").length;
  return Math.round(((promotores - detratores) / notas.length) * 100);
}
