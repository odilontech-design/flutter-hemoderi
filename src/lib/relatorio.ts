/**
 * Os campos clínicos do relatório de atendimento.
 *
 * A reunião de 21/09 fechou uma regra e uma exceção: todo campo é
 * obrigatório, e todo campo tem um botão "não se aplica". A razão é cultura
 * de checagem — o André quer que a pessoa OLHE cada item e diga alguma
 * coisa, em vez de pular o que não interessa naquele procedimento. Deixar
 * opcional devolve a tela de hoje, onde o campo em branco não distingue
 * "não medi" de "não precisava medir".
 *
 * Por isso o valor é sempre texto: "não se aplica" é uma resposta válida, e
 * uma resposta válida não cabe num campo numérico.
 */

export const NAO_SE_APLICA = "não se aplica";

export type CampoClinico = {
  /** Nome do campo no formulário e na coluna do banco. */
  nome: string;
  rotulo: string;
  /** Exemplo do formato esperado, mostrado como placeholder. */
  exemplo: string;
};

/**
 * A ordem aqui é a ordem da tela, e segue o modelo que o André mandou: os
 * sinais vitais primeiro, sedação por último (só faz sentido em parte dos
 * atendimentos, e é onde o "não se aplica" mais aparece).
 */
export const CAMPOS_CLINICOS: CampoClinico[] = [
  { nome: "frequenciaCardiaca", rotulo: "Frequência cardíaca (FC)", exemplo: "72 bpm" },
  { nome: "saturacaoOxigenio", rotulo: "Saturação de oxigênio (SatO₂)", exemplo: "98%" },
  { nome: "pressaoArterial", rotulo: "Pressão arterial", exemplo: "120x80" },
  { nome: "glicemia", rotulo: "Glicemia", exemplo: "95 mg/dL" },
  { nome: "oxidoNitroso", rotulo: "Óxido nitroso (N₂O)", exemplo: "40%" },
  { nome: "oxigenio", rotulo: "Oxigênio (O₂)", exemplo: "60%" },
];

/**
 * Quais campos clínicos ficaram sem resposta.
 *
 * Devolve a lista (e não um booleano) para a mensagem de erro poder dizer
 * QUAL campo falta: "preencha a glicemia" resolve; "preencha os campos
 * obrigatórios" manda a pessoa procurar.
 */
export function camposClinicosEmBranco(valores: Record<string, string | null | undefined>): CampoClinico[] {
  return CAMPOS_CLINICOS.filter((campo) => !(valores[campo.nome] ?? "").trim());
}

/**
 * Os três itens que a aprovação geral exige conferidos, um a um (ata de
 * 21/09). Moram aqui, e não junto da action que os usa, porque um arquivo
 * "use server" só pode exportar função async — objeto de configuração
 * exportado de lá quebra o build.
 */
export const ITENS_VALIDACAO = {
  servico: { campo: "servicoValidadoEm", rotulo: "serviço executado" },
  valor: { campo: "valorValidadoEm", rotulo: "valor" },
  ajudaCusto: { campo: "ajudaCustoValidadaEm", rotulo: "ajuda de custo" },
} as const;

export type ItemValidacao = keyof typeof ITENS_VALIDACAO;

/**
 * Centavos a partir do que a pessoa digitou ("150", "150,50", "R$ 150,50").
 *
 * Devolve `null` para vazio — ajuda de custo é opcional, não é todo
 * atendimento que tem deslocamento a ressarcir — e `undefined` para texto
 * que não vira dinheiro, que é erro de digitação e precisa ser recusado em
 * vez de virar zero silencioso.
 */
export function ajudaCustoEmCentavos(texto: string): number | null | undefined {
  const limpo = texto.replace(/[R$\s.]/g, "").replace(",", ".").trim();
  if (!limpo) return null;
  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor < 0) return undefined;
  return Math.round(valor * 100);
}

/**
 * Os dados do agendamento que o profissional pode corrigir no relatório
 * (ata de 28/09). O identificador do pedido fica de fora de propósito: é a
 * chave que liga relatório, repasse e fatura, e editável ele deixaria de
 * identificar coisa alguma.
 */
export const CAMPOS_AGENDAMENTO = [
  {
    nome: "clinicaNomeInformado",
    rotulo: "Clínica",
    ajuda: "Se o atendimento saiu em outra unidade, escreva qual.",
  },
  {
    nome: "enderecoInformado",
    rotulo: "Endereço do atendimento",
    ajuda: "Corrija se o endereço do dia foi outro.",
  },
  {
    nome: "doutorNomeInformado",
    rotulo: "Doutor(a) responsável",
    ajuda: "Quem de fato recebeu, se não foi quem estava no agendamento.",
  },
] as const;

export type CampoAgendamento = (typeof CAMPOS_AGENDAMENTO)[number]["nome"];

/**
 * O que o profissional informou é diferente do que estava agendado?
 *
 * Compara ignorando espaço, caixa e ACENTO: "Clínica Santa Rita" e
 * "clinica santa rita " são a mesma resposta digitada com pressa — teclado de
 * celular em campo, entre um atendimento e outro, come acento o tempo todo.
 * Tratar isso como divergência encheria a conferência do pós-venda de alarme
 * falso, que é como se ensina a equipe a ignorar o alarme verdadeiro.
 */
export function divergiu(agendado: string | null | undefined, informado: string | null | undefined): boolean {
  const limpo = (valor: string | null | undefined) =>
    (valor ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toLowerCase();
  const declarado = limpo(informado);
  // Sem correção declarada não há divergência: nulo quer dizer "saiu como
  // estava marcado", não "o profissional apagou o campo".
  if (!declarado) return false;
  return declarado !== limpo(agendado);
}

/** O endereço da clínica em uma linha — a mesma string que a tela mostra e
 *  que a comparação de divergência usa. Duas montagens diferentes fariam o
 *  sistema acusar divergência por causa de uma vírgula. */
export function enderecoEmUmaLinha(clinica: {
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}): string {
  const rua = [clinica.endereco, clinica.numero].filter(Boolean).join(", ");
  return [rua, clinica.bairro, clinica.cidade, clinica.uf].filter(Boolean).join(" · ");
}

export const LIMITE_QUANTIDADE_ADICIONAL = 99;

/**
 * Os serviços a mais do relatório, lidos das duas listas paralelas que o
 * formulário envia (um id e uma quantidade por linha). Linha sem serviço é
 * linha em branco e some; o mesmo serviço em duas linhas vira uma só, com as
 * quantidades somadas — a tabela guarda um registro por serviço.
 */
export function lerServicosAdicionais(
  ids: unknown[],
  quantidades: unknown[]
): { servicoId: string; quantidade: number }[] {
  const porServico = new Map<string, number>();
  ids.forEach((bruto, i) => {
    const servicoId = String(bruto ?? "").trim();
    if (!servicoId) return;
    const n = Math.trunc(Number(quantidades[i]));
    const quantidade = Number.isFinite(n) && n >= 1 ? Math.min(n, LIMITE_QUANTIDADE_ADICIONAL) : 1;
    porServico.set(servicoId, Math.min((porServico.get(servicoId) ?? 0) + quantidade, LIMITE_QUANTIDADE_ADICIONAL));
  });
  return Array.from(porServico, ([servicoId, quantidade]) => ({ servicoId, quantidade }));
}
