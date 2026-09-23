/**
 * Datas e horas da operação. Sem dependência de React ou de banco — as mesmas
 * funções servem à tela, à server action e ao seed.
 *
 * O dia do atendimento é gravado como MEIA-NOITE UTC do dia escolhido, e a
 * hora vive separada, em texto ("14:30"). Parece rodeio, mas resolve um
 * problema real: o processo roda em UTC na Vercel e em America/Sao_Paulo na
 * máquina de quem desenvolve. Se "hoje" ou a exibição do dia dependessem do
 * fuso do processo, um atendimento das 21h apareceria no dia seguinte em
 * produção e no dia certo em desenvolvimento — o tipo de erro que só aparece
 * depois do go-live, na agenda de quem já saiu de casa.
 */

export const FUSO_OPERACAO = "America/Sao_Paulo";

/** `instante` é parâmetro (com `new Date()` como padrão) para que a regra de
 * corte das 18h dê para testar sem depender do relógio do sistema. */
function partesDeHoje(instante: Date = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_OPERACAO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instante);
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return { ano: Number(mapa.year), mes: Number(mapa.month), dia: Number(mapa.day) };
}

/** Meia-noite UTC do dia de hoje no fuso da operação. */
export function hojeUTC(instante: Date = new Date()): Date {
  const { ano, mes, dia } = partesDeHoje(instante);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** "2026-09-08" — o dia de hoje no fuso da operação. */
export function hojeISO(): string {
  const { ano, mes, dia } = partesDeHoje();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Minutos desde a meia-noite, agora, no fuso da operação. */
export function minutosAgora(instante: Date = new Date()): number {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: FUSO_OPERACAO,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instante);
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return Number(mapa.hour) * 60 + Number(mapa.minute);
}

/** Converte "2026-09-08" na meia-noite UTC correspondente. */
export function dataDeISO(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export function isoDeData(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * Lê uma data que veio da URL, caindo para hoje quando não dá para confiar
 * nela. Filtro de tela vira link colado no WhatsApp e link colado chega
 * truncado, com o dia cortado, com lixo no meio — e uma data inválida
 * chegando ao banco derruba a página inteira com erro 500. Errar para "hoje"
 * é sempre melhor do que não abrir.
 *
 * Pega também a data que não existe (31 de fevereiro): o JavaScript aceita e
 * empurra para março, então a ida e volta é que denuncia.
 */
export function dataDaURL(iso: string | undefined | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return hojeISO();
  const data = dataDeISO(iso);
  if (Number.isNaN(data.getTime())) return hojeISO();
  return isoDeData(data) === iso ? iso : hojeISO();
}

export function somarDias(data: Date, dias: number): Date {
  const d = new Date(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

/**
 * Os próximos `dias` dias a partir de hoje (hoje incluso), no fuso da
 * operação — a grade que "Minha Semana" usa (ata de 21/09: "destacar os
 * próximos 7 dias de disponibilidade", em vez do dia-da-semana abstrato).
 */
export function proximosDias(dias: number, agora: Date = new Date()): Date[] {
  const inicio = hojeUTC(agora);
  return Array.from({ length: dias }, (_, i) => somarDias(inicio, i));
}

/**
 * Todo dia entre `inicio` e `fim`, incluindo as pontas — usado para marcar
 * ausência por PERÍODO (férias, mestrado; ata de 21/09) sem precisar de um
 * campo de intervalo no banco: cada dia vira o mesmo `Bloqueio` de sempre.
 * `null` quando o intervalo é inválido (fim antes do início) ou maior que um
 * ano — período tão longo é sinal de erro de digitação, não de férias.
 */
export function diasDoIntervalo(inicio: Date, fim: Date): Date[] | null {
  if (fim < inicio) return null;
  const dias: Date[] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
    dias.push(d);
    if (dias.length > 366) return null;
  }
  return dias;
}

/**
 * "Segunda, 22/09" — nome do dia por extenso (sem o "-feira", que só
 * alonga) mais a data curta. Formato pedido nominalmente pela ata, distinto
 * de `formatarDataCurta` ("22/09 (seg)"), que é abreviado de propósito para
 * caber em tabela.
 */
export function formatarDiaEData(data: Date): string {
  const diaSemana = data.toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "long" });
  const nome = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1).replace("-feira", "");
  const curta = data.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
  return `${nome}, ${curta}`;
}

/**
 * Meia-noite UTC do dia calendário de `data` — usado para ancorar contagens
 * de dias a partir de um timestamp qualquer (`criadaEm`, por exemplo), que ao
 * contrário de `Pedido.data` não nasce já truncado. A imprecisão de algumas
 * horas ao redor da meia-noite não importa aqui: é usado para janelas de 60
 * dias, não para casar com um horário de atendimento.
 */
export function inicioDoDiaUTC(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
}

export function inicioDoMesUTC(data: Date = hojeUTC()): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));
}

export function fimDoMesUTC(data: Date = hojeUTC()): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0));
}

