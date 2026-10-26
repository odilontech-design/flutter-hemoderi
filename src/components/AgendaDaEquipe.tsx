import { AdicionarAgenda } from "@/components/AdicionarAgenda";
import { BotaoAcao } from "@/components/BotaoAcao";
import { marcarAgendaSalva } from "@/app/actions/pedidos";
import { formatarDataHora } from "@/lib/data";

type Evento = Parameters<typeof AdicionarAgenda>[0]["evento"];

/**
 * O botão de agenda da equipe com a confirmação de que foi salvo (reunião de
 * 27/10). Antes de salvar: "+ Adicionar à sua agenda" e "Confirmar que
 * salvei". Depois: "✓ Salvo no Google Agenda por Joyce em 27/10 14:32", com a
 * opção de abrir de novo.
 */
export function AgendaDaEquipe({
  pedidoId,
  evento,
  salvaEm,
  salvaPor,
  variante = "link",
}: {
  pedidoId: string;
  evento: Evento;
  salvaEm: Date | null;
  salvaPor: string | null;
  variante?: "botao" | "link";
}) {
  if (salvaEm) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[11px] font-semibold text-green-700">
          ✓ Salvo no Google Agenda{salvaPor ? ` por ${salvaPor}` : ""} em {formatarDataHora(salvaEm)}
        </span>
        <AdicionarAgenda variante="link" evento={evento} />
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <AdicionarAgenda variante={variante} evento={evento} />
      <BotaoAcao acao={marcarAgendaSalva.bind(null, pedidoId)}>Confirmar que salvei na agenda</BotaoAcao>
    </span>
  );
}
