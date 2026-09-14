/**
 * Código do atendimento: ano, sequencial e clínica.
 *
 * O inteiro sequencial continua sendo a identidade no banco — é ele que é
 * único e que uma corrida entre dois atendentes protege. Este código é a
 * forma como a operação FALA do atendimento: "o 2026-0412 da Santa Rita" diz,
 * ao telefone, de que ano é, em que ordem entrou e de quem é, sem ninguém
 * abrir o sistema.
 */

/**
 * Palavras que quase toda clínica tem no nome e que, por isso, não
 * distinguem nenhuma delas. Sem tirá-las, metade dos códigos começaria em
 * "CLINICA".
 */
const GENERICAS = new Set([
  "clinica",
  "clinicas",
  "instituto",
  "centro",
  "consultorio",
  "odontologia",
  "odontologica",
  "odonto",
  "estetica",
  "saude",
  "medica",
  "medico",
  "espaco",
  "studio",
  "ltda",
  "me",
  "eireli",
  "sa",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
]);

const LARGURA_SEQUENCIAL = 4;
const LARGURA_SIGLA = 10;

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * A parte do código que identifica a clínica.
 *
 * Não precisa ser única: quem identifica é o sequencial. Ela existe para que
 * alguém reconheça a clínica de relance numa lista — por isso vale mais ser
 * legível que ser curta.
 */
export function siglaDaClinica(nome: string): string {
  const limpo = semAcento(nome ?? "").toUpperCase();
  const palavras = limpo.split(/[^A-Z0-9]+/).filter(Boolean);

  const significativas = palavras.filter((p) => !GENERICAS.has(p.toLowerCase()));
  // Nome inteiro genérico ("Clínica Odontológica"): melhor usar o nome como
  // veio do que devolver vazio.
  const base = (significativas.length > 0 ? significativas : palavras).join("");

  return base.slice(0, LARGURA_SIGLA) || "CLINICA";
}

export function codigoDoPedido(numero: number, nomeClinica: string, data: Date): string {
  const ano = data.getUTCFullYear();
  const sequencial = String(numero).padStart(LARGURA_SEQUENCIAL, "0");
  return `${ano}-${sequencial}-${siglaDaClinica(nomeClinica)}`;
}
