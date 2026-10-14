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

/** Texto de campo do iCalendar: vírgula, ponto e vírgula, barra e quebra de linha escapados (RFC 5545). */
function textoIcs(valor: string): string {
  return valor.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * O mesmo evento em arquivo .ics (ata de 13/10: "Adicionar à sua agenda", não só
 * ao Google). É o formato que Apple Calendário, Outlook e o próprio Google
 * abrem: quem não usa Google não fica sem o botão.
 */
export function arquivoIcs(params: {
  id: string;
  titulo: string;
  detalhes?: string;
  local?: string;
  inicio: Date;
  duracaoMin: number;
}): string {
  const fim = new Date(params.inicio.getTime() + params.duracaoMin * 60 * 1000);
  const comoUTC = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hemoderi//Dilon Saude//PT-BR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${params.id}@hemoderi`,
    `DTSTAMP:${comoUTC(new Date())}`,
    `DTSTART:${comoUTC(params.inicio)}`,
    `DTEND:${comoUTC(fim)}`,
    `SUMMARY:${textoIcs(params.titulo)}`,
    ...(params.local ? [`LOCATION:${textoIcs(params.local)}`] : []),
    ...(params.detalhes ? [`DESCRIPTION:${textoIcs(params.detalhes)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return linhas.join("\r\n") + "\r\n";
}

/** O .ics como link de download, sem rota no servidor. */
export function linkArquivoIcs(params: Parameters<typeof arquivoIcs>[0]): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(arquivoIcs(params))}`;
}
