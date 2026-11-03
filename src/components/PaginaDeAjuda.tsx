import { Titulo } from "@/components/ui";
import type { TopicoDeAjuda } from "@/lib/ajuda";

/** O tutorial de uma área do sistema: uma seção por tela, que abre ao tocar. */
export function PaginaDeAjuda({ titulo, topicos }: { titulo: string; topicos: TopicoDeAjuda[] }) {
  return (
    <>
      <Titulo>{titulo}</Titulo>
      <p className="text-xs text-gray-500 mb-4 max-w-2xl">Toque em uma tela para ver o que ela faz e o que cada botão faz.</p>
      <div className="space-y-2 max-w-3xl">
        {topicos.map((t) => (
          <details key={t.tela} className="group rounded-2xl border border-gray-200 bg-white">
            <summary className="cursor-pointer select-none list-none px-4 py-3 flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <span className="font-display font-bold text-bordo text-sm">{t.tela}</span>
              <span aria-hidden className="text-bordo text-xs transition-transform group-open:rotate-180">▾</span>
            </summary>
            <div className="px-4 pb-4 text-xs text-gray-700 leading-relaxed">
              <p className="mb-2">{t.para}</p>
              {t.botoes.length > 0 && (
                <dl className="space-y-1.5">
                  {t.botoes.map((b) => (
                    <div key={b.nome}>
                      <dt className="font-semibold text-gray-900">{b.nome}</dt>
                      <dd className="text-gray-600">{b.faz}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {t.dica && <p className="mt-2 rounded-lg bg-bege/60 px-3 py-2 text-[11px] text-gray-700">💡 {t.dica}</p>}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
