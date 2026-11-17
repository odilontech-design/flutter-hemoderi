/**
 * Exclusão de conta dentro do app (exigência da Apple e do Google para apps
 * com login). O sistema não apaga a linha do usuário: ela está presa ao
 * histórico (pedidos, relatórios, repasses, faturas) que a lei manda guardar.
 * Em vez disso, a conta é ENCERRADA: perde o acesso, o nome, o e-mail, o
 * telefone e os aparelhos — a pessoa deixa de ser identificável pela conta.
 */

/** E-mail que não pertence a ninguém (domínio reservado .invalid) e não repete. */
export function emailAnonimizado(usuarioId: string): string {
  return `conta-excluida-${usuarioId}@excluido.invalid`;
}

export const NOME_DA_CONTA_EXCLUIDA = "Conta excluída";

/**
 * Quando a exclusão deve esperar. Devolve o motivo em texto ou null se pode
 * excluir. Os números vêm do banco, na ação.
 */
export function motivoParaNaoExcluir(d: {
  papel: string;
  /** Profissional: atendimentos alocados de hoje em diante. */
  atendimentosFuturosDoProfissional: number;
  /** Clínica: este é o único acesso ativo da clínica? */
  ehOUnicoAcessoDaClinica: boolean;
  /** Clínica: agendamentos ativos de hoje em diante. */
  agendamentosFuturosDaClinica: number;
}): string | null {
  if (d.papel === "PROFISSIONAL") {
    if (d.atendimentosFuturosDoProfissional > 0) {
      return `Você tem ${d.atendimentosFuturosDoProfissional} atendimento(s) alocado(s) daqui para frente. Fale com a central para remanejar antes de excluir a conta.`;
    }
    return null;
  }
  if (d.papel === "CLINICA") {
    if (d.ehOUnicoAcessoDaClinica && d.agendamentosFuturosDaClinica > 0) {
      return `Esta é a única conta da clínica e há ${d.agendamentosFuturosDaClinica} agendamento(s) daqui para frente. Cancele-os ou fale com a central antes de excluir.`;
    }
    return null;
  }
  return "A exclusão pelo app vale para clínicas e profissionais. Equipe interna: fale com o responsável.";
}
