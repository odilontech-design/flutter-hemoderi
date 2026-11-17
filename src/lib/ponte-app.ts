/**
 * Helpers do lado do navegador para quando o site roda DENTRO do app (Capacitor).
 * Fora do app, nada disto faz nada.
 */
const CHAVE_DO_TOKEN = "hemoderi.pushToken";

export function guardarToken(token: string): void {
  try {
    window.localStorage.setItem(CHAVE_DO_TOKEN, token);
  } catch {
    // sem armazenamento: o aparelho é tirado só quando outra pessoa entrar nele
  }
}

/** Ao sair da conta: o aparelho deixa de receber as notificações de quem saiu. */
export async function desregistrarAparelho(): Promise<void> {
  try {
    const token = window.localStorage.getItem(CHAVE_DO_TOKEN);
    if (!token) return;
    await fetch(`/api/app/dispositivo?token=${encodeURIComponent(token)}`, { method: "DELETE", keepalive: true });
    window.localStorage.removeItem(CHAVE_DO_TOKEN);
  } catch {
    // não impede a saída
  }
}
