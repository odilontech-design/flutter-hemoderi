import type { PapelUsuario, PerfilInterno } from "@prisma/client";

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

export const ROTULO_PERFIL_INTERNO: Record<PerfilInterno, string> = {
  ATENDENTE: "Atendente",
  RESPONSAVEL: "Responsável",
};

/**
 * NULL vira RESPONSAVEL — nunca ATENDENTE.
 *
 * O campo nasceu depois de já existirem contas internas em uso (a da própria
 * equipe, a do seed). Tratar ausência como o perfil mais restrito trancaria
 * gente que já trabalhava no sistema sem que ninguém tivesse mexido em nada;
 * tratar como o mais amplo é o lado seguro de um campo novo — a exceção fica
 * documentada aqui, num só lugar, em vez de um `?? "RESPONSAVEL"` espalhado
 * pelas guardas e pelas telas.
 */
export function perfilEfetivo(perfilInterno: PerfilInterno | null): PerfilInterno {
  return perfilInterno ?? "RESPONSAVEL";
}
