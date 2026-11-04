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

/**
 * O nome da clínica como as pessoas leem (pedido de 04/11: "organizado e com
 * os espaços"): sem o "Clínica", "Instituto", "Dr." da frente e só as duas
 * primeiras palavras que identificam — "Clínica Santa Helena Odontologia"
 * vira "Santa Helena"; "Andre Miguel Sant Anna de Assis", "Andre Miguel".
 */
export function nomeCurtoDaClinica(nome: string): string {
  const palavras = (nome ?? "").split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p));
  const chave = (p: string) => semAcento(p).toLowerCase().replace(/[^a-z0-9]/g, "");
  let inicio = 0;
  while (inicio < palavras.length - 1 && (GENERICAS.has(chave(palavras[inicio])) || ["dr", "dra"].includes(chave(palavras[inicio])))) inicio++;
  const escolhidas = palavras.slice(inicio, inicio + 2);
  while (escolhidas.length > 1 && ["de", "da", "do", "das", "dos", "e"].includes(chave(escolhidas[escolhidas.length - 1]))) escolhidas.pop();
  return escolhidas.join(" ") || (nome ?? "").trim() || "Clínica";
}

/** "2026-0055": ano e sequencial, sem a clínica — para onde a clínica não pode aparecer. */
export function numeroDoPedido(numero: number, data: Date): string {
  return `${data.getUTCFullYear()}-${String(numero).padStart(LARGURA_SEQUENCIAL, "0")}`;
}

/** "2026-0055 - Andre Miguel": ano, sequencial e o nome da clínica legível (04/11). */
export function codigoDoPedido(numero: number, nomeClinica: string, data: Date): string {
  return `${numeroDoPedido(numero, data)} - ${nomeCurtoDaClinica(nomeClinica)}`;
}
