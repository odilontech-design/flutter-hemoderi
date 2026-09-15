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

function partesDeHoje() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_OPERACAO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return { ano: Number(mapa.year), mes: Number(mapa.month), dia: Number(mapa.day) };
}

/** Meia-noite UTC do dia de hoje no fuso da operação. */
export function hojeUTC(): Date {
  const { ano, mes, dia } = partesDeHoje();
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** "2026-09-08" — o dia de hoje no fuso da operação. */
export function hojeISO(): string {
  const { ano, mes, dia } = partesDeHoje();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Minutos desde a meia-noite, agora, no fuso da operação. */
export function minutosAgora(): number {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: FUSO_OPERACAO,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
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
