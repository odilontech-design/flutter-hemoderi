import { prisma } from "@/lib/prisma";
import { comEnderecoDoPedido } from "@/lib/endereco";
import { hojeUTC } from "@/lib/data";
import {
  agendaDaEquipe,
  integracaoConfigurada,
  transporteGoogle,
  type TransporteAgenda,
} from "./google-api";
import { agendaAlvo, deveTerEvento, deveTerEventoDoProfissional, montarEvento, montarEventoDaEquipe, planejar } from "./google-evento";

export * from "./google-evento";

/**
 * Publica o atendimento na agenda do Google de quem vai atender.
 *
 * O ponto é o profissional abrir o celular dele e o compromisso estar lá, com
 * o lembrete dele — não uma agenda da operação que ele teria que ir consultar.
 * Por isso o destino padrão é `Profissional.googleAgendaId` (a agenda dele,
 * compartilhada com a conta de serviço), e GOOGLE_AGENDA_ID é só a rede de
 * segurança de quem ainda não conectou a sua.
 *
 * A decisão inteira — o que publicar, onde, criar/atualizar/mover/apagar —
 * está em google-evento.ts, sem banco e sem rede. Aqui fica só a execução: ler
 * o pedido, pedir o plano, aplicar, guardar o rastro.
 */

const SELECAO = {
  id: true,
  numero: true,
  data: true,
  horaInicio: true,
  duracaoMin: true,
  status: true,
  pacienteNome: true,
  observacoes: true,
  googleEventoId: true,
  googleAgendaId: true,
  aceitoEm: true,
  googleEventoEquipeId: true,
  doutorNome: true,
  valorServicoCentavos: true,
  formaPagamento: true,
  procedimentoPaciente: true,
  clinica: { select: { nome: true, endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true, cep: true } },
  endereco: { select: { endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true, cep: true } },
  servico: { select: { nome: true } },
  profissional: { select: { nome: true, googleAgendaId: true } },
} as const;

async function registrar(
  pedidoId: string,
  acao: string,
  sucesso: boolean,
  referencia?: string | null,
  erro?: string
): Promise<void> {
  await prisma.sincronizacaoExterna.create({
    data: {
      sistema: "GOOGLE_AGENDA",
      entidade: "Pedido",
      entidadeId: pedidoId,
      acao,
      sucesso,
      referencia: referencia ?? null,
      erro: erro?.slice(0, 500),
    },
  });
}

/**
 * Põe a agenda do Google de acordo com o pedido.
 *
 * NUNCA lança. É chamada no fim de criar, confirmar, alocar, reagendar e
 * cancelar, e uma indisponibilidade do Google não pode desfazer um
 * agendamento que já está no banco — o atendimento existe, o evento é uma
 * projeção dele. O que não deu certo fica em SincronizacaoExterna, e o painel
 * avisa quando isso começa a acontecer.
 */
export async function sincronizarEvento(
  pedidoId: string,
  transporte: TransporteAgenda = transporteGoogle,
  agendaPadrao: string | null = null
): Promise<void> {
  await sincronizarEventoDoProfissional(pedidoId, transporte, agendaPadrao);
  await sincronizarEventoDaEquipe(pedidoId, transporte);
}

/** A cópia do atendimento na agenda da equipe. Nunca lança, como a outra. */
async function sincronizarEventoDaEquipe(pedidoId: string, transporte: TransporteAgenda): Promise<void> {
  const agenda = agendaDaEquipe();
  if (!agenda || !integracaoConfigurada()) return;
  const encontrado = await prisma.pedido.findUnique({ where: { id: pedidoId }, select: SELECAO });
  if (!encontrado) return;
  const pedido = { ...encontrado, clinica: comEnderecoDoPedido(encontrado.clinica, encontrado.endereco) };
  const plano = planejar(
    { eventoId: pedido.googleEventoEquipeId, agendaId: pedido.googleEventoEquipeId ? agenda : null },
    { agendaId: agenda, deveExistir: deveTerEvento(pedido.status) }
  );
  try {
    if (plano.acao === "criar") {
      const eventoId = await transporte.criar(agenda, montarEventoDaEquipe(pedido, true));
      // "Salvo" só existe depois de salvo de verdade na agenda compartilhada
      // (pedido de 06/11): ninguém mais confirma à mão.
      await prisma.pedido.update({
        where: { id: pedido.id },
        data: { googleEventoEquipeId: eventoId, agendaSalvaEm: new Date(), agendaSalvaPor: "automático" },
      });
      await registrar(pedido.id, "criar-equipe", true, eventoId);
    } else if (plano.acao === "atualizar") {
      await transporte.atualizar(agenda, plano.eventoId, montarEventoDaEquipe(pedido, false));
      await prisma.pedido.update({ where: { id: pedido.id }, data: { agendaSalvaEm: new Date(), agendaSalvaPor: "automático" } });
    } else if (plano.acao === "apagar") {
      await transporte.apagar(agenda, plano.eventoId);
      await prisma.pedido.update({
        where: { id: pedido.id },
        data: { googleEventoEquipeId: null, agendaSalvaEm: null, agendaSalvaPor: null },
      });
      await registrar(pedido.id, "apagar-equipe", true, plano.eventoId);
    }
  } catch (erro) {
    await registrar(pedido.id, `${plano.acao}-equipe`, false, null, erro instanceof Error ? erro.message : String(erro));
  }
}

