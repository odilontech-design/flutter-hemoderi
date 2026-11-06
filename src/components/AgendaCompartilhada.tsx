import { BotaoAcao } from "@/components/BotaoAcao";
import { IconeCalendario, IconeAtualizar } from "@/components/Icones";
import { salvarNaAgendaCompartilhada } from "@/app/actions/pedidos";
import { formatarDataHora } from "@/lib/data";

/**
 * A situação do atendimento na agenda COMPARTILHADA da equipe (06/11). Sem
 * botão de "confirmar que salvei": o evento é criado sozinho na conta
 * compartilhada ao alocar, e o "salvo" só aparece quando isso aconteceu de
 * verdade. Se falhou (ou a agenda não está configurada), a tela diz — e oferece
 * tentar de novo, não confirmar de boca.
 */
export function AgendaCompartilhada({
  pedidoId,
  salvaEm,
  configurada,
}: {
  pedidoId: string;
  salvaEm: Date | null;
  configurada: boolean;
}) {
  if (salvaEm) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
        title={`Salvo automaticamente na agenda compartilhada em ${formatarDataHora(salvaEm)}`}
      >
        <IconeCalendario className="!h-3.5 !w-3.5" /> Na agenda da equipe · {formatarDataHora(salvaEm)}
      </span>
    );
  }
  if (!configurada) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600"
        title="Falta configurar a agenda compartilhada (GOOGLE_AGENDA_EQUIPE_ID) em Integrações."
      >
        <IconeCalendario className="!h-3.5 !w-3.5" /> Agenda da equipe não configurada
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
        <IconeCalendario className="!h-3.5 !w-3.5" /> Ainda não está na agenda da equipe
      </span>
      <BotaoAcao variante="suave" icone={<IconeAtualizar />} acao={salvarNaAgendaCompartilhada.bind(null, pedidoId)}>
        Salvar agora
      </BotaoAcao>
    </span>
  );
}
