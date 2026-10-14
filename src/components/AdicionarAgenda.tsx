import { linkAdicionarGoogleAgenda, linkArquivoIcs } from "@/lib/google-calendar-link";

/**
 * "Adicionar à sua agenda" (ata de 13/10): o rótulo deixa de prometer só o
 * Google. Abre as duas saídas — Google Agenda numa nova aba e o arquivo .ics,
 * que Apple Calendário e Outlook abrem. Sem JavaScript: <details> abre e fecha
 * sozinho, então serve em página de servidor.
 */
export function AdicionarAgenda({
  evento,
  variante = "botao",
}: {
  evento: { id: string; titulo: string; detalhes?: string; local?: string; inicio: Date; duracaoMin: number };
  /** "botao" para telas de confirmação; "link" para listas. */
  variante?: "botao" | "link";
}) {
  const classeGatilho =
    variante === "botao"
      ? "border border-gray-300 text-bordo text-xs font-semibold px-4 py-2.5 min-h-[40px] inline-flex items-center rounded-lg hover:bg-gray-50"
      : "text-[11px] font-semibold text-bordo hover:underline";
  return (
    <details className="relative inline-block group">
      <summary className={`cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden ${classeGatilho}`}>
        + Adicionar à sua agenda
      </summary>
      <div className="absolute z-20 mt-1 w-56 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
        <a
          href={linkAdicionarGoogleAgenda(evento)}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
        >
          Google Agenda
        </a>
        <a
          href={linkArquivoIcs(evento)}
          download="atendimento-hemoderi.ics"
          className="block rounded-lg px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
        >
          Apple, Outlook e outros (.ics)
        </a>
      </div>
    </details>
  );
}
