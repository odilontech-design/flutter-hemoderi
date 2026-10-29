/**
 * Dias sem expediente na operação (ata de 29/10): fim de semana e feriado.
 * Nacionais, os móveis calculados a partir da Páscoa, e os de São Paulo (a
 * operação é de lá): 25/01 (aniversário da cidade) e 09/07 (Revolução
 * Constitucionalista). Serve à regra do endereço: a janela de revelação não
 * pode cair num dia em que ninguém planeja a semana.
 */

/** Domingo de Páscoa (calendário gregoriano, algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

const somar = (data: Date, dias: number) => new Date(data.getTime() + dias * 86_400_000);
const chave = (data: Date) => data.toISOString().slice(0, 10);

/** Os feriados do ano, como "yyyy-mm-dd". */
export function feriadosDoAno(ano: number): Set<string> {
  const p = pascoa(ano);
  const fixos = ["01-01", "01-25", "04-21", "05-01", "07-09", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"].map((md) => `${ano}-${md}`);
  const moveis = [-48, -47, -2, 60].map((d) => chave(somar(p, d))); // Carnaval (seg e ter), Sexta-feira Santa, Corpus Christi
  return new Set([...fixos, ...moveis]);
}

/** A data (yyyy-mm-dd, já no horário de Brasília) é sábado, domingo ou feriado? */
export function semExpediente(iso: string): boolean {
  const data = new Date(`${iso}T00:00:00Z`);
  const dia = data.getUTCDay();
  return dia === 0 || dia === 6 || feriadosDoAno(data.getUTCFullYear()).has(iso);
}