/**
 * "Salvar agora na agenda compartilhada": refaz a sincronização da cópia da
 * equipe e diz o que aconteceu. É a nova tentativa de um salvamento que falhou
 * — não a confirmação manual, que deixou de existir.
 */
export async function salvarNaAgendaDaEquipe(
  pedidoId: string,
  transporte: TransporteAgenda = transporteGoogle
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!agendaDaEquipe()) return { ok: false, erro: "A agenda compartilhada ainda não foi configurada (GOOGLE_AGENDA_EQUIPE_ID)." };
  if (!integracaoConfigurada()) return { ok: false, erro: "A conta de serviço do Google não está configurada." };
  await sincronizarEventoDaEquipe(pedidoId, transporte);
  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, select: { agendaSalvaEm: true } });
  if (pedido?.agendaSalvaEm) return { ok: true };
  const falha = await prisma.sincronizacaoExterna.findFirst({
    where: { sistema: "GOOGLE_AGENDA", entidade: "Pedido", entidadeId: pedidoId, sucesso: false },
    orderBy: { criadaEm: "desc" },
    select: { erro: true },
  });
  return { ok: false, erro: falha?.erro ?? "Não foi possível salvar na agenda compartilhada." };
}

/**
 * Põe na agenda compartilhada os atendimentos que já estavam confirmados antes
 * da integração ligar (e os que falharam): CONFIRMADO ou ALOCADO, de hoje em
 * diante, ainda sem evento da equipe. Em lotes pequenos — cada evento é uma
 * ida ao Google —, do mais próximo ao mais distante; a tela chama de novo com
 * `aPartirDe` (a data+número do último) até acabar, então uma falha não
 * prende o lote numa volta infinita.
 */
export async function salvarPendentesNaAgendaDaEquipe(
  limite = 15,
  aPartirDe?: number,
  transporte: TransporteAgenda = transporteGoogle
): Promise<{ feitos: number; falhas: string[]; ultimo: number | null; restam: number }> {
  if (!agendaDaEquipe()) return { feitos: 0, falhas: ["A agenda compartilhada ainda não foi configurada (GOOGLE_AGENDA_EQUIPE_ID)."], ultimo: null, restam: 0 };
  if (!integracaoConfigurada()) return { feitos: 0, falhas: ["A conta de serviço do Google não está configurada."], ultimo: null, restam: 0 };
  const hoje = hojeUTC();
  const filtro = {
    status: { in: ["CONFIRMADO", "ALOCADO"] as ("CONFIRMADO" | "ALOCADO")[] },
    data: { gte: hoje },
    googleEventoEquipeId: null,
  };
  const pedidos = await prisma.pedido.findMany({
    where: { ...filtro, ...(aPartirDe ? { numero: { gt: aPartirDe } } : {}) },
    orderBy: { numero: "asc" },
    take: limite,
    select: { id: true, numero: true },
  });
  let feitos = 0;
  const falhas: string[] = [];
  for (const p of pedidos) {
    const r = await salvarNaAgendaDaEquipe(p.id, transporte);
    if (r.ok) feitos++;
    else falhas.push(`nº ${p.numero}: ${r.erro.slice(0, 160)}`);
  }
  const ultimo = pedidos.at(-1)?.numero ?? null;
  const restam = ultimo ? await prisma.pedido.count({ where: { ...filtro, numero: { gt: ultimo } } }) : 0;
  return { feitos, falhas, ultimo, restam };
}

