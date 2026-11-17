/** Valida o que o app manda ao registrar o aparelho para receber push. */
export type DadosDoDispositivo = { token: string; plataforma: "android" | "ios"; app: "clinica" | "profissional" };

export function lerDispositivo(corpo: unknown): DadosDoDispositivo | null {
  if (!corpo || typeof corpo !== "object") return null;
  const { token, plataforma, app } = corpo as Record<string, unknown>;
  if (typeof token !== "string" || token.length < 20 || token.length > 4096 || /\s/.test(token)) return null;
  if (plataforma !== "android" && plataforma !== "ios") return null;
  if (app !== "clinica" && app !== "profissional") return null;
  return { token, plataforma, app };
}
