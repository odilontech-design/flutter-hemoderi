/**
 * Telefone brasileiro nos formulários do portal (ata de 13/10): sem o código do
 * país (+55) e com DDD — 11 dígitos, DDD mais o número de celular. É o número
 * para onde a central liga e manda WhatsApp, e o que entra na integração com o
 * Dilon Zap; um "55" sobrando ou o DDD faltando são os erros que mais se viam.
 */

export const MENSAGEM_TELEFONE_INVALIDO =
  "Informe o telefone com DDD e sem o +55: 11 dígitos, como (11) 99999-9999.";

/** Só os 11 dígitos (DDD + número), ou `null` se não for um telefone válido. */
export function lerTelefoneBrasileiro(bruto: string | null | undefined): string | null {
  let d = String(bruto ?? "").replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 12 && d.startsWith("0")) d = d.slice(1);
  if (d.length !== 11) return null;
  // DDD brasileiro vai de 11 a 99 — "00" ou "05" é erro de digitação.
  if (Number(d.slice(0, 2)) < 11) return null;
  return d;
}

/** "11999990000" → "(11) 99999-0000"; enquanto digita, formata o que já tem. */
export function mascararTelefone(bruto: string): string {
  let d = bruto.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** O telefone já validado, no formato que os cadastros guardam. */
export function formatarTelefoneBrasileiro(digitos: string): string {
  return mascararTelefone(digitos);
}
