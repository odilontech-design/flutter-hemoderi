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
