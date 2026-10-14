/**
 * A situação de cada atendimento em "Meus ganhos", a partir do relatório e do
 * repasse (ata de 13/10: "o status do relatório refletido direto na aba meus
 * ganhos"). Antes a aba só listava repasses — o atendimento com relatório
 * devolvido ou ainda não enviado simplesmente não aparecia, e o profissional
 * não entendia por que o valor não estava lá.
 *
 * A ordem das perguntas é a do caminho do dinheiro: pago? aprovado? relatório
 * enviado? devolvido? — a primeira que responder decide.
 */
export type SituacaoDoGanho =
  | "pago"
  | "a-receber"
  | "em-conferencia"
  | "devolvido"
  | "relatorio-pendente"
  | "agendado"
  | "faltou";

export const ROTULO_SITUACAO_GANHO: Record<SituacaoDoGanho, string> = {
  pago: "pago",
  "a-receber": "aprovado · a receber",
  "em-conferencia": "relatório em conferência",
  devolvido: "relatório devolvido — corrigir",
  "relatorio-pendente": "relatório pendente",
  agendado: "agendado",
  faltou: "paciente faltou · sem valor",
};

export const COR_SITUACAO_GANHO: Record<SituacaoDoGanho, string> = {
  pago: "text-emerald-700",
  "a-receber": "text-emerald-700",
  "em-conferencia": "text-amber-700",
  devolvido: "text-red-700",
  "relatorio-pendente": "text-red-700",
  agendado: "text-gray-500",
  faltou: "text-gray-400",
};

export function situacaoDoGanho(atendimento: {
  status: string;
  data: Date;
  hoje: Date;
  relatorio: { aprovadoEm: Date | null; devolvidoEm: Date | null } | null;
  repasse: { status: string } | null;
}): SituacaoDoGanho {
  const { status, relatorio, repasse } = atendimento;
  if (repasse?.status === "PAGO") return "pago";
  if (repasse?.status === "PENDENTE") return "a-receber";
  if (status === "FALTOU") return "faltou";
  if (relatorio?.aprovadoEm) return "a-receber";
  if (relatorio?.devolvidoEm) return "devolvido";
  if (relatorio) return "em-conferencia";
  return atendimento.data.getTime() > atendimento.hoje.getTime() ? "agendado" : "relatorio-pendente";
}
