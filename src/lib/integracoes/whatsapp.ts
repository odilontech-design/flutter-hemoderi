/**
 * Fila de saída do WhatsApp.
 *
 * Quem envia é a central de atendimento (Dilon Zap, Frente 1 da proposta);
 * este módulo só decide O QUE precisa ser dito, grava na fila e entrega.
 *
 * A mensagem é gravada ANTES do envio, e a unicidade (pedido × tipo) está no
 * banco. É o que garante que a rotina de lembretes possa rodar de hora em hora
 * sem mandar o mesmo lembrete duas vezes, e que uma falha de rede fique
 * visível para reenvio em vez de sumir.
 */

import { prisma } from "@/lib/prisma";
import { formatarData, instanteDoAtendimento } from "@/lib/data";
import { corpoParaDilonZap, interpretarResposta, mensagemVencida } from "@/lib/integracoes/dilon-zap";
import { codigoDoPedido } from "@/lib/numeracao";
import { normalizarTelefone } from "@/lib/slug";
import type { TipoMensagem } from "@prisma/client";

type DadosPedido = {
  id: string;
  numero: number;
  data: Date;
  horaInicio: string;
  clinica: { nome: string; telefone: string | null };
  servico: { nome: string };
  profissional: { nome: string; telefone: string | null } | null;
};

/**
 * Os textos. Ficam no código, e não no banco, enquanto forem poucos e
 * estáveis — vale trocar por cadastro quando a equipe pedir a segunda
 * variação. Os modelos reais que a Hemoderi usa hoje entram na Fase 0
 * (docs/fase-0-insumos.md); estes são o esqueleto até lá.
 */
function montarTexto(tipo: TipoMensagem, pedido: DadosPedido): string {
  const quando = `${formatarData(pedido.data)} às ${pedido.horaInicio}`;
  const codigo = codigoDoPedido(pedido.numero, pedido.clinica.nome, pedido.data);

  switch (tipo) {
    case "CONFIRMACAO":
      return `Olá, ${pedido.clinica.nome}! Confirmamos o atendimento de ${pedido.servico.nome} em ${quando}. Agendamento ${codigo}.`;
    case "ALOCACAO":
      // A notificação de alocação NÃO diz a clínica (ata de 14/09): sabendo o
      // endereço na hora do convite, atendimento longe é recusado e sobra
      // sempre para os mesmos. O local vem no lembrete, com tempo de se
      // organizar.
      return `Olá, ${pedido.profissional?.nome ?? ""}! Você foi alocado para ${pedido.servico.nome} em ${quando}. A clínica é informada na véspera. Agendamento ${codigo}.`;
    case "LEMBRETE":
      return `Lembrete: ${pedido.servico.nome} na ${pedido.clinica.nome} amanhã, ${quando}. Agendamento ${codigo}.`;
    case "RESULTADO":
      return `Atendimento ${codigo} (${pedido.servico.nome}, ${quando}) finalizado. Obrigado!`;
  }
}

function destinatarioDe(tipo: TipoMensagem, pedido: DadosPedido): string {
  const alvo = tipo === "ALOCACAO" ? pedido.profissional?.telefone : pedido.clinica.telefone;
  return normalizarTelefone(alvo);
}

/**
 * Coloca a mensagem na fila. Silenciosa quando já existe uma do mesmo tipo
 * para o mesmo pedido — reenviar é ação explícita da equipe, não efeito
 * colateral de salvar o pedido de novo.
 */
export async function enfileirarMensagem(
  pedidoId: string,
  tipo: TipoMensagem,
  agendadaPara?: Date
): Promise<void> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: {
      id: true,
      numero: true,
      data: true,
      horaInicio: true,
      clinica: { select: { nome: true, telefone: true } },
      servico: { select: { nome: true } },
      profissional: { select: { nome: true, telefone: true } },
    },
  });
  if (!pedido) return;

  const destinatario = destinatarioDe(tipo, pedido);
  // Sem telefone não há o que enfileirar. Não é erro: cadastro incompleto é
  // rotina, e travar o agendamento por causa disso seria pior.
  if (!destinatario) return;

  const mensagem = await prisma.mensagemWhatsapp.upsert({
    where: { pedidoId_tipo: { pedidoId, tipo } },
    update: {},
    create: {
      pedidoId,
      tipo,
      destinatario,
      texto: montarTexto(tipo, pedido),
      agendadaPara,
    },
    select: { id: true, status: true, agendadaPara: true },
  });

  // Sai na hora, sem esperar a rotina diária (que roda uma vez por dia, às 7h):
  // a confirmação de um agendamento feito à tarde não pode chegar na manhã
  // seguinte. Falha aqui nunca derruba quem enfileirou — a mensagem fica na
  // fila e a rotina tenta de novo.
  const vencida = !mensagem.agendadaPara || mensagem.agendadaPara.getTime() <= Date.now();
  if (mensagem.status === "PENDENTE" && vencida && process.env.WHATSAPP_API_URL) {
    await despacharPendentes(1, mensagem.id).catch(() => undefined);
  }
}

