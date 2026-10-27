/**
 * Em que pé está o acesso de um profissional ao portal (ata de 27/10: relatório
 * de quem ainda não ativou). "Ativo" é quem já trocou a senha provisória — a
 * primeira entrada de verdade.
 */
export type SituacaoDoAcesso = "ativo" | "nunca-entrou" | "sem-acesso" | "desativado";

export function situacaoDoAcesso(usuarios: { desativadoEm: Date | null; senhaProvisoria: boolean }[]): SituacaoDoAcesso {
  if (usuarios.length === 0) return "sem-acesso";
  const vigentes = usuarios.filter((u) => !u.desativadoEm);
  if (vigentes.length === 0) return "desativado";
  return vigentes.some((u) => !u.senhaProvisoria) ? "ativo" : "nunca-entrou";
}
