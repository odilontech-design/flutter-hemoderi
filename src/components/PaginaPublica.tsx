import type { ReactNode } from "react";

/** Moldura das páginas públicas (política de privacidade e exclusão de conta). */
export function PaginaPublica({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bordoEscuro px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- svg estático pequeno. */}
          <img src="/logo-hemoderi.svg" alt="Hemoderi" className="h-16 w-auto mx-auto" />
        </div>
        <article className="bg-white rounded-2xl p-6 sm:p-8 text-gray-800">
          <h1 className="font-display font-bold text-bordo text-xl">{titulo}</h1>
          {subtitulo && <p className="text-xs text-gray-500 mt-1 mb-5">{subtitulo}</p>}
          <div className="space-y-4 text-sm leading-relaxed">{children}</div>
        </article>
        <div className="text-center text-[10px] text-white/40 mt-6">Hemoderi · Dilon Tech</div>
      </div>
    </div>
  );
}
