"use client";

/** Abre a impressão do navegador — "Salvar como PDF" gera o arquivo do recibo. */
export function BotaoImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-bordo text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-bordoEscuro"
    >
      Imprimir / salvar PDF
    </button>
  );
}
