"use client";

import { useEffect, useState } from "react";

const CHAVE_DISPENSADO = "hemoderi:instalar-dispensado-em";
const REPETIR_APOS_DIAS = 30;

type EventoDeInstalacao = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function jaInstalado(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function dispensadoHaPouco(): boolean {
  try {
    const quando = Number(localStorage.getItem(CHAVE_DISPENSADO));
    return Boolean(quando) && Date.now() - quando < REPETIR_APOS_DIAS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/** iPhone/iPad no Safari: lá não existe o pedido de instalação, só o "Adicionar à Tela de Início". */
function ehSafariDoIOS(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/**
 * O site como app (reunião de 20/10): registra o service worker (tela offline
 * e arquivos estáticos guardados — ver public/sw.js) e, no celular, oferece
 * a instalação uma vez — no Android com o botão do próprio navegador, no
 * iPhone com o passo a passo do "Adicionar à Tela de Início". Dispensado,
 * volta a aparecer só depois de 30 dias; instalado, nunca mais.
 */
export function AppInstalavel() {
  const [evento, setEvento] = useState<EventoDeInstalacao | null>(null);
  const [mostrarIOS, setMostrarIOS] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    if (jaInstalado() || dispensadoHaPouco()) return;
    const celular = window.matchMedia("(max-width: 768px)").matches;
    if (!celular) return;

    const aoPoderInstalar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoDeInstalacao);
    };
    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    const espera = ehSafariDoIOS() ? setTimeout(() => setMostrarIOS(true), 1500) : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
      if (espera) clearTimeout(espera);
    };
  }, []);

  function dispensar() {
    try {
      localStorage.setItem(CHAVE_DISPENSADO, String(Date.now()));
    } catch {
      // sem armazenamento: só fecha nesta visita
    }
    setEvento(null);
    setMostrarIOS(false);
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice.catch(() => undefined);
    setEvento(null);
  }

  if (!evento && !mostrarIOS) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar o app Hemoderi"
      className="fixed inset-x-3 top-16 z-[60] rounded-2xl bg-white shadow-xl border border-gray-200 p-4 flex gap-3 items-start"
      style={{ marginTop: "env(safe-area-inset-top)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ícone estático pequeno */}
      <img src="/icones/icone-192.png" alt="" className="w-12 h-12 rounded-xl shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-display font-bold text-sm text-bordo">Instale o app Hemoderi</div>
        {evento ? (
          <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">
            Abre direto da tela inicial, em tela cheia, sem precisar procurar o site.
          </p>
        ) : (
          <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">
            No Safari, toque em <strong>Compartilhar</strong> (o quadrado com a seta para cima) e depois em{" "}
            <strong>Adicionar à Tela de Início</strong>.
          </p>
        )}
        <div className="flex gap-3 mt-2">
          {evento && (
            <button
              type="button"
              onClick={instalar}
              className="bg-bordo text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-bordoEscuro"
            >
              Instalar
            </button>
          )}
          <button type="button" onClick={dispensar} className="text-xs font-semibold text-gray-500 py-2">
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
