import { ROTULO_STATUS } from "@/lib/pedido";

/**
 * O que os filtros da agenda são e como viram URL.
 *
 * Mora num arquivo SEM "use client" de propósito: isto é usado tanto pelo
 * componente de filtro (cliente) quanto pela página (servidor). Um módulo
 * marcado "use client" não exporta funções de verdade para o servidor — o
 * servidor recebe uma referência para o cliente, e chamar isso estoura um
 * "is not a function" só em tempo de execução, no build de produção.
 */

export type ValoresFiltro = {
  data: string;
  dias: string;
  profissional: string;
  clinica: string;
  servico: string;
  status: string;
  /** Mostrar também quem não tem nada no dia. Não é filtro, é exibição. */
  todos?: string;
};

/** Períodos oferecidos. Mais que quinzena vira relatório, não agenda. */
export const PERIODOS = [
  { valor: "1", rotulo: "Só este dia" },
  { valor: "7", rotulo: "7 dias" },
  { valor: "15", rotulo: "15 dias" },
];

export const OPCOES_STATUS = [
  { valor: "", rotulo: "Todos menos cancelados" },
  { valor: "ATIVOS", rotulo: "Em aberto (a resolver)" },
  { valor: "SOLICITADO", rotulo: ROTULO_STATUS.SOLICITADO },
  { valor: "CONFIRMADO", rotulo: ROTULO_STATUS.CONFIRMADO },
  { valor: "ALOCADO", rotulo: ROTULO_STATUS.ALOCADO },
  { valor: "REALIZADO", rotulo: ROTULO_STATUS.REALIZADO },
  { valor: "FALTOU", rotulo: ROTULO_STATUS.FALTOU },
  { valor: "CANCELADO", rotulo: ROTULO_STATUS.CANCELADO },
  { valor: "TUDO", rotulo: "Tudo, inclusive cancelados" },
];

/** Monta a URL da agenda trocando um filtro e preservando os outros. */
export function urlAgenda(valores: ValoresFiltro, troca: Partial<ValoresFiltro> = {}): string {
  const final = { ...valores, ...troca };
  const parametros = new URLSearchParams();
  if (final.data) parametros.set("data", final.data);
  if (final.dias && final.dias !== "1") parametros.set("dias", final.dias);
  if (final.profissional) parametros.set("profissional", final.profissional);
  if (final.clinica) parametros.set("clinica", final.clinica);
  if (final.servico) parametros.set("servico", final.servico);
  if (final.status) parametros.set("status", final.status);
  if (final.todos) parametros.set("todos", final.todos);
  const consulta = parametros.toString();
  return consulta ? `/painel/agenda?${consulta}` : "/painel/agenda";
}
