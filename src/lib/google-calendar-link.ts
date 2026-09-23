/**
 * Link "adicionar rápido" do Google Agenda — sem OAuth, sem API, sem conta de
 * serviço: é a mesma URL pública que qualquer botão de "adicionar ao
 * calendário" usa. Serve ao pedido que ainda não é confirmado
 * (SolicitacaoPublica) e que por regra do sistema (deveTerEvento, em
 * integracoes/google-evento.ts) não entra na sincronização de verdade — essa
 * é para o profissional e a clínica, depois que o atendimento existe. Aqui é
 * só a pessoa guardando para si o horário que ela mesma pediu.
 */
export function linkAdicionarGoogleAgenda(params: {
  titulo: string;
  detalhes?: string;
  local?: string;
  inicio: Date;
  duracaoMin: number;
}): string {
  const fim = new Date(params.inicio.getTime() + params.duracaoMin * 60 * 1000);
  const comoUTC = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");

  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: params.titulo,
    dates: `${comoUTC(params.inicio)}/${comoUTC(fim)}`,
  });
  if (params.detalhes) query.set("details", params.detalhes);
  if (params.local) query.set("location", params.local);

  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}
