import { BotaoAcao } from "@/components/BotaoAcao";
import { enviarAvisoAoProfissional, enviarConfirmacoesWhatsapp, enviarResumoWhatsapp } from "@/app/actions/pedidos";
import { formatarTelefoneBrasileiro } from "@/lib/telefone";
import { IconeEnviar, IconeWhatsapp } from "@/components/Icones";

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

  const tit = (nome: string, tel: string | null) => (tel ? `${nome} · ${tel}` : `${nome} · sem telefone cadastrado`);

  return (
    <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
        <IconeWhatsapp /> Enviar pelo WhatsApp
      </div>
      <div className="flex flex-wrap items-stretch gap-2">
        {!apoio && (
          <>
            <BotaoAcao
              tela
              variante="whatsapp"
              icone={<IconeEnviar />}
              titulo={tit(clinicaNome, telClinica)}
              acao={enviarConfirmacoesWhatsapp.bind(null, pedidoId)}
              confirmar={`Enviar a confirmação curta para ${paraClinica}?`}
            >
              <span className="text-left leading-tight">
                <span className="block text-[9px] font-medium uppercase tracking-wide opacity-70">Para a clínica</span>
                Confirmação curta
              </span>
            </BotaoAcao>
            <BotaoAcao
              tela
              variante="whatsapp"
              icone={<IconeEnviar />}
              titulo={tit(clinicaNome, telClinica)}
              acao={enviarResumoWhatsapp.bind(null, pedidoId)}
              confirmar={`Enviar o resumo detalhado (data, horário, endereço, doutor e profissional) para ${paraClinica}?`}
            >
              <span className="text-left leading-tight">
                <span className="block text-[9px] font-medium uppercase tracking-wide opacity-70">Para a clínica</span>
                Resumo detalhado
              </span>
            </BotaoAcao>
          </>
        )}
        {status === "ALOCADO" && profissional && (
          <BotaoAcao
            tela
            variante="whatsapp"
            icone={<IconeEnviar />}
            titulo={tit(profissional.nome, telProf)}
            acao={enviarAvisoAoProfissional.bind(null, pedidoId)}
            confirmar={`Enviar o aviso de alocação para ${paraProfissional}?`}
          >
            <span className="text-left leading-tight">
              <span className="block text-[9px] font-medium uppercase tracking-wide opacity-70">Para o profissional</span>
              Aviso de alocação
            </span>
          </BotaoAcao>
        )}
      </div>
      <div className="mt-1.5 text-[10px] text-gray-500">
        {!apoio && <>Clínica: {telClinica ?? "sem telefone"}</>}
        {!apoio && profissional && " · "}
        {profissional && <>{profissional.nome}: {telProf ?? "sem telefone"}</>}
        {apoio && !profissional && "Profissional adicional ainda sem alocação"}
      </div>
    </div>
  );
}
