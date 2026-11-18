/**
 * Regras puras do preenchimento do PipeDrive (sem rede, para ter teste):
 * achar os campos personalizados pelo NOME que a equipe vê, converter o valor
 * para o tipo do campo, escolher a organização (cliente) que já existe e
 * montar o título no padrão da equipe.
 *
 * Contexto (17/11, André): os negócios nasciam sem as informações (as chaves
 * dos campos dependiam de variáveis de ambiente que ninguém cadastrou), cada
 * negócio ganho criava um cliente novo (a maioria já existe no PipeDrive, cada
 * um com o seu número) e o nome não seguia o padrão "ano + número do cliente
 * + clínica".
 */

export type CampoPipedrive = {
  key: string;
  name: string;
  field_type: string;
  options?: { id: number; label: string }[];
};

/** Sem acento, minúsculo, só letras e números separados por espaço único. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** O campo cujo nome (normalizado) é um dos pedidos. */
export function acharCampo(campos: CampoPipedrive[], nomes: string[]): CampoPipedrive | undefined {
  const alvos = nomes.map(normalizar);
  return campos.find((c) => alvos.includes(normalizar(c.name)));
}

/**
 * O valor no formato que o PipeDrive espera para o tipo do campo. Devolve
 * undefined quando não dá para preencher com segurança (por exemplo, um campo
 * de opções sem a opção correspondente): melhor em branco do que errado.
 */
/**
 * A opção do campo para o texto: igual (sem acento e caixa) ou, não havendo,
 * a ÚNICA cujo rótulo contém o texto ou está contido nele ("Cartão" para
 * "Cartão de crédito"). Mais de uma parecida é ambiguidade: nenhuma.
 */
export function opcaoDoCampo(campo: CampoPipedrive, texto: string): { id: number; label: string } | undefined {
  const opcoes = campo.options ?? [];
  const alvo = normalizar(texto);
  const igual = opcoes.find((o) => normalizar(o.label) === alvo);
  if (igual) return igual;
  if (alvo.length < 3) return undefined;
  const parecidas = opcoes.filter((o) => {
    const n = normalizar(o.label);
    return n.length >= 3 && (n.includes(alvo) || alvo.includes(n));
  });
  return parecidas.length === 1 ? parecidas[0] : undefined;
}

export function valorParaCampo(campo: CampoPipedrive, valor: string | number | null | undefined): unknown {
  if (valor === null || valor === undefined || valor === "") return undefined;
  const texto = String(valor);
  switch (campo.field_type) {
    case "enum":
      return opcaoDoCampo(campo, texto)?.id;
    case "set": {
      const opcao = opcaoDoCampo(campo, texto);
      return opcao ? [opcao.id] : undefined;
    }
    case "double":
    case "int":
    case "monetary": {
      const n = typeof valor === "number" ? valor : Number(texto.replace(",", "."));
      return Number.isFinite(n) ? n : undefined;
    }
    case "phone":
    case "user":
    case "org":
    case "people":
      return undefined;
    default:
      return texto;
  }
}

export type EspecificacaoDeCampo = {
  /** Nomes pelos quais o campo aparece no PipeDrive. */
  nomes: string[];
  /** Chave (hash) fixada em variável de ambiente: vence a busca pelo nome. */
  chaveFixa?: string;
  valor: string | number | null | undefined;
};

/** Monta { chave: valor } para o corpo do negócio, só com o que dá para preencher. */
export function montarCamposPersonalizados(campos: CampoPipedrive[], especificacoes: EspecificacaoDeCampo[]): Record<string, unknown> {
  const corpo: Record<string, unknown> = {};
  for (const e of especificacoes) {
    const fixa = e.chaveFixa?.trim();
    if (fixa) {
      if (e.valor !== null && e.valor !== undefined && e.valor !== "") corpo[fixa] = e.valor;
      continue;
    }
    const campo = acharCampo(campos, e.nomes);
    if (!campo) continue;
    const valor = valorParaCampo(campo, e.valor);
    if (valor !== undefined) {
      corpo[campo.key] = valor;
      // Campo de dinheiro leva a moeda junto, em outra chave.
      if (campo.field_type === "monetary") corpo[`${campo.key}_currency`] = "BRL";
    }
  }
  return corpo;
}

/** O núcleo do nome de uma clínica, para comparar: sem "clínica", "instituto", "dr"… */
export function nucleoDoNome(nome: string): string {
  return normalizar(nome)
    .split(" ")
    .filter((p) => p && !["clinica", "instituto", "odontologia", "odonto", "dr", "dra", "ltda", "me", "epp"].includes(p))
    .join(" ");
}

/**
 * Entre as organizações que a busca devolveu, a da clínica — só se for UMA.
 * Nome igual, ou um contendo o outro (o PipeDrive pode ter o número do cliente
 * no nome: "4170 Senac Tiradentes"). Várias com o MESMO nome são os duplicados
 * que o sistema antigo criava (18/11): vale a mais antiga (menor id), que é o
 * cliente original. Parecidas só valem se for uma; nenhuma é cliente fora do
 * PipeDrive e fica em branco — melhor que criar um cliente duplicado.
 */
export function escolherOrganizacao(candidatas: { id: number; name: string }[], nomeDaClinica: string): number | null {
  const alvo = nucleoDoNome(nomeDaClinica);
  if (!alvo) return null;
  const iguais = candidatas.filter((c) => nucleoDoNome(c.name) === alvo);
  if (iguais.length >= 1) return Math.min(...iguais.map((c) => c.id));
  const parecidas = candidatas.filter((c) => {
    const n = nucleoDoNome(c.name);
    return n && (n.includes(alvo) || alvo.includes(n));
  });
  return parecidas.length === 1 ? parecidas[0].id : null;
}

/**
 * O título no padrão da equipe: "2026 3463 Amitat" (ano, número do cliente no
 * PipeDrive, nome da clínica). Sem o número do cliente, fica o código do
 * agendamento no lugar: "2026-0421 - Senac Tiradentes".
 */
export function tituloNoPadraoDoCliente(d: { ano: number; numeroDoCliente: string | null; numeroDoPedido: number; clinica: string }): string {
  const clinica = d.clinica.replace(/\s+/g, " ").trim();
  if (d.numeroDoCliente?.trim()) return `${d.ano} ${d.numeroDoCliente.trim()} ${clinica}`;
  return `${d.ano}-${String(d.numeroDoPedido).padStart(4, "0")} - ${clinica}`;
}
