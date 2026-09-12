import QRCode from "qrcode";

/**
 * Link e QR Code de divulgação da clínica (Módulo 02).
 *
 * O caminho curto `/c/<slug>` existe para caber embaixo de um QR Code
 * impresso no balcão e para ser ditado por telefone. Ele leva ao portal da
 * clínica; quem não estiver logado passa pelo login e cai direto na tela de
 * agendamento, sem ter que procurar o caminho de novo.
 */

export function urlBase(): string {
  const configurada = process.env.NEXTAUTH_URL;
  if (configurada) return configurada.replace(/\/$/, "");
  // Em preview da Vercel a URL muda a cada deploy; NEXTAUTH_URL é a fonte
  // correta em produção, esta é a rede de segurança.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3003";
}

export function urlDeDivulgacao(slug: string): string {
  return `${urlBase()}/c/${slug}`;
}

/**
 * QR Code como data URI PNG, gerado no servidor.
 *
 * Server-side de propósito: o QR entra em material impresso, e depender de
 * uma biblioteca no navegador significaria um QR que às vezes não aparece na
 * hora de imprimir.
 */
export async function qrCodeDataUri(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 512,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#9C3A32", light: "#FFFFFF" }, // bordô da marca — QR impresso já sai na cor certa
  });
}
