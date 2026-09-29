/**
 * Quais sincronizações externas ainda estão pendentes — ou seja, cuja última
 * tentativa falhou e nenhuma tentativa posterior consertou.
 *
 * A `SincronizacaoExterna` guarda TODA tentativa, sucesso ou falha, uma linha
 * por vez. Isso é o registro certo (auditável, não some), mas responder "o que
 * ainda está quebrado?" a partir dele exige cuidado: um pedido pode ter
 * falhado às 10h e dado certo no reprocessamento às 11h. Contar a linha de
 * falha crua mostraria um problema que já não existe — e é exatamente esse
 * ruído que faz a equipe parar de olhar o painel.
 *
 * A regra, então: por par (entidade, ação), só a ÚLTIMA tentativa conta. Se a
 * última deu certo, está resolvido; se falhou, é pendência. Fica aqui, sem
 * banco, para ser testável sozinho — é lógica pura sobre uma lista.
 */

export type TentativaSync = {
  entidadeId: string;
  acao: string;
  sucesso: boolean;
  criadaEm: Date;
  erro?: string | null;
  referencia?: string | null;
};

export type Pendencia = {
  entidadeId: string;
  acao: string;
  erro: string | null;
  desde: Date;
};

/**
 * Reduz o histórico às pendências abertas.
 *
 * Recebe as linhas já filtradas por sistema (ex.: só PIPEDRIVE) e devolve, por
 * par (entidade, ação), a última tentativa quando ela é uma falha. Ordena da
 * mais recente para a mais antiga, que é a ordem em que a equipe quer atacar.
 */
export function pendenciasDeSincronizacao(tentativas: TentativaSync[]): Pendencia[] {
  const ultimaPorChave = new Map<string, TentativaSync>();
  for (const t of tentativas) {
    const chave = `${t.entidadeId}::${t.acao}`;
    const atual = ultimaPorChave.get(chave);
    if (!atual || t.criadaEm.getTime() > atual.criadaEm.getTime()) {
      ultimaPorChave.set(chave, t);
    }
  }

  return [...ultimaPorChave.values()]
    .filter((t) => !t.sucesso)
    .map((t) => ({ entidadeId: t.entidadeId, acao: t.acao, erro: t.erro ?? null, desde: t.criadaEm }))
    .sort((a, b) => b.desde.getTime() - a.desde.getTime());
}
