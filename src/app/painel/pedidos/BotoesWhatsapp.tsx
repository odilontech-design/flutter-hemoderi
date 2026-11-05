import { BotaoAcao } from "@/components/BotaoAcao";
import { enviarAvisoAoProfissional, enviarConfirmacoesWhatsapp, enviarResumoWhatsapp } from "@/app/actions/pedidos";
import { formatarTelefoneBrasileiro } from "@/lib/telefone";

/**
 * Os envios pelo WhatsApp (Dilon Zap) com o destinatário escrito no botão
 * (pedido da Joyce, 05/11: "deveria ser mais explícito para quem vai esse
 * aviso"). Um botão por destinatário: clínica (curta e resumo) e
 * profissional; a confirmação pergunta nome e número antes de enviar.
 */
export function BotoesWhatsapp({
  pedidoId,
  status,
  clinicaNome,
  telefoneClinica,
  profissional,
  apoio = false,
}: {
  pedidoId: string;
  status: string;
  clinicaNome: string;
  /** O contato do agendamento, ou o telefone do cadastro da clínica. */
  telefoneClinica: string | null;
  profissional: { nome: string; telefone: string | null } | null;
  /** Profissional adicional: a clínica fala pelo atendimento principal. */
  apoio?: boolean;
}) {
  if (status !== "CONFIRMADO" && status !== "ALOCADO") return null;
  const telClinica = telefoneClinica ? formatarTelefoneBrasileiro(telefoneClinica.replace(/\D/g, "")) : null;
  const telProf = profissional?.telefone ? formatarTelefoneBrasileiro(profissional.telefone.replace(/\D/g, "")) : null;
  const paraClinica = `a CLÍNICA ${clinicaNome}${telClinica ? ` no ${telClinica}` : " (sem telefone cadastrado)"}`;
  const paraProfissional = profissional ? `o PROFISSIONAL ${profissional.nome}${telProf ? ` no ${telProf}` : " (sem telefone cadastrado)"}` : "";

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">WhatsApp</span>
        {!apoio && (
          <>
            <BotaoAcao tela acao={enviarConfirmacoesWhatsapp.bind(null, pedidoId)} confirmar={`Enviar a confirmação curta para ${paraClinica}?`}>
              Clínica: confirmação curta
            </BotaoAcao>
            <BotaoAcao
              tela
              acao={enviarResumoWhatsapp.bind(null, pedidoId)}
              confirmar={`Enviar o resumo detalhado (data, horário, endereço, doutor e profissional) para ${paraClinica}?`}
            >
              Clínica: resumo detalhado
            </BotaoAcao>
          </>
        )}
        {status === "ALOCADO" && profissional && (
          <BotaoAcao tela acao={enviarAvisoAoProfissional.bind(null, pedidoId)} confirmar={`Enviar o aviso de alocação para ${paraProfissional}?`}>
            Profissional: aviso de alocação
          </BotaoAcao>
        )}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">
        {!apoio && <>Clínica: {telClinica ?? "sem telefone"}</>}
        {!apoio && profissional && " · "}
        {profissional && <>Profissional: {profissional.nome} ({telProf ?? "sem telefone"})</>}
        {apoio && !profissional && "Profissional adicional ainda sem alocação"}
      </div>
    </div>
  );
}
