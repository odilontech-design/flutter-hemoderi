"use client";

export type Coordenadas = { latitude: number; longitude: number; precisaoMetros: number };

/**
 * Pede a localização do navegador, sem nunca travar quem chama: permissão
 * negada, sem GPS, sem sinal, navegador sem suporte — tudo vira `null` em vez
 * de erro. Quem usa isso é um formulário que precisa ser enviado de qualquer
 * jeito, com ou sem localização; a confirmação de presença é bônus, não
 * requisito.
 *
 * O tempo de espera é curto de propósito: em área de sinal fraco (comum
 * dentro de clínica), esperar demais pelo GPS é pior do que enviar sem ele.
 */
export function obterLocalizacao(tempoLimiteMs = 4000): Promise<Coordenadas | null> {
  return new Promise((resolver) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolver(null);
      return;
    }

    const cronometro = setTimeout(() => resolver(null), tempoLimiteMs);

    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        clearTimeout(cronometro);
        resolver({
          latitude: posicao.coords.latitude,
          longitude: posicao.coords.longitude,
          precisaoMetros: posicao.coords.accuracy,
        });
      },
      () => {
        clearTimeout(cronometro);
        resolver(null);
      },
      { timeout: tempoLimiteMs, maximumAge: 60_000 }
    );
  });
}
