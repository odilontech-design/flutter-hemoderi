/**
 * Regras puras da integração com o PipeDrive, sem banco, para os testes
 * cobrirem: o subdomínio da conta, a URL da API e a descrição de um erro.
 */

/**
 * O subdomínio da conta a partir do que foi colado em PIPEDRIVE_DOMINIO.
 *
 * A variável espera só o subdomínio ("hemoderi-5c2c36"), mas o que a tela do
 * PipeDrive mostra é o endereço inteiro ("hemoderi-5c2c36.pipedrive.com"), e é
 * isso que costuma ser colado. Com o endereço inteiro a URL virava
 * "hemoderi-5c2c36.pipedrive.com.pipedrive.com", que não existe — e o Node
 * responde só "fetch failed" (ata de 21/10). Aceita as duas formas, e também
 * com https://, barra no fim ou espaço.
 */
export function subdominioDoPipedrive(valor: string | undefined | null): string | null {
  const limpo = (valor ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.pipedrive\.com$/, "")
    .replace(/\.$/, "");
  return /^[a-z0-9][a-z0-9-]*$/.test(limpo) ? limpo : null;
}

export function urlDaApiPipedrive(dominio: string, token: string, caminho: string): string {
  return `https://${dominio}.pipedrive.com/api/v1${caminho}?api_token=${encodeURIComponent(token.trim())}`;
}

/**
 * O motivo de uma falha, legível na tela de integrações.
 *
 * "fetch failed" sozinho não diz nada: a causa de verdade (endereço que não
 * existe, conexão recusada, tempo esgotado) vem em `erro.cause`. E quando o
 * PipeDrive responde com erro, a mensagem dele ("You need to be authorized")
 * diz mais que o código HTTP.
 */
export function descreverErroPipedrive(erro: unknown): string {
  if (!(erro instanceof Error)) return String(erro);
  if (erro.name === "TimeoutError" || erro.name === "AbortError") {
    return "O PipeDrive não respondeu a tempo.";
  }
  const causa = (erro as Error & { cause?: unknown }).cause;
  if (causa && typeof causa === "object") {
    const { code, hostname, message } = causa as { code?: string; hostname?: string; message?: string };
    if (code === "ENOTFOUND") {
      return `Endereço não encontrado (${hostname ?? "domínio"}) — confira PIPEDRIVE_DOMINIO: só o subdomínio da conta.`;
    }
    const detalhe = [code, message].filter(Boolean).join(": ");
    if (detalhe) return `${erro.message} (${detalhe})`;
  }
  return erro.message;
}

export function mensagemDeHttpPipedrive(status: number, corpo: unknown): string {
  const deLa =
    corpo && typeof corpo === "object" && "error" in corpo && typeof (corpo as { error: unknown }).error === "string"
      ? (corpo as { error: string }).error
      : null;
  if (status === 401) return `PipeDrive: token inválido ou revogado — confira PIPEDRIVE_API_TOKEN (HTTP 401).`;
  return `PipeDrive: ${deLa ?? "requisição recusada"} (HTTP ${status})`;
}
