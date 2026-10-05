/**
 * As especialidades do profissional, numa lista fechada (ata de 02/10).
 *
 * Campo aberto dava "Enfermagem — PRF", "enfermagem prf" e "Enf. PRF" para a
 * mesma coisa, e é impossível filtrar por isso. A lista é provisória: a equipe
 * ajusta conforme o que de fato usa. Valores antigos de cadastros existentes
 * continuam aparecendo no seletor até alguém escolher um da lista.
 */
export const ESPECIALIDADES = [
  "Enfermagem",
  "Enfermagem — PRF e coleta",
  "Biomedicina estética",
  "Cirurgia oral",
  "Implantodontia",
  "Periodontia",
  "Harmonização facial",
  "Sedação consciente",
  "Odontologia geral",
  "Medicina estética",
  "Outra",
] as const;

/** A lista a oferecer: a fixa, mais o valor legado do cadastro quando não consta nela. */
export function opcoesDeEspecialidade(atual: string | null | undefined): string[] {
  const lista: string[] = [...ESPECIALIDADES];
  if (atual && !lista.includes(atual)) lista.unshift(atual);
  return lista;
}
