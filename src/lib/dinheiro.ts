/**
 * Dinheiro circula como CENTAVOS INTEIROS em todo o sistema. Estas funções são
 * a única fronteira onde ele vira (e volta de) texto.
 *
 * Motivo prático: o repasse é percentual sobre o valor do serviço, e o mês
 * fecha somando centenas dessas contas. Em ponto flutuante o resto de centavo
 * se acumula e a soma dos repasses não bate com o relatório que o profissional
 * conferiu — discussão de R$ 0,03 que custa uma tarde.
 */

const REAIS = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarReais(centavos: number): string {
  return REAIS.format((centavos ?? 0) / 100);
}

/** Versão compacta para os cartões do painel: R$ 12,3 mil. */
export function formatarReaisCurto(centavos: number): string {
  const reais = (centavos ?? 0) / 100;
  const abs = Math.abs(reais);
  if (abs >= 1_000_000) return `R$ ${(reais / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 10_000) return `R$ ${(reais / 1000).toFixed(1).replace(".", ",")} mil`;
  return REAIS.format(reais);
}

/**
 * Lê o que a pessoa digitou e devolve centavos.
 *
 * Aceita "1.234,56", "1234.56", "1234,5" e "R$ 1.234,56" porque quem faz
 * lançamento o dia inteiro digita de todo jeito, e recusar o formato é
 * transformar digitação em erro de validação.
 *
 * A regra do separador: se tem vírgula, ela é o decimal e o ponto é milhar
 * (padrão brasileiro). Sem vírgula, o ponto é decimal — "1234.56" vindo de
 * cópia de planilha.
 */
export function lerCentavos(texto: string | number | null | undefined): number {
  if (typeof texto === "number") return Math.round(texto * 100);
  if (!texto) return 0;

  const limpo = String(texto).replace(/[^\d,.-]/g, "");
  if (!limpo) return 0;

  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

/** Percentual pronto para tela: 62.5 → "62,5%". */
export function formatarPercent(valor: number, casas = 1): string {
  if (!Number.isFinite(valor)) return "—";
  return `${valor.toFixed(casas).replace(".", ",")}%`;
}

/**
 * Aplica um percentual sobre centavos, arredondando meio centavo para cima.
 * Centralizado aqui para que repasse, imposto e desconto arredondem igual —
 * duas regras de arredondamento diferentes no mesmo sistema é como a soma da
 * tela deixa de bater com a soma da exportação.
 */
export function aplicarPercent(centavos: number, percent: number): number {
  return Math.round((centavos * percent) / 100);
}
