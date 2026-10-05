/**
 * O profissional está apto a prestar este serviço? (ata de 02/10)
 *
 * Quem tem serviços definidos só aparece para eles. Quem NÃO tem nenhum ainda
 * não foi configurado — é o cadastro legado — e continua apto a tudo: tirar de
 * todas as listas o profissional que ninguém classificou ainda pararia a
 * alocação no dia do deploy.
 */
export function aptoParaServico(servicosAptosIds: string[], servicoId: string): boolean {
  return servicosAptosIds.length === 0 || servicosAptosIds.includes(servicoId);
}
