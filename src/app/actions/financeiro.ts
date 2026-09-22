"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirInterno, exigirResponsavel, registrarAuditoria } from "@/lib/sessao";
import { parametros } from "@/lib/alocacao";
import { competenciaPorExtenso } from "@/lib/data";
import { perfilPermite } from "@/lib/papeis";
import type { Resultado } from "./pedidos";

/**
 * Fechamento do mês.
 *
 * Duas contas independentes, e é assim que a tela mostra: o que a clínica
 * deve (a receber) e o que o profissional tem a receber (a pagar). Juntar as
 * duas num "saldo" esconde exatamente o número que a operação precisa
 * acompanhar — a margem por atendimento.
 */

/**
 * Fecha a fatura de uma clínica na competência.
 *
 * Só entram pedidos REALIZADOS. Falta não vira cobrança: não houve serviço.
 * Se a operação decidir cobrar uma falta, isso é negociação e entra como
 * lançamento à parte — não pode ser efeito automático de um status.
 */
export async function fecharFatura(clinicaId: string, competencia: string): Promise<Resultado> {
  const sessao = await exigirResponsavel();

  const pedidos = await prisma.pedido.findMany({
    where: {
      clinicaId,
      status: "REALIZADO",
      faturaId: null,
      data: {
        gte: new Date(`${competencia}-01T00:00:00.000Z`),
        lt: proximaCompetencia(competencia),
      },
    },
    select: { id: true, valorServicoCentavos: true },
  });

  if (pedidos.length === 0) {
    return { ok: false, erro: `Nenhum atendimento realizado a faturar em ${competenciaPorExtenso(competencia)}.` };
  }

  const jaFechada = await prisma.fatura.findUnique({
    where: { clinicaId_competencia: { clinicaId, competencia } },
    select: { id: true },
  });
  if (jaFechada) {
    return { ok: false, erro: "Essa competência já tem fatura. Reabra antes de fechar de novo." };
  }

  const config = await parametros();
  const valorCentavos = pedidos.reduce((soma, p) => soma + p.valorServicoCentavos, 0);

  const fatura = await prisma.$transaction(async (tx) => {
    const atualizado = await tx.parametros.update({
      where: { id: "hemoderi" },
      data: { proximoNumeroFatura: { increment: 1 } },
      select: { proximoNumeroFatura: true },
    });

    const criada = await tx.fatura.create({
      data: {
        numero: atualizado.proximoNumeroFatura - 1,
        clinicaId,
        competencia,
        valorCentavos,
        vencimento: new Date(Date.now() + config.prazoFaturamentoDias * 24 * 60 * 60 * 1000),
      },
    });

    // Amarra os pedidos à fatura para que um segundo fechamento não cobre a
    // mesma coisa duas vezes.
    await tx.pedido.updateMany({
      where: { id: { in: pedidos.map((p) => p.id) } },
      data: { faturaId: criada.id },
    });

    return criada;
  });

  await registrarAuditoria(
    sessao.usuarioId,
    "Fatura",
    fatura.id,
    "fechar",
    `${pedidos.length} pedido(s), competência ${competencia}`
  );

  revalidatePath("/painel/financeiro");
  return { ok: true };
}

function proximaCompetencia(competencia: string): Date {
  const [ano, mes] = competencia.split("-").map(Number);
  return new Date(Date.UTC(mes === 12 ? ano + 1 : ano, mes === 12 ? 0 : mes, 1));
}

export async function baixarFatura(faturaId: string): Promise<Resultado> {
  const sessao = await exigirResponsavel();
  await prisma.fatura.update({
    where: { id: faturaId },
    data: { status: "PAGA", pagaEm: new Date() },
  });
  await registrarAuditoria(sessao.usuarioId, "Fatura", faturaId, "baixar");
  revalidatePath("/painel/financeiro");
  return { ok: true };
}

/**
 * Baixa os repasses de um profissional na competência.
 *
 * Em lote porque o pagamento é um PIX só no fim do mês — marcar atendimento
 * por atendimento seria transformar uma transferência em quarenta cliques.
 */
export async function pagarRepasses(profissionalId: string, competencia: string): Promise<Resultado> {
  const sessao = await exigirResponsavel();

  const { count } = await prisma.repasse.updateMany({
    where: { profissionalId, competencia, status: "PENDENTE" },
    data: { status: "PAGO", pagoEm: new Date() },
  });

  if (count === 0) return { ok: false, erro: "Nada pendente nessa competência." };

  await registrarAuditoria(
    sessao.usuarioId,
    "Repasse",
    profissionalId,
    "pagar",
    `${count} repasse(s), competência ${competencia}`
  );

  revalidatePath("/painel/financeiro");
  revalidatePath("/profissional/ganhos");
  return { ok: true };
}

/**
 * A equipe confere o relatório e libera o repasse.
 *
 * É o passo que a ata de 14/09 separou do envio: em campo o procedimento
 * muda (membrana que virou stickbone, quantidade diferente da combinada), e
 * quem confere isso é a operação, não quem executou. Antes da aprovação o
 * valor existe e é visível — só não entra na fila de pagamento.
 *
 * Pós-venda (Stephanie) é quem confere na prática, ata de 21/09 — daí
 * `exigirInterno` em vez de `exigirResponsavel` aqui, com a checagem de
 * perfil logo abaixo.
 */
export async function aprovarRelatorio(pedidoId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "POS_VENDA")) {
    return { ok: false, erro: "Só o pós-venda aprova relatório." };
  }

  const relatorio = await prisma.relatorioAtendimento.findUnique({
    where: { pedidoId },
    select: { id: true, aprovadoEm: true, compareceu: true },
  });
  if (!relatorio) return { ok: false, erro: "Este atendimento ainda não tem relatório." };
  if (relatorio.aprovadoEm) return { ok: false, erro: "Relatório já aprovado." };

  await prisma.$transaction(async (tx) => {
    await tx.relatorioAtendimento.update({
      where: { id: relatorio.id },
      data: { aprovadoEm: new Date(), aprovadoPorId: sessao.usuarioId },
    });

    // Falta não gera repasse automático — a aprovação confirma o relatório,
    // não cria pagamento onde a regra não prevê.
    if (relatorio.compareceu) {
      await tx.repasse.updateMany({
        where: { pedidoId, status: "AGUARDANDO_APROVACAO" },
        data: { status: "PENDENTE" },
      });
    }
  });

  await registrarAuditoria(sessao.usuarioId, "Pedido", pedidoId, "aprovar-relatorio");

  revalidatePath("/painel/financeiro");
  revalidatePath("/profissional/ganhos");
  return { ok: true };
}
