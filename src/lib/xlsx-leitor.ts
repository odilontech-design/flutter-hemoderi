import { inflateRawSync } from "node:zlib";

/**
 * Leitor mínimo de .xlsx (ata de 20/10: a planilha de repasses volta
 * preenchida em Excel). Um .xlsx é um zip de XMLs: aqui só o necessário para
 * ler os VALORES de uma aba — textos (compartilhados ou inline) e números;
 * fórmulas valem o último resultado salvo pelo Excel. Sem dependência nova.
 */

type Entrada = { nome: string; metodo: number; tamanhoComprimido: number; deslocamento: number };

function entradasDoZip(buf: Buffer): Map<string, Entrada> {
  // Fim do diretório central: assinatura 0x06054b50 nos últimos 64 KB.
  let fim = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error("Arquivo não é um .xlsx válido.");
  const total = buf.readUInt16LE(fim + 10);
  let p = buf.readUInt32LE(fim + 16);
  const entradas = new Map<string, Entrada>();
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Arquivo .xlsx corrompido.");
    const metodo = buf.readUInt16LE(p + 10);
    const tamanhoComprimido = buf.readUInt32LE(p + 20);
    const tamNome = buf.readUInt16LE(p + 28);
    const tamExtra = buf.readUInt16LE(p + 30);
    const tamComentario = buf.readUInt16LE(p + 32);
    const deslocamento = buf.readUInt32LE(p + 42);
    const nome = buf.toString("utf8", p + 46, p + 46 + tamNome);
    entradas.set(nome, { nome, metodo, tamanhoComprimido, deslocamento });
    p += 46 + tamNome + tamExtra + tamComentario;
  }
  return entradas;
}

function lerEntrada(buf: Buffer, e: Entrada): string {
  const tamNome = buf.readUInt16LE(e.deslocamento + 26);
  const tamExtra = buf.readUInt16LE(e.deslocamento + 28);
  const inicio = e.deslocamento + 30 + tamNome + tamExtra;
  const dados = buf.subarray(inicio, inicio + e.tamanhoComprimido);
  if (e.metodo === 0) return dados.toString("utf8");
  if (e.metodo === 8) return inflateRawSync(dados).toString("utf8");
  throw new Error("Compressão do .xlsx não suportada.");
}

function desescapar(t: string): string {
  return t
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

function textoDe(xml: string): string {
  return desescapar(Array.from(xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g), (m) => m[1]).join(""));
}

/** "AB12" → índice de coluna 27 (0 = A). */
function coluna(ref: string): number {
  const letras = ref.replace(/\d+/g, "");
  let n = 0;
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

export type Celula = string | number | null;

/** As linhas de uma aba, pelo nome, como matriz de valores (linha 1 = índice 0). */
export function lerAbaXlsx(buf: Buffer, nomeDaAba: string): Celula[][] {
  const entradas = entradasDoZip(buf);
  const ler = (nome: string) => {
    const e = entradas.get(nome);
    return e ? lerEntrada(buf, e) : null;
  };

  const workbook = ler("xl/workbook.xml");
  const rels = ler("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error("Arquivo não é um .xlsx válido.");
  const aba = Array.from(workbook.matchAll(/<sheet\b[^>]*>/g))
    .map((m) => m[0])
    .find((tag) => desescapar(tag.match(/name="([^"]*)"/)?.[1] ?? "") === nomeDaAba);
  if (!aba) throw new Error(`A planilha não tem a aba "${nomeDaAba}".`);
  const rid = aba.match(/r:id="([^"]*)"/)?.[1];
  const alvo = Array.from(rels.matchAll(/<Relationship\b[^>]*>/g))
    .map((m) => m[0])
    .find((tag) => tag.includes(`Id="${rid}"`))
    ?.match(/Target="([^"]*)"/)?.[1];
  if (!alvo) throw new Error("Não encontrei a aba dentro do arquivo.");
  const caminho = alvo.startsWith("/") ? alvo.slice(1) : `xl/${alvo.replace(/^\.\//, "")}`;

  const compartilhados = Array.from((ler("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g), (m) =>
    textoDe(m[1])
  );
  const folha = ler(caminho);
  if (!folha) throw new Error("Não encontrei a aba dentro do arquivo.");

  const linhas: Celula[][] = [];
  for (const m of folha.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const indice = Number(m[1]) - 1;
    const linha: Celula[] = [];
    for (const c of m[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1];
      if (!ref) continue;
      const tipo = attrs.match(/t="([^"]*)"/)?.[1];
      const corpo = c[2] ?? "";
      const v = corpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let valor: Celula = null;
      if (tipo === "s" && v != null) valor = compartilhados[Number(v)] ?? null;
      else if (tipo === "inlineStr") valor = textoDe(corpo);
      else if (tipo === "str" && v != null) valor = desescapar(v);
      else if (v != null && v !== "") valor = Number(v);
      linha[coluna(ref)] = valor;
    }
    linhas[indice] = linha;
  }
  return Array.from(linhas, (l) => l ?? []);
}
