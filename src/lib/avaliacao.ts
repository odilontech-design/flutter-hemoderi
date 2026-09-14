/**
 * Regras puras da avaliação. Sem banco, para os testes cobrirem.
 */

export const NOTA_MINIMA = 1;
export const NOTA_MAXIMA = 5;
/** Comentário é campo de texto livre num portal aberto à clínica: tem teto. */
export const LIMITE_COMENTARIO = 1000;

/** O que cada estrela quer dizer, para a clínica não ter que adivinhar. */
export const ROTULO_NOTA: Record<number, string> = {
  1: "Ruim",
  2: "Abaixo do esperado",
  3: "Dentro do esperado",
  4: "Muito bom",
  5: "Excelente",
};

export function notaValida(valor: unknown): valor is number {
  const n = Number(valor);
  return Number.isInteger(n) && n >= NOTA_MINIMA && n <= NOTA_MAXIMA;
}

/**
 * Média das notas, com uma casa decimal.
 *
 * Devolve null para lista vazia em vez de 0: "nenhuma avaliação" e "média
 * zero" são coisas diferentes, e num sistema que a equipe usa para escolher
 * quem mandar na próxima vaga, confundir as duas injustiça quem acabou de
 * entrar.
 */
export function mediaDeNotas(notas: number[]): number | null {
  if (notas.length === 0) return null;
  const soma = notas.reduce((total, n) => total + n, 0);
  return Math.round((soma / notas.length) * 10) / 10;
}

/** "4,5" — vírgula decimal, como o resto do sistema. */
export function formatarMedia(media: number | null): string {
  return media === null ? "—" : media.toFixed(1).replace(".", ",");
}

/**
 * Estrelas cheias e vazias para leitura rápida numa tabela.
 *
 * Arredonda para a estrela mais próxima só na exibição — o número ao lado
 * continua sendo a média de verdade, então 4,4 e 4,6 mostram o mesmo desenho
 * mas não o mesmo valor.
 */
export function estrelas(media: number | null): string {
  if (media === null) return "";
  const cheias = Math.round(media);
  return "★".repeat(cheias) + "☆".repeat(NOTA_MAXIMA - cheias);
}
