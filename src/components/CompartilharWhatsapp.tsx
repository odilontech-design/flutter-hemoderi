"use client";

import { useState } from "react";

/**
 * Compartilha um texto no WhatsApp (ata de 20/10, relatório no grupo). No
 * celular abre o menu de compartilhar do aparelho — onde a pessoa escolhe o
 * WhatsApp e o grupo; no computador, abre o WhatsApp Web com o texto pronto.
 * Também copia o texto, para quem prefere colar.
 */
export function CompartilharWhatsapp({ texto, rotulo = "Compartilhar no WhatsApp" }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);

  async function compartilhar() {
    if (typeof navigator !== "undefined" && navigator.share && window.matchMedia("(max-width: 768px)").matches) {
      try {
        await navigator.share({ text: texto });
        return;
      } catch {
        // cancelado ou sem suporte: cai no link do WhatsApp
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={compartilhar}
        className="inline-flex items-center gap-1.5 bg-[#1EA952] text-white text-xs font-semibold px-3 py-2 min-h-[40px] rounded-lg hover:bg-[#178943]"
      >
        {rotulo}
      </button>
      <button type="button" onClick={copiar} className="text-xs font-semibold text-bordo hover:underline py-2">
        {copiado ? "Texto copiado ✓" : "Copiar texto"}
      </button>
    </div>
  );
}
