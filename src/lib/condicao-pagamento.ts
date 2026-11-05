import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { instanteDoAtendimento } from "@/lib/data";
import { condicaoValida, type CondicaoPagamento } from "@/lib/pagamento";

/**
 * A condição de pagamento (acordo interno: antecipado, no ato, faturado,
 * cortesia) deixa de ser digitada de novo a cada agendamento (pós-venda,
 * 03/11): ela nasce da condição cadastrada na clínica e, para quem paga o Pix
 * do agendamento antes do atendimento, vira "Antecipado". A equipe continua
 * podendo trocar à mão — só se preenche o que está em branco.
 */

/** A condição do cadastro da clínica, se for uma das válidas. */
export function condicaoInicial(condicaoDaClinica: string | null | undefined): CondicaoPagamento | null {
  const valor = (condicaoDaClinica ?? "").trim();
  return condicaoValida(valor) ? valor : null;
}

/**
 * O que preencher quando o Pix do agendamento é pago. Só age sobre pedido sem
 * condição e só quando o pagamento veio antes do atendimento: pago depois, não
 * dá para dizer se foi no ato ou faturado, e quem decide é a equipe.
 */
export function condicaoAoPagarPix(
  atual: string | null | undefined,
  pagoEm: Date,
  inicioDoAtendimento: Date
): CondicaoPagamento | null {
  if ((atual ?? "").trim()) return null;
  return pagoEm.getTime() <= inicioDoAtendimento.getTime() ? "Antecipado" : null;
}

/** Aplica `condicaoAoPagarPix` aos pedidos do Pix recém-pago. */
export async function preencherCondicaoPeloPix(onde: Prisma.PedidoWhereInput, pagoEm: Date): Promise<number> {
  const pedidos = await prisma.pedido.findMany({
    where: { apoioDeId: null, AND: [onde, { condicaoPagamento: null }] },
    select: { id: true, data: true, horaInicio: true },
  });
  let preenchidos = 0;
  for (const p of pedidos) {
    const condicao = condicaoAoPagarPix(null, pagoEm, instanteDoAtendimento(p.data, p.horaInicio));
    if (!condicao) continue;
    await prisma.pedido.update({ where: { id: p.id }, data: { condicaoPagamento: condicao } });
    preenchidos++;
  }
  return preenchidos;
}
