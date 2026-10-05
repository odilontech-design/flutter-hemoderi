/**
 * O procedimento que o doutor fará NO PACIENTE — campo obrigatório na última
 * etapa do agendamento (ata de 02/10), com lista suspensa e a opção "Outros".
 *
 * Não confundir com o serviço da Hemoderi: o serviço é o que a Hemoderi leva
 * (sedação, PRF, laser…); o procedimento é o que o doutor faz no consultório
 * (implante, enxerto…). Saber os dois é o que permite sugerir, depois, o
 * serviço certo para cada procedimento (a lógica de combos que o André pediu).
 *
 * A lista é provisória: o André vai enviar a lista oficial dos procedimentos
 * usados pela equipe, e ela substitui esta. Mora aqui, e não num arquivo
 * "use server", porque constante exportada de lá chega ao navegador como função.
 */
export const PROCEDIMENTOS_NO_PACIENTE = [
  "Implante dentário",
  "Enxerto ósseo",
  "Levantamento de seio maxilar",
  "Cirurgia periodontal",
  "Extração de siso / dentes inclusos",
  "Cirurgia guiada",
  "Reabilitação oral",
  "Lentes / facetas",
  "Clareamento",
  "Harmonização facial",
  "Estética facial",
  "Estética corporal",
  "Curso / treinamento",
] as const;

export const OUTRO_PROCEDIMENTO = "Outros";

/**
 * O texto a gravar, ou `null` se a escolha não vale. "Outros" exige o texto
 * digitado — "Outros" sozinho não diz nada para quem analisa depois.
 */
export function procedimentoEscolhido(escolha: string, outro: string): string | null {
  const opcao = escolha.trim();
  if (opcao === OUTRO_PROCEDIMENTO) {
    const texto = outro.trim().slice(0, 120);
    return texto ? `${OUTRO_PROCEDIMENTO}: ${texto}` : null;
  }
  return (PROCEDIMENTOS_NO_PACIENTE as readonly string[]).includes(opcao) ? opcao : null;
}