/**
 * Semanas completas (domingo a sábado) cobrindo o mês "YYYY-MM" — a agenda
 * mensal que a ata de 21/09 pediu ao lado dos próximos 7 dias. Dia fora do
 * mês vem como `null`, só para a grade fechar a semana; quem desenha decide
 * o que fazer com a célula vazia.
 */
export function gradeDoMes(competencia: string): (Date | null)[] {
  const [ano, mes] = competencia.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
  const ultimo = new Date(Date.UTC(ano, mes, 0));

  const celulas: (Date | null)[] = [];
  for (let i = 0; i < primeiro.getUTCDay(); i++) celulas.push(null);
  for (let dia = primeiro; dia <= ultimo; dia = somarDias(dia, 1)) celulas.push(dia);
  while (celulas.length % 7 !== 0) celulas.push(null);
  return celulas;
}

/** Competência "YYYY-MM" do dia do atendimento. */
export function competenciaDe(data: Date): string {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function competenciaAtual(): string {
  return competenciaDe(hojeUTC());
}

/** "2026-09" → "setembro de 2026", para cabeçalho de tela e de exportação. */
export function competenciaPorExtenso(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const nome = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(ano, mes - 1, 1))
  );
  return `${nome} de ${ano}`;
}

export function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** "08/09 (ter)" — usado nas listas onde o dia da semana muda a leitura. */
export function formatarDataCurta(data: Date): string {
  const dia = data.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
  const semana = data.toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "short" }).replace(".", "");
  return `${dia} (${semana})`;
}

export function formatarDataHora(data: Date): string {
  return data.toLocaleString("pt-BR", { timeZone: FUSO_OPERACAO });
}

/** Minutos desde a meia-noite a partir de "14:30". */
export function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** 870 → "14:30". */
export function paraHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Instante absoluto do atendimento, para comparar com "agora" e para mandar
 * ao Google Agenda. O fuso da operação é fixo (-03:00, sem horário de verão
 * no Brasil desde 2019); montar a string com offset explícito evita depender
 * do fuso do processo justamente no ponto em que ele mais engana.
 */
export function instanteDoAtendimento(data: Date, hora: string): Date {
  return new Date(`${isoDeData(data)}T${hora}:00-03:00`);
}

/**
 * Data mínima que o formulário PÚBLICO (sem sessão) aceita — decisão da ata
 * de 21/09. Nunca hoje: agendamento para o mesmo dia é emergência e vai pelo
 * WhatsApp, não pelo site. E amanhã só até as 18h de hoje; depois disso, a
 * central já não tem como garantir profissional e equipamento a tempo, e a
 * data mínima pula para depois de amanhã.
 *
 * É distinta da antecedência do agendamento pelo portal
 * (`antecedenciaMinimaHoras`, uma janela corrida de horas, decisão da ata de
 * 14/09): aqui o corte é hora fixa do relógio — "fecha às 18h", não "24h
 * antes". A mesma ata de 21/09 estendeu essa regra ao REAGENDAMENTO pelo
 * portal (decisão "a mesma regra do agendamento", em actions/pedidos.ts),
 * desacoplando-o do cancelamento, que segue `dentroDoPrazoDeCancelamento`.
 */
export function dataMinimaAgendamentoPublico(agora: Date = new Date()): string {
  const dias = minutosAgora(agora) <= 18 * 60 ? 1 : 2;
  return isoDeData(somarDias(hojeUTC(agora), dias));
}

/** Cancelamento pelo portal — ata de 21/09: até 30 minutos antes do
 * atendimento. Desacoplado do prazo de reagendamento de propósito: cancelar
 * é mais simples de absorver operacionalmente do que remarcar (não precisa
 * checar disponibilidade em outra data), então a janela pode ser mais curta. */
export const MINUTOS_MINIMOS_PARA_CANCELAR_NO_PORTAL = 30;

export function dentroDoPrazoDeCancelamento(data: Date, horaInicio: string, agora: Date = new Date()): boolean {
  const faltam = instanteDoAtendimento(data, horaInicio).getTime() - agora.getTime();
  return faltam >= MINUTOS_MINIMOS_PARA_CANCELAR_NO_PORTAL * 60 * 1000;
}

/**
 * O nome do profissional só aparece para a clínica com 24h de antecedência
 * (ata de 21/09) — André Assis pediu para evitar que a clínica insista em
 * escolher sempre o mesmo profissional específico. Antes disso, quem chama
 * `nomeDoProfissionalVisivel` mostra outra coisa no lugar (valor e serviço,
 * que já estão na tela) — não é sobre esconder o profissional, é sobre não
 * abrir margem para pedido de troca antes de a alocação estar praticamente
 * definitiva.
 */
export function nomeDoProfissionalVisivel(data: Date, horaInicio: string, agora: Date = new Date()): boolean {
  const faltam = instanteDoAtendimento(data, horaInicio).getTime() - agora.getTime();
  return faltam <= 24 * 60 * 60 * 1000;
}
