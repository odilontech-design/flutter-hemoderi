import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatarData } from "@/lib/data";
import { numeroDoPedido } from "@/lib/numeracao";
import { normalizarTelefone } from "@/lib/slug";
import { urlBase } from "@/lib/divulgacao";
import { despacharPendentes } from "@/lib/integracoes/whatsapp";

/**
 * Aviso automático ao profissional quando o atendimento dele muda (ata de
 * 03/11: "a movimentação ou o cancelamento de um procedimento envia um aviso
 * para o profissional anterior verificar a agenda" — as divergências com a
 * logística vinham daí). Tira uma foto dos pedidos antes da ação e compara com
 * o depois: quem saiu do caso, teve o atendimento cancelado ou viu data,
 * horário, serviço ou local mudarem recebe um WhatsApp.
 *
 * Nunca derruba a ação que o disparou: falha de envio fica na fila da tela de
 * integrações, como qualquer outra mensagem.
 */

export type FotoDoPedido = {
  id: string;
  profissionalId: string | null;
  status: string;
  data: Date;
  horaInicio: string;
  servicoId: string;
  enderecoId: string | null;
};

export type Mudanca = "cancelado" | "removido" | "alterado";

const SELECAO = { id: true, profissionalId: true, status: true, data: true, horaInicio: true, servicoId: true, enderecoId: true } as const;

export async function fotografar(onde: Prisma.PedidoWhereInput): Promise<FotoDoPedido[]> {
  return prisma.pedido.findMany({ where: onde, select: SELECAO });
}

/** A visita inteira de um pedido (os serviços do mesmo grupo). */
export async function ondeDaVisita(pedidoId: string): Promise<Prisma.PedidoWhereInput> {
  const p = await prisma.pedido.findUnique({ where: { id: pedidoId }, select: { grupoId: true } });
  return p?.grupoId ? { grupoId: p.grupoId } : { id: pedidoId };
}

/** O que mudou para o profissional que estava no atendimento. Null quando nada que ele precise saber. */
export function mudancaParaProfissional(antes: FotoDoPedido, depois: FotoDoPedido | undefined): Mudanca | null {
  if (!antes.profissionalId) return null;
  if (["REALIZADO", "FALTOU", "CANCELADO"].includes(antes.status)) return null;
  if (!depois || depois.status === "CANCELADO") return "cancelado";
  if (depois.profissionalId !== antes.profissionalId) return "removido";
  const mudou =
    depois.data.getTime() !== antes.data.getTime() ||
    depois.horaInicio !== antes.horaInicio ||
    depois.servicoId !== antes.servicoId ||
    depois.enderecoId !== antes.enderecoId;
  return mudou ? "alterado" : null;
}

export function textoDoAviso(
  mudanca: Mudanca,
  d: { nome: string; servico: string; antes: { data: Date; hora: string }; depois?: { data: Date; hora: string }; codigo: string; link: string }
): string {
  const primeiro = d.nome.split(" ")[0] ?? "";
  const quando = `${formatarData(d.antes.data)} às ${d.antes.hora}`;
  const conferir = `Confira sua agenda no app: ${d.link}. Agendamento ${d.codigo}.`;
  if (mudanca === "cancelado") return `Olá, ${primeiro}! O atendimento de ${d.servico} de ${quando} foi CANCELADO. ${conferir}`;
  if (mudanca === "removido") return `Olá, ${primeiro}! Você não está mais alocado(a) no atendimento de ${d.servico} de ${quando}. ${conferir}`;
  const novo = d.depois ? `${formatarData(d.depois.data)} às ${d.depois.hora}` : "";
  const mudouHorario = d.depois && (d.depois.data.getTime() !== d.antes.data.getTime() || d.depois.hora !== d.antes.hora);
  return mudouHorario
    ? `Olá, ${primeiro}! O atendimento de ${d.servico} mudou de ${quando} para ${novo}. ${conferir}`
    : `Olá, ${primeiro}! O atendimento de ${d.servico} de ${quando} foi alterado (serviço ou local). ${conferir}`;
}

export async function avisarProfissionaisAfetados(antes: FotoDoPedido[]): Promise<void> {
  if (antes.length === 0) return;
  const depois = new Map((await fotografar({ id: { in: antes.map((a) => a.id) } })).map((p) => [p.id, p]));
  for (const foto of antes) {
    try {
      const mudanca = mudancaParaProfissional(foto, depois.get(foto.id));
      if (!mudanca || !foto.profissionalId) continue;
      const [profissional, pedido] = await Promise.all([
        prisma.profissional.findUnique({ where: { id: foto.profissionalId }, select: { nome: true, telefone: true } }),
        prisma.pedido.findUnique({ where: { id: foto.id }, select: { numero: true, data: true, horaInicio: true, clinica: { select: { nome: true } }, servico: { select: { nome: true } } } }),
      ]);
      const destinatario = normalizarTelefone(profissional?.telefone);
      if (!profissional || !pedido || !destinatario) continue;
      const codigo = numeroDoPedido(pedido.numero, pedido.data);
      const texto = textoDoAviso(mudanca, {
        nome: profissional.nome,
        servico: pedido.servico.nome,
        antes: { data: foto.data, hora: foto.horaInicio },
        depois: { data: pedido.data, hora: pedido.horaInicio },
        codigo,
        link: `${urlBase()}/profissional`,
      });
      const mensagem = await prisma.mensagemWhatsapp.upsert({
        where: { pedidoId_tipo: { pedidoId: foto.id, tipo: "AVISO_PROFISSIONAL" } },
        update: { destinatario, texto, status: "PENDENTE", erro: null, enviadaEm: null, agendadaPara: null },
        create: { pedidoId: foto.id, tipo: "AVISO_PROFISSIONAL", destinatario, texto },
        select: { id: true },
      });
      if (process.env.WHATSAPP_API_URL) await despacharPendentes(1, mensagem.id);
    } catch (erro) {
      console.error("aviso ao profissional", foto.id, erro);
    }
  }
}
