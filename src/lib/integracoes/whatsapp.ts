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
import { formatarData } from "@/lib/data";
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

  switch (tipo) {
    case "CONFIRMACAO":
      return `Olá, ${pedido.clinica.nome}! Confirmamos o atendimento de ${pedido.servico.nome} em ${quando}. Pedido ${pedido.numero}.`;
    case "ALOCACAO":
      return `Olá, ${pedido.profissional?.nome ?? ""}! Você foi alocado para ${pedido.servico.nome} na ${pedido.clinica.nome} em ${quando}. Pedido ${pedido.numero}.`;
    case "LEMBRETE":
      return `Lembrete: ${pedido.servico.nome} na ${pedido.clinica.nome} amanhã, ${quando}. Pedido ${pedido.numero}.`;
    case "RESULTADO":
      return `Atendimento do pedido ${pedido.numero} (${pedido.servico.nome}, ${quando}) finalizado. Obrigado!`;
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

  await prisma.mensagemWhatsapp.upsert({
    where: { pedidoId_tipo: { pedidoId, tipo } },
    update: {},
    create: {
      pedidoId,
      tipo,
      destinatario,
      texto: montarTexto(tipo, pedido),
      agendadaPara,
    },
  });
}

/**
 * Entrega as mensagens vencidas. Chamada pela rotina agendada
 * (app/api/rotinas/mensagens).
 *
 * Sem WHATSAPP_API_URL configurada — o estado do projeto até a Fase 4 — as
 * mensagens ficam PENDENTE e visíveis na tela. Melhor uma fila parada e
 * visível do que um envio fingido.
 */
export async function despacharPendentes(limite = 50): Promise<{ enviadas: number; falhas: number }> {
  const url = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!url) return { enviadas: 0, falhas: 0 };

  const pendentes = await prisma.mensagemWhatsapp.findMany({
    where: {
      status: "PENDENTE",
      OR: [{ agendadaPara: null }, { agendadaPara: { lte: new Date() } }],
    },
    take: limite,
    orderBy: { criadaEm: "asc" },
  });

  let enviadas = 0;
  let falhas = 0;

  for (const mensagem of pendentes) {
    try {
      const resposta = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ para: mensagem.destinatario, texto: mensagem.texto }),
      });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

      await prisma.mensagemWhatsapp.update({
        where: { id: mensagem.id },
        data: { status: "ENVIADA", enviadaEm: new Date(), erro: null },
      });
      enviadas++;
    } catch (erro) {
      await prisma.mensagemWhatsapp.update({
        where: { id: mensagem.id },
        data: { status: "FALHA", erro: erro instanceof Error ? erro.message : String(erro) },
      });
      falhas++;
    }
  }

  return { enviadas, falhas };
}
