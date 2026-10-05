/**
 * O cadastro do cliente está completo para agendar? (ata de 02/10)
 *
 * Exige CNPJ (ou CPF), telefone e e-mail: sem eles a central não consegue
 * emitir a cobrança nem ligar de volta. O autocadastro já exige os três; o
 * cadastro manual feito pela equipe pode chegar incompleto, e é para esse caso
 * que o agendamento fica bloqueado até a equipe completar.
 */
export function camposFaltando(clinica: {
  cnpj?: string | null;
  telefone?: string | null;
  email?: string | null;
}): string[] {
  const faltando: string[] = [];
  if (!clinica.cnpj?.replace(/\D/g, "")) faltando.push("CNPJ ou CPF");
  if (!clinica.telefone?.replace(/\D/g, "")) faltando.push("telefone");
  if (!clinica.email?.trim()) faltando.push("e-mail");
  return faltando;
}

export function cadastroCompleto(clinica: Parameters<typeof camposFaltando>[0]): boolean {
  return camposFaltando(clinica).length === 0;
}
