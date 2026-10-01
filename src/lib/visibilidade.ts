/**
 * Quem pode ver (e pedir) cada serviço — ata de 01/10.
 *
 * Duas travas, e as duas valem para o catálogo e para o agendamento:
 *
 *   • LUGAR: o laser CO2 não é oferecido no Rio de Janeiro. Mostrar e deixar
 *     agendar vira cancelamento depois; esconder antes evita o conflito.
 *   • PERFIL: "PRF curso" é de quem tem perfil de curso. Serviço sem perfil
 *     cadastrado é de todos — a restrição é a exceção, não a regra.
 *
 * Cliente sem perfil (cadastro anterior à classificação) só enxerga o que não
 * é restrito: o legado não perde o catálogo que sempre teve, e também não
 * ganha de graça o que foi reservado a um perfil.
 */

import type { PerfilCliente } from "@prisma/client";

export type RestricaoDoServico = {
  perfis: PerfilCliente[];
  ufsIndisponiveis: string[];
};

export type Cliente = {
  perfis: PerfilCliente[];
  uf?: string | null;
};

export function servicoVisivel(servico: RestricaoDoServico, cliente: Cliente): boolean {
  const uf = (cliente.uf ?? "").trim().toUpperCase();
  if (uf && servico.ufsIndisponiveis.map((u) => u.toUpperCase()).includes(uf)) return false;

  if (servico.perfis.length === 0) return true;
  return servico.perfis.some((perfil) => cliente.perfis.includes(perfil));
}

export const ROTULO_PERFIL_CLIENTE: Record<PerfilCliente, string> = {
  ODONTOLOGIA: "Odontologia",
  MEDICINA: "Medicina",
  ESTETICA: "Estética",
  CURSO: "Curso",
  MANDIC: "Mandic",
  PARCEIRO: "Parceiro",
};

/** As únicas escolhas do autocadastro — curso e parcerias são atribuídos pela equipe. */
export const PERFIS_DO_AUTOCADASTRO: PerfilCliente[] = ["ODONTOLOGIA", "MEDICINA", "ESTETICA"];

export const TODOS_OS_PERFIS: PerfilCliente[] = [
  "ODONTOLOGIA",
  "MEDICINA",
  "ESTETICA",
  "CURSO",
  "MANDIC",
  "PARCEIRO",
];

export function lerPerfis(valores: FormDataEntryValue[]): PerfilCliente[] {
  return valores
    .map(String)
    .filter((v): v is PerfilCliente => (TODOS_OS_PERFIS as string[]).includes(v));
}
