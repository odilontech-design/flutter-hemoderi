/**
 * Avisos em pop-up (ata de 28/09, ampliada em 02/10): "chegou trabalho" para
 * a equipe e para o profissional. Este arquivo é a parte pura, que roda no
 * navegador também — a que consulta o banco está em avisos-servidor.ts.
 *
 * Cada aviso tem uma `chave` (o tipo) e uma `marca`: o instante da novidade
 * mais recente daquele tipo. É a marca que distingue "chegou coisa nova" de
 * "continua o mesmo trabalho de antes" — um contador sozinho não serve, porque
 * a fila pode receber um pedido e perder outro no mesmo intervalo e o total
 * ficar igual enquanto algo novo espera.
 */

export type Aviso = {
  chave: string;
  titulo: string;
  texto: string;
  href: string;
  rotuloLink: string;
  /** ISO 8601 da novidade mais recente deste tipo. */
  marca: string;
};

/**
 * Mostra o aviso se a pessoa ainda não viu esta novidade. `visto` é a marca que
 * ela deu por lida (nula se nunca fechou nada). Compara texto ISO, que ordena
 * igual ao tempo.
 */
export function precisaAvisar(aviso: Pick<Aviso, "marca">, visto: string | null): boolean {
  return visto === null || aviso.marca > visto;
}

/** Singular/plural simples para as mensagens ("1 solicitação" / "3 solicitações"). */
export function contar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Um agendamento com vários serviços é UMA solicitação para quem triaja: conta
 * por grupo, não por pedido.
 */
export function contarAgendamentos(pedidos: { id: string; grupoId: string | null }[]): number {
  return new Set(pedidos.map((p) => p.grupoId ?? p.id)).size;
}
