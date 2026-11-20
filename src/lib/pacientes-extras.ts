/**
 * Pacientes atendidos além do agendado (Joyce, 19/11). Regras puras: ler e
 * conferir a lista que vem do formulário e escrever as linhas do texto do
 * relatório.
 */

export type PacienteExtra = { nome: string; procedimento: string };

export const MAXIMO_DE_PACIENTES_EXTRAS = 10;

/**
 * Lê as listas paralelas do formulário (nome e procedimento de cada paciente).
 * Linha totalmente em branco é ignorada; linha pela metade é erro — quem
 * confere o relatório precisa saber QUEM foi atendido e O QUE foi feito.
 */
export function lerPacientesExtras(nomes: unknown[], procedimentos: unknown[]): { ok: true; lista: PacienteExtra[] } | { ok: false; erro: string } {
  const lista: PacienteExtra[] = [];
  const total = Math.max(nomes.length, procedimentos.length);
  for (let i = 0; i < total; i++) {
    const nome = String(nomes[i] ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
    const procedimento = String(procedimentos[i] ?? "").trim().replace(/\s+/g, " ").slice(0, 150);
    if (!nome && !procedimento) continue;
    if (!nome || !procedimento) {
      return { ok: false, erro: "Para cada paciente a mais, informe o nome e o procedimento realizado." };
    }
    lista.push({ nome, procedimento });
  }
  if (lista.length > MAXIMO_DE_PACIENTES_EXTRAS) {
    return { ok: false, erro: `No máximo ${MAXIMO_DE_PACIENTES_EXTRAS} pacientes a mais por relatório.` };
  }
  return { ok: true, lista };
}

/** Sem acento, minúsculo e sem espaços repetidos: para reconhecer o mesmo paciente digitado de dois jeitos. */
export function chaveDoPaciente(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** As linhas do texto do relatório (grupo e nota do PipeDrive). Vazio quando não houve paciente a mais. */
export function linhasDosPacientesExtras(lista: PacienteExtra[]): string[] {
  if (lista.length === 0) return [];
  return [`Pacientes adicionais (${lista.length}): ${lista.map((p) => `${p.nome} — ${p.procedimento}`).join("; ")}`];
}
