import type { Prisma, PerfilInterno, StatusPedido } from "@prisma/client";
import { hojeUTC } from "@/lib/data";

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
    descricao: "Tudo que espera alguém da equipe — para confirmar, para alocar e para conferir, somados.",
    // A soma das três filas da equipe (ata de 20/10): antes ficava de fora o
    // relatório esperando conferência, e o número não batia com as abas.
    onde: { OR: [{ status: { in: ["SOLICITADO", "CONFIRMADO"] satisfies StatusPedido[] } }, PENDENTE_DE_CONFERENCIA] },
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
    descricao: "Com profissional indicado, de hoje em diante.",
    // Getter: "hoje" é calculado a cada leitura, não uma vez no boot do servidor.
    get onde(): Prisma.PedidoWhereInput {
      return { status: "ALOCADO", data: { gte: hojeUTC() } };
    },
  },
  {
    chave: "aguardando-aceite",
    rotulo: "Aguardando aceite",
    descricao: "Alocados, de hoje em diante, cujo profissional ainda não deu o aceite — só quem falta.",
    dono: "LOGISTICA",
    get onde(): Prisma.PedidoWhereInput {
      return { status: "ALOCADO", aceitoEm: null, data: { gte: hojeUTC() } };
    },
  },
  {
    chave: "conferir",
    rotulo: "Para conferir",
    descricao: "Atendido, com relatório aguardando a conferência do pós-venda.",
    dono: "POS_VENDA",
    onde: PENDENTE_DE_CONFERENCIA,
  },
  {
    chave: "sem-relatorio",
    rotulo: "Sem relatório",
    descricao: "O dia do atendimento passou e o profissional ainda não enviou o relatório — cobrar.",
    // Revisão de 25/10: 19 atendimentos passados seguiam "alocados", sem
    // relatório, misturados aos futuros. Sem relatório não há conferência,
    // repasse nem cobrança — e ninguém via. O pós-venda é quem cobra.
    get onde(): Prisma.PedidoWhereInput {
      return { status: "ALOCADO", data: { lt: hojeUTC() } };
    },
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

/**
 * As etapas que cada perfil vê na esteira (ata de 02/10): separação estrita de
 * responsabilidades. A Ana aprova as solicitações, a Joyce cuida da logística
 * e da alocação, a Stephanie confere os relatórios e as avaliações — cada uma
 * olha a própria fila e o que precisa para acompanhar o resto, sem as abas dos
 * outros setores competindo por atenção.
 *
 * Quem atende o telefone (comercial e atendente) mantém "Todos" só para
 * consultar: a clínica liga perguntando por um pedido e a resposta não pode
 * depender de pedir ajuda ao setor dono. O que se PODE FAZER continua sendo
 * decidido no servidor, por ação (actions/pedidos.ts) — esconder a aba é
 * organização, não segurança.
 *
 * Gestão e responsável veem tudo: supervisionam a operação inteira.
 */
const ETAPAS_DO_PERFIL: Partial<Record<PerfilInterno, string[]>> = {
  COMERCIAL: ["triagem", "alocados", "fechados", "cancelados", "todos"],
  ATENDENTE: ["triagem", "alocados", "fechados", "cancelados", "todos"],
  LOGISTICA: ["alocar", "alocados", "aguardando-aceite", "sem-relatorio", "cancelados"],
  // Desde a ata de 20/10 o pós-venda também lança e confirma os pedidos do dia.
  POS_VENDA: ["conferir", "sem-relatorio", "devolvidos", "triagem", "fechados", "todos"],
};

export function etapasDoPerfil(perfil: PerfilInterno): Etapa[] {
  const chaves = ETAPAS_DO_PERFIL[perfil];
  if (!chaves) return ETAPAS;
  return ETAPAS.filter((etapa) => chaves.includes(etapa.chave));
}
