/**
 * Conselhos de classe aceitos no cadastro (ata de 05/10): o número do conselho
 * (CRO, CRM, CRBM, COREN…) é a régua mínima de identificação do profissional —
 * o equivalente ao CPF/CNPJ. Obrigatório no cadastro, opcional no momento do
 * agendamento. A validade do número em si (consulta à API do conselho) fica
 * para depois; por enquanto o que se exige é que ele exista.
 */
export const CONSELHOS = ["CRO", "CRM", "CRBM", "COREN", "CREFITO", "CRF", "CRN", "Outro"] as const;

/** O conselho existe na lista? */
export function conselhoValido(valor: string): boolean {
  return (CONSELHOS as readonly string[]).includes(valor);
}

/**
 * O texto do registro, limpo, ou `null` se não vale. Aceita letras, números e
 * os separadores usuais ("SP-12345", "12.345"), de 3 a 20 caracteres.
 */
export function registroDeConselho(bruto: string): string | null {
  const texto = bruto.trim().toUpperCase();
  if (texto.length < 3 || texto.length > 20) return null;
  return /^[A-Z0-9][A-Z0-9 ./-]*$/.test(texto) && /\d/.test(texto) ? texto : null;
}
