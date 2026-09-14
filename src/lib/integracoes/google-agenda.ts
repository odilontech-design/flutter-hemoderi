import { prisma } from "@/lib/prisma";
import {
  agendaDaOperacao,
  integracaoConfigurada,
  transporteGoogle,
  type TransporteAgenda,
} from "./google-api";
import { agendaAlvo, deveTerEvento, montarEvento, planejar } from "./google-evento";

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
  clinica: { select: { nome: true, endereco: true, cidade: true } },
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
  agendaPadrao: string | null = agendaDaOperacao()
): Promise<void> {
  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, select: SELECAO });
  if (!pedido) return;

  const plano = planejar(
    { eventoId: pedido.googleEventoId, agendaId: pedido.googleAgendaId },
    { agendaId: agendaAlvo(pedido, agendaPadrao), deveExistir: deveTerEvento(pedido.status) }
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
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.sincronizacaoExterna.count({
    where: { sistema: "GOOGLE_AGENDA", sucesso: false, criadaEm: { gte: desde } },
  });
}
