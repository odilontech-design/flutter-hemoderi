import type { Prisma, PerfilInterno, StatusPedido } from "@prisma/client";

/**
 * As etapas da esteira, e de quem é cada uma.
 *
 * A ata de 28/09 separou o que antes era um balde só ("Aguardando ação",
 * juntando SOLICITADO e CONFIRMADO): a triagem é da Ana, que filtra e
 * confirma o que chega, e a alocação é da Joyce, que só então escolhe quem
 * atende. Com as duas filas no mesmo lugar, cada uma via o trabalho da outra
 * como ruído e ninguém sabia dizer quantos pedidos estavam realmente parados
 * na sua mão.
 *
 * O dono NÃO tranca a etapa: quem abre a esteira cai na própria fila, mas
 * alcança as outras. Ana precisa achar um pedido já alocado quando a clínica
 * liga perguntando por ele, e esconder isso dela transformaria uma consulta
 * de cinco segundos em um pedido de ajuda para outro setor. Quem de fato
 * separa responsabilidade são as ações (só a logística aloca, só o comercial
 * cancela) — e essas já são conferidas no servidor, em actions/pedidos.ts.
 */

export type Etapa = {
  chave: string;
  rotulo: string;
  /** O que a etapa significa para quem trabalha nela. */
  descricao: string;
  /** Perfil que responde por esta fila. Sem dono, é uma visão de consulta. */
  dono?: PerfilInterno;
  onde: Prisma.PedidoWhereInput;
};

const PENDENTE_DE_CONFERENCIA: Prisma.PedidoWhereInput = {
  status: "REALIZADO",
  // `is` e não `isNot: null`: o pedido realizado SEM relatório nenhum não é
  // trabalho do pós-venda, é trabalho do profissional que ainda não entregou.
  // Relatório devolvido ao profissional não é fila do pós-venda: a bola está
  // com quem vai corrigir. Reenviar limpa `devolvidoEm` e ele volta para cá.
  relatorio: { is: { aprovadoEm: null, devolvidoEm: null } },
};

export const ETAPAS: Etapa[] = [
  {
    chave: "parados",
    rotulo: "Parados",
    descricao: "Tudo que espera alguém da equipe — a triagem e a alocação juntas.",
    onde: { status: { in: ["SOLICITADO", "CONFIRMADO"] satisfies StatusPedido[] } },
  },
  {
    chave: "triagem",
    rotulo: "Para confirmar",
    descricao: "Chegou da clínica ou do site e ainda não virou compromisso da operação.",
    dono: "COMERCIAL",
    onde: { status: "SOLICITADO" },
  },
  {
    chave: "alocar",
    rotulo: "Para alocar",
    descricao: "Confirmado e sem profissional — é a fila da logística.",
    dono: "LOGISTICA",
    onde: { status: "CONFIRMADO" },
  },
  {
    chave: "alocados",
    rotulo: "Alocados",
    descricao: "Com profissional indicado. O aceite dele é o que falta.",
    onde: { status: "ALOCADO" },
  },
  {
    chave: "conferir",
    rotulo: "Para conferir",
    descricao: "Atendido, com relatório aguardando a conferência do pós-venda.",
    dono: "POS_VENDA",
    onde: PENDENTE_DE_CONFERENCIA,
  },
  {
    chave: "devolvidos",
    rotulo: "Devolvidos",
    descricao: "Relatório recusado pelo pós-venda, esperando o profissional corrigir.",
    onde: { status: "REALIZADO", relatorio: { is: { aprovadoEm: null, devolvidoEm: { not: null } } } },
  },
  {
    chave: "fechados",
    rotulo: "Fechados",
    descricao: "Realizados e faltas.",
    onde: { status: { in: ["REALIZADO", "FALTOU"] satisfies StatusPedido[] } },
  },
  {
    chave: "cancelados",
    rotulo: "Cancelados",
    descricao: "Cancelados pela clínica ou pela equipe.",
    onde: { status: "CANCELADO" },
  },
  {
    chave: "todos",
    rotulo: "Todos",
    descricao: "A esteira inteira, sem recorte.",
    onde: {},
  },
];

const PARADOS = ETAPAS[0];
const TRIAGEM = ETAPAS[1];

/**
 * A etapa em que a esteira abre para este perfil.
 *
 * ATENDENTE abre na triagem junto com COMERCIAL: é a mesma mesa (receber,
 * filtrar, confirmar), e o que separa os dois é o que podem fazer depois, não
 * o que precisam ver primeiro.
 *
 * GESTAO e RESPONSAVEL não têm fila própria de propósito — quem responde pela
 * operação inteira abre em TUDO que está parado, não numa etapa só: é a
 * pergunta "o que está atrasado hoje", não "o que é meu".
 */
export function etapaDoPerfil(perfil: PerfilInterno): Etapa {
  const daPessoa = ETAPAS.find((etapa) => etapa.dono === perfil);
  if (daPessoa) return daPessoa;
  return perfil === "ATENDENTE" ? TRIAGEM : PARADOS;
}

export function etapaPorChave(chave: string | undefined): Etapa | undefined {
  return ETAPAS.find((etapa) => etapa.chave === chave);
}
