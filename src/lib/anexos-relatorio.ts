/**
 * Anexos do relatório (reunião de 28/10): "botão para anexar arquivos no envio
 * do relatório". Fotos do atendimento e documentos, opcionais.
 *
 * Os limites vêm da plataforma, não do gosto: o corpo de uma requisição na
 * Vercel passa de ~4,5 MB só com erro, e o formulário do relatório já pode
 * levar o comprovante de recebimento (até 3 MB). Por isso o teto vale para o
 * conjunto do envio, e a foto é reduzida no navegador antes (reduzir-imagem).
 */

export const MAXIMO_DE_ANEXOS = 5;
export const LIMITE_POR_ANEXO_BYTES = 2 * 1024 * 1024;
/** Tudo o que vai junto no envio: anexos novos mais o comprovante novo. */
export const LIMITE_DO_ENVIO_BYTES = 3.6 * 1024 * 1024;
export const TIPOS_DE_ANEXO = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export function anexoAceito(arquivo: { type: string; size: number; name?: string }): string | null {
  const nome = arquivo.name ? ` "${arquivo.name}"` : "";
  if (!(TIPOS_DE_ANEXO as readonly string[]).includes(arquivo.type)) {
    return `O arquivo${nome} não é aceito: envie foto (JPG, PNG) ou PDF.`;
  }
  if (arquivo.size > LIMITE_POR_ANEXO_BYTES) {
    return `O arquivo${nome} passou de 2 MB. Tire uma foto menor ou envie um PDF mais leve.`;
  }
  return null;
}

/** Confere o conjunto: quantos já existem, quantos entram e o peso do envio. */
export function anexosAceitos(params: {
  jaGuardados: number;
  novos: { type: string; size: number; name?: string }[];
  /** O comprovante novo do mesmo envio, que divide o mesmo limite. */
  bytesDoComprovante?: number;
}): string | null {
  if (params.jaGuardados + params.novos.length > MAXIMO_DE_ANEXOS) {
    return `No máximo ${MAXIMO_DE_ANEXOS} anexos por relatório.`;
  }
  for (const arquivo of params.novos) {
    const problema = anexoAceito(arquivo);
    if (problema) return problema;
  }
  const total = params.novos.reduce((soma, a) => soma + a.size, 0) + (params.bytesDoComprovante ?? 0);
  if (total > LIMITE_DO_ENVIO_BYTES) {
    return "Os arquivos juntos passam do limite do envio (cerca de 3,6 MB). Anexe menos fotos de uma vez ou use arquivos mais leves.";
  }
  return null;
}

/** "182 KB", "1,4 MB" — para a lista de anexos. */
export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