/**
 * Entrega as mensagens vencidas pela API de integração do Dilon Zap
 * (lib/integracoes/dilon-zap.ts). Chamada pela rotina agendada
 * (app/api/rotinas/mensagens).
 *
 * WHATSAPP_API_URL é o endereço completo do endpoint
 * (https://zap.dilontech.com.br/api/integracao/mensagens) e WHATSAPP_API_TOKEN
 * a chave `dz_...` da Hemoderi no Dilon Zap. Sem a URL, as mensagens ficam
 * PENDENTE e visíveis na tela — melhor uma fila parada e visível do que um
 * envio fingido.
 */
export async function despacharPendentes(
  limite = 50,
  /** Só esta mensagem — o envio imediato logo depois de enfileirar. */
  somenteId?: string
): Promise<{ enviadas: number; falhas: number; canceladas: number; interrompido?: string }> {
  const url = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!url) return { enviadas: 0, falhas: 0, canceladas: 0 };

  const agora = new Date();
  const pendentes = await prisma.mensagemWhatsapp.findMany({
    where: {
      status: "PENDENTE",
      OR: [{ agendadaPara: null }, { agendadaPara: { lte: agora } }],
      ...(somenteId ? { id: somenteId } : {}),
    },
    take: limite,
    orderBy: { criadaEm: "asc" },
    include: {
      pedido: {
        select: {
          data: true,
          horaInicio: true,
          clinica: { select: { nome: true } },
          profissional: { select: { nome: true } },
        },
      },
    },
  });

  let enviadas = 0;
  let falhas = 0;
  let canceladas = 0;

  for (const mensagem of pendentes) {
    const inicio = mensagem.pedido ? instanteDoAtendimento(mensagem.pedido.data, mensagem.pedido.horaInicio) : null;
    if (mensagemVencida({ tipo: mensagem.tipo, criadaEm: mensagem.criadaEm, inicioDoAtendimento: inicio, agora })) {
      await prisma.mensagemWhatsapp.update({
        where: { id: mensagem.id },
        data: { status: "CANCELADA", erro: "Não enviada: o atendimento já passou e a mensagem perdeu o sentido." },
      });
      canceladas++;
      continue;
    }

    const nome = mensagem.tipo === "ALOCACAO" ? mensagem.pedido?.profissional?.nome : mensagem.pedido?.clinica.nome;
    let desfecho: ReturnType<typeof interpretarResposta>;
    try {
      const resposta = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(corpoParaDilonZap({ ...mensagem, nome })),
        // Curto no envio imediato: quem está salvando um agendamento não espera
        // o Dilon Zap; se demorar, a rotina entrega depois.
        signal: AbortSignal.timeout(somenteId ? 5_000 : 15_000),
      });
      desfecho = interpretarResposta(resposta.status, await resposta.json().catch(() => null));
    } catch (erro) {
      // Rede ou tempo esgotado: problema da integração, não da mensagem.
      desfecho = { resultado: "parar", erro: `Dilon Zap fora do alcance: ${erro instanceof Error ? erro.message : String(erro)}` };
    }

    if (desfecho.resultado === "enviada") {
      await prisma.mensagemWhatsapp.update({
        where: { id: mensagem.id },
        data: { status: "ENVIADA", enviadaEm: new Date(), erro: null },
      });
      enviadas++;
    } else if (desfecho.resultado === "falha") {
      await prisma.mensagemWhatsapp.update({
        where: { id: mensagem.id },
        data: { status: "FALHA", erro: desfecho.erro },
      });
      falhas++;
    } else {
      // Continua PENDENTE, com o motivo à vista; a próxima rodada tenta de novo.
      await prisma.mensagemWhatsapp.update({ where: { id: mensagem.id }, data: { erro: desfecho.erro } });
      return { enviadas, falhas, canceladas, interrompido: desfecho.erro };
    }
  }

  return { enviadas, falhas, canceladas };
}
