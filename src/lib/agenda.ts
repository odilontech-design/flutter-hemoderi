/**
 * Aritmética de agenda — sem banco e sem React, para poder ser testada
 * sozinha (test/agenda.test.ts).
 *
 * Tudo aqui trabalha em MINUTOS desde a meia-noite. Comparar "14:30" com
 * "9:00" como texto dá errado silenciosamente; comparar 870 com 540 não.
 */

import { paraHora, paraMinutos } from "@/lib/data";

export type Intervalo = { inicio: number; fim: number };

/** Passo da grade de horários oferecida no portal. */
export const PASSO_GRADE_MIN = 30;

export function intervaloDe(horaInicio: string, duracaoMin: number): Intervalo {
  const inicio = paraMinutos(horaInicio);
  return { inicio, fim: inicio + duracaoMin };
}

/**
 * Dois intervalos se sobrepõem quando um começa antes de o outro terminar.
 * O toque exato não conta: um atendimento que termina 15:00 e outro que
 * começa 15:00 convivem — é assim que a agenda é lida na prática.
 */
export function haSobreposicao(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fim && b.inicio < a.fim;
}

/**
 * Junta janelas encostadas ou sobrepostas numa só. Necessário porque a
 * disponibilidade é declarada em pedaços ("08:00–12:00" e "12:00–16:00") e um
 * serviço de 90 minutos às 11:30 cabe no conjunto, mas não cabe em nenhum dos
 * pedaços isolados.
 */
export function mesclarIntervalos(intervalos: Intervalo[]): Intervalo[] {
  const ordenados = [...intervalos].sort((a, b) => a.inicio - b.inicio);
  const saida: Intervalo[] = [];
  for (const atual of ordenados) {
    const ultimo = saida[saida.length - 1];
    if (ultimo && atual.inicio <= ultimo.fim) {
      ultimo.fim = Math.max(ultimo.fim, atual.fim);
    } else {
      saida.push({ ...atual });
    }
  }
  return saida;
}

/** O intervalo cabe inteiro dentro de alguma das janelas. */
export function cabeEmAlgumaJanela(alvo: Intervalo, janelas: Intervalo[]): boolean {
  return mesclarIntervalos(janelas).some((j) => alvo.inicio >= j.inicio && alvo.fim <= j.fim);
}

/**
 * Subtrai as ausências das janelas de disponibilidade. Bloqueio de dia
 * inteiro chega aqui como 0–1440 e zera a disponibilidade do dia.
 */
export function subtrairIntervalos(janelas: Intervalo[], remover: Intervalo[]): Intervalo[] {
  let resultado = mesclarIntervalos(janelas);
  for (const bloqueio of mesclarIntervalos(remover)) {
    const proximo: Intervalo[] = [];
    for (const janela of resultado) {
      if (!haSobreposicao(janela, bloqueio)) {
        proximo.push(janela);
        continue;
      }
      if (bloqueio.inicio > janela.inicio) proximo.push({ inicio: janela.inicio, fim: bloqueio.inicio });
      if (bloqueio.fim < janela.fim) proximo.push({ inicio: bloqueio.fim, fim: janela.fim });
    }
    resultado = proximo;
  }
  return resultado;
}

/**
 * Horários de início livres para um serviço de `duracaoMin`.
 *
 * Um horário só entra na lista se o serviço INTEIRO couber: início mais
 * duração, dentro de uma janela disponível e sem esbarrar em nada já ocupado.
 * Oferecer o início e descobrir o conflito na confirmação é o que faz a
 * clínica agendar duas vezes o mesmo horário.
 */
export function horariosLivres({
  janelas,
  ocupacoes,
  duracaoMin,
  passoMin = PASSO_GRADE_MIN,
  minutoMinimo = -1,
}: {
  janelas: Intervalo[];
  ocupacoes: Intervalo[];
  duracaoMin: number;
  passoMin?: number;
  /** Corta o passado (e a antecedência mínima) quando o dia é hoje. */
  minutoMinimo?: number;
}): string[] {
  const livres: string[] = [];
  for (const janela of mesclarIntervalos(janelas)) {
    // Começa a grade em múltiplos do passo para não oferecer "08:07".
    const primeiro = Math.ceil(janela.inicio / passoMin) * passoMin;
    for (let inicio = primeiro; inicio + duracaoMin <= janela.fim; inicio += passoMin) {
      if (inicio < minutoMinimo) continue;
      const alvo = { inicio, fim: inicio + duracaoMin };
      if (ocupacoes.some((o) => haSobreposicao(alvo, o))) continue;
      livres.push(paraHora(inicio));
    }
  }
  return livres;
}

/** Janelas declaradas pelo profissional para um dia da semana. */
export function janelasDoDia(
  disponibilidades: { diaSemana: number; horaInicio: string; horaFim: string }[],
  diaSemana: number
): Intervalo[] {
  return disponibilidades
    .filter((d) => d.diaSemana === diaSemana)
    .map((d) => ({ inicio: paraMinutos(d.horaInicio), fim: paraMinutos(d.horaFim) }));
}

/** Ausências do dia. Sem hora preenchida, o dia inteiro fica de fora. */
export function intervalosDeBloqueio(
  bloqueios: { horaInicio: string | null; horaFim: string | null }[]
): Intervalo[] {
  return bloqueios.map((b) =>
    b.horaInicio && b.horaFim
      ? { inicio: paraMinutos(b.horaInicio), fim: paraMinutos(b.horaFim) }
      : { inicio: 0, fim: 24 * 60 }
  );
}
