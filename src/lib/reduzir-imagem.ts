/**
 * Reduz uma foto de comprovante no navegador antes do envio.
 *
 * Foto de celular passa fácil dos 5 MB, e o formulário do relatório aceita no
 * máximo 3 MB. Imagens maiores que o limite são redesenhadas em até 1600 px de
 * lado maior e regravadas em JPEG; PDF e imagem pequena passam sem tocar. Se
 * algo falhar (navegador antigo, imagem corrompida), devolve o arquivo
 * original — a validação de tamanho do servidor continua valendo.
 */
const LIMITE_SEM_REDUZIR = 1.5 * 1024 * 1024;
const LADO_MAXIMO = 1600;

export async function reduzirImagem(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith("image/") || arquivo.size <= LIMITE_SEM_REDUZIR) return arquivo;
  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, "image/jpeg", 0.82));
    if (!blob || blob.size >= arquivo.size) return arquivo;
    const nome = arquivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg" });
  } catch {
    return arquivo;
  }
}
