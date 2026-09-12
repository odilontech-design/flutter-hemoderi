import type { PapelUsuario } from "@prisma/client";

/**
 * Cada papel tem uma casa só, e o caminho é o que separa os três escopos
 * previstos no contrato. Manter a fronteira no prefixo da URL deixa o
 * middleware simples e auditável: /painel é da equipe, /portal é da clínica,
 * /profissional é do prestador.
 */
export const INICIO_POR_PAPEL: Record<PapelUsuario, string> = {
  INTERNO: "/painel",
  CLINICA: "/portal",
  PROFISSIONAL: "/profissional",
};

export const ROTULO_PAPEL: Record<PapelUsuario, string> = {
  INTERNO: "Equipe Hemoderi",
  CLINICA: "Clínica contratante",
  PROFISSIONAL: "Profissional",
};

export function inicioDe(papel: PapelUsuario): string {
  return INICIO_POR_PAPEL[papel] ?? "/login";
}