async function sincronizarEventoDoProfissional(
  pedidoId: string,
  transporte: TransporteAgenda,
  agendaPadrao: string | null
): Promise<void> {
  const encontrado = await prisma.pedido.findUnique({ where: { id: pedidoId }, select: SELECAO });
  const pedido = encontrado && { ...encontrado, clinica: comEnderecoDoPedido(encontrado.clinica, encontrado.endereco) };
  if (!pedido) return;

  const plano = planejar(
    { eventoId: pedido.googleEventoId, agendaId: pedido.googleAgendaId },
    // Na agenda de quem atende só depois do ACEITE no portal (12/11), e só se
    // o profissional conectou a dele: sem isso a agenda dele não é da operação.
    { agendaId: agendaAlvo(pedido, agendaPadrao), deveExistir: deveTerEventoDoProfissional(pedido.status, Boolean(pedido.aceitoEm)) }
  );
  if (plano.acao === "nada") return;

  if (!integracaoConfigurada()) {
    // Registra a intenção em vez de perder silenciosamente: quando a conta de
    // serviço entrar, esta tabela é a lista do que ficou para trás.
    await registrar(pedido.id, plano.acao, false, null, "Integração do Google não configurada.");
    return;
  }

  try {
    if (plano.acao === "criar") {
      const eventoId = await transporte.criar(plano.agendaId, montarEvento(pedido));
      await prisma.pedido.update({
        where: { id: pedido.id },
        data: { googleEventoId: eventoId, googleAgendaId: plano.agendaId },
      });
      await registrar(pedido.id, "criar", true, eventoId);
      return;
    }

    if (plano.acao === "atualizar") {
      await transporte.atualizar(plano.agendaId, plano.eventoId, montarEvento(pedido));
      await registrar(pedido.id, "atualizar", true, plano.eventoId);
      return;
    }

    if (plano.acao === "mover") {
      // Cria antes de apagar: se o apagar falhar, o pior caso é um evento a
      // mais na agenda de quem saiu — visível e corrigível. Na ordem inversa,
      // o pior caso é ninguém ter o compromisso.
      const eventoId = await transporte.criar(plano.paraAgendaId, montarEvento(pedido));
      await prisma.pedido.update({
        where: { id: pedido.id },
        data: { googleEventoId: eventoId, googleAgendaId: plano.paraAgendaId },
      });
      await transporte.apagar(plano.de.agendaId, plano.de.eventoId);
      await registrar(pedido.id, "mover", true, eventoId);
      return;
    }

    await transporte.apagar(plano.agendaId, plano.eventoId);
    await prisma.pedido.update({
      where: { id: pedido.id },
      data: { googleEventoId: null, googleAgendaId: null },
    });
    await registrar(pedido.id, "apagar", true, plano.eventoId);
  } catch (erro) {
    await registrar(
      pedido.id,
      plano.acao,
      false,
      null,
      erro instanceof Error ? erro.message : String(erro)
    );
  }
}

/**
 * Quantas sincronizações falharam nas últimas 24h — o número que o painel usa
 * para avisar que a integração parou. Uma integração que falha calada é pior
 * que integração nenhuma: a equipe continua confiando na agenda do celular.
 */
export async function falhasRecentes(): Promise<number> {
  // Sem a integração configurada não há falha a avisar: o registro "não
  // configurada" é só a lista do que ficou para trás (ver sincronizarEvento).
  // Contá-lo acendia o alerta de "agenda deixou de estar compartilhada" sem
  // nenhuma agenda ligada (29/10).
  if (!integracaoConfigurada()) return 0;
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
  // Só a agenda COMPARTILHADA DA EQUIPE acende o alerta geral. A agenda de
  // cada profissional é opcional e é dele: se ele não compartilhou, o aviso
  // aparece em "Meus dados" dele, não no painel da operação (12/11).
  return prisma.sincronizacaoExterna.count({
    where: {
      sistema: "GOOGLE_AGENDA",
      sucesso: false,
      criadaEm: { gte: desde },
      acao: { endsWith: "-equipe" },
      NOT: { erro: "Integração do Google não configurada." },
    },
  });
}

/**
 * Tentativas de colocar atendimentos na agenda do PRÓPRIO profissional que
 * falharam nos últimos dias — o que "Meus dados" mostra para ele consertar o
 * compartilhamento.
 */
export async function falhasNaAgendaDoProfissional(profissionalId: string, dias = 14): Promise<number> {
  if (!integracaoConfigurada()) return 0;
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const pedidos = await prisma.pedido.findMany({
    where: { profissionalId },
    select: { id: true },
    orderBy: { data: "desc" },
    take: 200,
  });
  if (pedidos.length === 0) return 0;
  return prisma.sincronizacaoExterna.count({
    where: {
      sistema: "GOOGLE_AGENDA",
      sucesso: false,
      criadaEm: { gte: desde },
      entidadeId: { in: pedidos.map((p) => p.id) },
      NOT: { acao: { endsWith: "-equipe" } },
    },
  });
}
