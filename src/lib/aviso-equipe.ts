import { prisma } from "@/lib/prisma";
import { formatarData } from "@/lib/data";
import { numeroDoPedido } from "@/lib/numeracao";
import { normalizarTelefone } from "@/lib/slug";
import { urlBase } from "@/lib/divulgacao";
import { despacharPendentes } from "@/lib/integracoes/whatsapp";

/**
 * Para onde vai o aviso interno de cancelamento: o WhatsApp do responsável
 * (André), em AVISO_CANCELAMENTO_WHATSAPP. Sem ele configurado, nada é
 * enviado — e o registro da falta no sistema não muda.
 */
export function destinoDoAvisoDeCancelamento(): string {
  return normalizarTelefone(process.env.AVISO_CANCELAMENTO_WHATSAPP);
}

export function textoDoAvisoDeCancelamento(d: {
  profissional: string;
  servico: string;
  clinica: string;
  data: Date;
  hora: string;
  codigo: string;
  observacao?: string | null;
  link: string;
}): string {
  return [
    "Aviso de cancelamento: o profissional registrou que o paciente não compareceu.",
    "",
    `Profissional: ${d.profissional}`,
    `Atendimento: ${d.servico} · ${d.clinica}`,
    `Quando: ${formatarData(d.data)} às ${d.hora}`,
    ...(d.observacao ? [`Observação do profissional: ${d.observacao}`] : []),
    "",
    `Cada caso é avaliado por você (deslocamento, espera). Agendamento ${d.codigo}: ${d.link}`,
  ].join("\n");
}

/**
 * Reunião de 16/11: sempre que um profissional registra o cancelamento (o
 * paciente que não aparece vira "falta" com relatório), o André recebe um
 * WhatsApp. Nunca derruba o relatório: se não houver destino ou o envio falhar,
 * a mensagem fica na fila da tela de integrações.
 */
export async function avisarCancelamentoDoProfissional(pedidoId: string, observacao?: string | null): Promise<void> {
  try {
    const destinatario = destinoDoAvisoDeCancelamento();
    if (!destinatario) return;
    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        numero: true,
        data: true,
        horaInicio: true,
        clinica: { select: { nome: true } },
        servico: { select: { nome: true } },
        profissional: { select: { nome: true } },
      },
    });
    if (!pedido) return;
    const texto = textoDoAvisoDeCancelamento({
      profissional: pedido.profissional?.nome ?? "profissional",
      servico: pedido.servico.nome,
      clinica: pedido.clinica.nome,
      data: pedido.data,
      hora: pedido.horaInicio,
      codigo: numeroDoPedido(pedido.numero, pedido.data),
      observacao: observacao?.trim().slice(0, 300) || null,
      link: `${urlBase()}/painel/pedidos/${pedidoId}`,
    });
    const mensagem = await prisma.mensagemWhatsapp.upsert({
      where: { pedidoId_tipo: { pedidoId, tipo: "AVISO_EQUIPE" } },
      update: {},
      create: { pedidoId, tipo: "AVISO_EQUIPE", destinatario, texto },
      select: { id: true },
    });
    if (process.env.WHATSAPP_API_URL) await despacharPendentes(1, mensagem.id);
  } catch (erro) {
    console.error("aviso de cancelamento", pedidoId, erro);
  }
}
