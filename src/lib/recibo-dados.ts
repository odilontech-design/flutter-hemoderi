import { prisma } from "@/lib/prisma";
import { recebidoNoAto } from "@/lib/recebimento";
import { formatarDataCurta } from "@/lib/data";
import { discriminacaoDoServico, numeroDoRecibo, pagadorDoRecibo, totalDosItens, type ReciboDados } from "@/lib/recibo";

const CLINICA = {
  nome: true,
  cnpj: true,
  financeiroNome: true,
  financeiroDocumento: true,
  endereco: true,
  numero: true,
  complemento: true,
  bairro: true,
  cidade: true,
  uf: true,
  cep: true,
} as const;

export type ResultadoDoRecibo = { ok: true; recibo: ReciboDados } | { ok: false; erro: string };

/**
 * O recibo de uma visita (os serviços do mesmo agendamento), só depois de
 * paga: pelo Pix do agendamento, pela fatura quitada ou recebida no ato pelo
 * profissional. `clinicaId` restringe à clínica logada; a equipe passa null.
 */
export async function reciboDoAgendamento(pedidoId: string, clinicaId: string | null): Promise<ResultadoDoRecibo> {
  const base = await prisma.pedido.findFirst({
    where: { id: pedidoId, ...(clinicaId ? { clinicaId } : {}) },
    select: { id: true, grupoId: true, clinicaId: true },
  });
  if (!base) return { ok: false, erro: "Agendamento não encontrado." };

  const membros = await prisma.pedido.findMany({
    where: base.grupoId ? { grupoId: base.grupoId } : { id: base.id },
    orderBy: [{ horaInicio: "asc" }, { numero: "asc" }],
    include: {
      servico: { select: { nome: true, tipoEquipamento: true } },
      fatura: { select: { status: true, pagaEm: true } },
      relatorio: { select: { recebimento: true, aprovadoEm: true } },
      clinica: { select: CLINICA },
    },
  });
  const ativos = membros.filter((p) => p.status !== "CANCELADO");
  if (ativos.length === 0) return { ok: false, erro: "Agendamento cancelado." };

  const pago = (p: (typeof ativos)[number]) =>
    Boolean(p.pixPagoEm) || p.fatura?.status === "PAGA" || (p.status === "REALIZADO" && recebidoNoAto(p.relatorio?.recebimento));
  if (!ativos.every(pago)) return { ok: false, erro: "O recibo fica disponível depois da confirmação do pagamento." };

  const datas = ativos
    .map((p) => p.pixPagoEm ?? p.fatura?.pagaEm ?? p.relatorio?.aprovadoEm ?? null)
    .filter((d): d is Date => d !== null);
  const emissao = datas.length ? new Date(Math.max(...datas.map((d) => d.getTime()))) : new Date();
  const primeiro = ativos[0];
  const porPix = ativos.every((p) => p.pixPagoEm);

  const itens = ativos.map((p) => ({
    unidade: "Proc",
    quantidade: p.quantidade,
    descricao: discriminacaoDoServico(p.servico),
    unitarioCentavos: p.quantidade > 0 ? Math.round(p.valorServicoCentavos / p.quantidade) : p.valorServicoCentavos,
    totalCentavos: p.valorServicoCentavos,
  }));

  return {
    ok: true,
    recibo: {
      numero: numeroDoRecibo(primeiro.numero, primeiro.data.getUTCFullYear()),
      emissao,
      pagador: pagadorDoRecibo(primeiro.clinica),
      condicao: porPix ? "À vista (Pix)" : "À vista",
      cirurgiao: primeiro.doutorNome ?? null,
      itens,
      totalCentavos: totalDosItens(itens),
    },
  };
}

/** O recibo de uma fatura quitada: um item por atendimento realizado no mês. */
export async function reciboDaFatura(faturaId: string, clinicaId: string | null): Promise<ResultadoDoRecibo> {
  const fatura = await prisma.fatura.findFirst({
    where: { id: faturaId, ...(clinicaId ? { clinicaId } : {}) },
    include: {
      clinica: { select: CLINICA },
      pedidos: {
        where: { status: "REALIZADO" },
        orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
        include: { servico: { select: { nome: true, tipoEquipamento: true } } },
      },
    },
  });
  if (!fatura) return { ok: false, erro: "Fatura não encontrada." };
  if (fatura.status !== "PAGA") return { ok: false, erro: "O recibo fica disponível depois da confirmação do pagamento." };

  const itens = fatura.pedidos.map((p) => ({
    unidade: "Proc",
    quantidade: p.quantidade,
    descricao: `${discriminacaoDoServico(p.servico)} (${formatarDataCurta(p.data)})`,
    unitarioCentavos: p.quantidade > 0 ? Math.round(p.valorServicoCentavos / p.quantidade) : p.valorServicoCentavos,
    totalCentavos: p.valorServicoCentavos,
  }));
  const bruto = totalDosItens(itens);
  // O desconto de cupom entra como linha negativa: o recibo fecha com o valor pago.
  if (fatura.descontoCentavos > 0) {
    itens.push({ unidade: "Desc", quantidade: 1, descricao: "Desconto concedido", unitarioCentavos: -fatura.descontoCentavos, totalCentavos: -fatura.descontoCentavos });
  }

  return {
    ok: true,
    recibo: {
      numero: numeroDoRecibo(fatura.numero, fatura.emitidaEm.getUTCFullYear(), "F"),
      emissao: fatura.pagaEm ?? new Date(),
      pagador: pagadorDoRecibo(fatura.clinica),
      condicao: "Fatura mensal",
      cirurgiao: null,
      itens,
      totalCentavos: bruto - fatura.descontoCentavos,
    },
  };
}
