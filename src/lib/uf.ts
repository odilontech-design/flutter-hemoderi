/**
 * As unidades federativas, para os campos que escolhem estado.
 *
 * Mora em arquivo próprio e não num `"use server"` pelo mesmo motivo de
 * lib/pagamento.ts: constante exportada de módulo de server action chega ao
 * navegador como referência de função, e a tela quebra com "map is not a
 * function" depois de compilar sem um aviso.
 */
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;

export type Uf = (typeof UFS)[number];

export function ufValida(valor: string): valor is Uf {
  return (UFS as readonly string[]).includes(valor.trim().toUpperCase());
}

/** Lê "SP, RJ, mg" e devolve ["SP","RJ","MG"] — sem repetidos e sem inválidas. */
export function lerUfs(texto: string): Uf[] {
  const vistas = new Set<string>();
  for (const parte of (texto ?? "").split(/[,;\s]+/)) {
    const sigla = parte.trim().toUpperCase();
    if (ufValida(sigla)) vistas.add(sigla);
  }
  return [...vistas] as Uf[];
}
