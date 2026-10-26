import { instanteDoAtendimento } from "@/lib/data";

/**
 * O compromisso que a equipe põe na própria agenda depois que o atendimento é
 * alocado (pedido do André, 26/10). Diferente do evento do profissional, que
 * esconde o endereço até perto do horário (lib/sigilo.ts), aqui vai tudo o que
 * a central precisa para acompanhar o dia sem abrir o sistema: quem atende,
 * onde, o doutor e o contato da clínica.
 */
export function eventoParaEquipe(pedido: {
  id: string;
  data: Date;
  horaInicio: string;
  duracaoMin: number;
  clinicaNome: string;
  servicoNome: string;
  profissionalNome?: string | null;
  doutorNome?: string | null;
  contatoClinica?: string | null;
  pacienteNome?: string | null;
  procedimentoPaciente?: string | null;
  local?: string | null;
}) {
  const detalhes = [
    pedido.profissionalNome ? `Profissional: ${pedido.profissionalNome}` : null,
    pedido.doutorNome ? `Doutor(a): ${pedido.doutorNome}` : null,
    pedido.contatoClinica ? `Contato da clínica: ${pedido.contatoClinica}` : null,
    pedido.pacienteNome ? `Paciente: ${pedido.pacienteNome}` : null,
    pedido.procedimentoPaciente ? `Procedimento: ${pedido.procedimentoPaciente}` : null,
  ].filter((linha): linha is string => Boolean(linha));

  return {
    id: pedido.id,
    titulo: `${pedido.servicoNome} — ${pedido.clinicaNome}${pedido.profissionalNome ? ` (${pedido.profissionalNome})` : ""}`,
    detalhes: detalhes.join("\n") || undefined,
    local: pedido.local || undefined,
    inicio: instanteDoAtendimento(pedido.data, pedido.horaInicio),
    duracaoMin: pedido.duracaoMin,
  };
}
