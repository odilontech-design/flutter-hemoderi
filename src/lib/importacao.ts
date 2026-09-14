/**
 * Leitura da planilha de profissionais que a Hemoderi envia.
 *
 * Aceita colado de planilha (tabulação) ou CSV com vírgula/ponto-e-vírgula —
 * porque é isso que chega de verdade: alguém seleciona no Excel e cola, ou
 * exporta e manda o arquivo. Exigir um formato só é como a importação vira
 * "não funcionou" e o cadastro volta a ser feito um a um.
 *
 * Sem banco e sem rede: o que esta função faz é transformar texto bagunçado
 * em linhas conferidas, e é isso que os testes cobrem.
 */

export type LinhaImportacao = {
  linha: number;
  nome: string;
  email: string;
};

export type ProblemaImportacao = {
  linha: number;
  conteudo: string;
  motivo: string;
};

export type LeituraImportacao = {
  validos: LinhaImportacao[];
  problemas: ProblemaImportacao[];
};

/** Cabeçalhos que a planilha costuma trazer e que não são um profissional. */
const CABECALHOS = new Set(["nome", "sobrenome", "email", "e-mail", "nome completo", "profissional"]);

function separar(linha: string): string[] {
  // Tabulação primeiro: é o que sai de um Ctrl+C no Excel, e um nome com
  // vírgula ("Silva, Ana") não pode ser partido ao meio.
  if (linha.includes("\t")) return linha.split("\t");
  if (linha.includes(";")) return linha.split(";");
  return linha.split(",");
}

function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor);
}

/** "  ana   maria  " → "Ana Maria". Planilha vem com espaço sobrando e CAIXA ALTA. */
export function normalizarNome(bruto: string): string {
  const limpo = bruto.replace(/\s+/g, " ").trim();
  if (!limpo) return "";
  // Só ajusta a caixa quando a planilha veio toda em maiúsculas ou toda em
  // minúsculas; nome já digitado direito fica como está — "de Souza" não
  // vira "De Souza".
  const uniforme = limpo === limpo.toUpperCase() || limpo === limpo.toLowerCase();
  if (!uniforme) return limpo;

  const minusculas = new Set(["de", "da", "do", "das", "dos", "e"]);
  return limpo
    .toLowerCase()
    .split(" ")
    .map((parte, i) =>
      i > 0 && minusculas.has(parte) ? parte : parte.charAt(0).toUpperCase() + parte.slice(1)
    )
    .join(" ");
}

export function lerPlanilha(texto: string): LeituraImportacao {
  const validos: LinhaImportacao[] = [];
  const problemas: ProblemaImportacao[] = [];
  const vistos = new Set<string>();

  texto.split(/\r?\n/).forEach((bruta, indice) => {
    const linha = indice + 1;
    if (!bruta.trim()) return;

    const colunas = separar(bruta).map((c) => c.trim().replace(/^"|"$/g, ""));
    const email = (colunas.find((c) => c.includes("@")) ?? "").toLowerCase();

    // Cabeçalho: nenhuma coluna com arroba e a primeira é palavra conhecida.
    if (!email && CABECALHOS.has(colunas[0]?.toLowerCase() ?? "")) return;

    // Nome = tudo que não é o e-mail. Cobre "nome | sobrenome | email" e
    // "nome completo | email" sem precisar perguntar qual é o formato.
    const nome = normalizarNome(colunas.filter((c) => c !== "" && !c.includes("@")).join(" "));

    if (!email) {
      problemas.push({ linha, conteudo: bruta.trim(), motivo: "sem e-mail" });
      return;
    }
    if (!emailValido(email)) {
      problemas.push({ linha, conteudo: bruta.trim(), motivo: `e-mail inválido (${email})` });
      return;
    }
    if (!nome) {
      problemas.push({ linha, conteudo: bruta.trim(), motivo: "sem nome" });
      return;
    }
    if (vistos.has(email)) {
      problemas.push({ linha, conteudo: bruta.trim(), motivo: "e-mail repetido na planilha" });
      return;
    }

    vistos.add(email);
    validos.push({ linha, nome, email });
  });

  return { validos, problemas };
}
