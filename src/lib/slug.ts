export function gerarSlug(entrada: string): string {
  return entrada
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Telefone só com dígitos e DDI, como as APIs de WhatsApp exigem. */
export function normalizarTelefone(entrada: string | null | undefined): string {
  if (!entrada) return "";
  const digitos = String(entrada).replace(/\D/g, "");
  if (!digitos) return "";
  // Número brasileiro digitado sem DDI (10 ou 11 dígitos) recebe o 55.
  if (digitos.length <= 11) return `55${digitos}`;
  return digitos;
}
