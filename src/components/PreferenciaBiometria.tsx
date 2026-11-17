"use client";

import { useEffect, useState } from "react";
import { CHAVE_DO_BLOQUEIO, bloqueioLigado } from "@/lib/bloqueio-biometrico";

/**
 * Liga ou desliga a entrada por biometria. Só aparece dentro do app; no
 * navegador não existe o que configurar.
 */
export function PreferenciaBiometria() {
  const [nativo, setNativo] = useState(false);
  const [ligado, setLigado] = useState(true);

  useEffect(() => {
    const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (!capacitor?.isNativePlatform?.()) return;
    setNativo(true);
    try {
      setLigado(bloqueioLigado(window.localStorage.getItem(CHAVE_DO_BLOQUEIO)));
    } catch {
      // padrão
    }
  }, []);

  if (!nativo) return null;

  function alternar() {
    const novo = !ligado;
    setLigado(novo);
    try {
      window.localStorage.setItem(CHAVE_DO_BLOQUEIO, novo ? "ligado" : "desligado");
    } catch {
      // sem armazenamento: vale só nesta abertura
    }
  }

  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 text-xs">
      <span>
        <span className="block font-semibold text-bordo">Entrar com digital ou Face ID</span>
        <span className="text-[11px] text-gray-500">Pede a sua identificação ao abrir o app e ao voltar depois de alguns segundos.</span>
      </span>
      <input type="checkbox" checked={ligado} onChange={alternar} className="h-5 w-5 accent-[#6E2620]" />
    </label>
  );
}
