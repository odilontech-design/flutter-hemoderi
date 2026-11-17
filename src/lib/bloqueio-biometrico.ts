/**
 * Regras do bloqueio por biometria do app (proposta do app: "entrar com digital
 * ou Face ID"). É uma trava local sobre a sessão que já existe: o app só abre
 * o conteúdo depois que a pessoa se identifica no aparelho.
 */

/** Quanto tempo o app pode ficar em segundo plano sem pedir a biometria de novo. */
export const TOLERANCIA_EM_SEGUNDOS = 30;

export const CHAVE_DO_BLOQUEIO = "hemoderi.bloqueioBiometrico";

/** Ligado por padrão: só deixa de valer se a pessoa desligar. */
export function bloqueioLigado(valorGuardado: string | null): boolean {
  return valorGuardado !== "desligado";
}

/**
 * Pede a biometria ao abrir o app (sem desbloqueio anterior) e ao voltar do
 * segundo plano depois de mais que a tolerância.
 */
export function precisaBloquear(d: {
  ligado: boolean;
  /** Quando o app foi para o segundo plano, em ms; null = acabou de abrir. */
  saiuEm: number | null;
  agora: number;
  toleranciaSegundos?: number;
}): boolean {
  if (!d.ligado) return false;
  if (d.saiuEm === null) return true;
  return d.agora - d.saiuEm > (d.toleranciaSegundos ?? TOLERANCIA_EM_SEGUNDOS) * 1000;
}
