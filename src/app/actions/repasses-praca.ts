"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirResponsavel, registrarAuditoria } from "@/lib/sessao";
import { lerAbaXlsx } from "@/lib/xlsx-leitor";
import { lerRegrasDaPlanilha } from "@/lib/repasse-planilha";
import { rotuloDaPraca } from "@/lib/praca";
import { repasseDoPedido } from "@/lib/repasse-pedido";

export type ResultadoImportacao = {
  ok: boolean;
  erro?: string;
  /** Só conferência (nada gravado) ou aplicada. */
  aplicada?: boolean;
  regras?: number;
  servicosComRegra?: number;
  naoEncontrados?: string[];
  problemas?: string[];
  amostra?: { servico: string; praca: string; regra: string }[];
  /** Atendimentos passados refeitos pela tabela nova (quando pedido). */
  recalculados?: number;
  /** Quantos já estavam pagos e ficaram como estavam. */
  jaPagos?: number;
};

const LIMITE_ARQUIVO = 2 * 1024 * 1024;

/**
 * Importa a planilha de repasses por praça (ata de 20/10). "Conferir" lê e
 * mostra o que entraria, sem gravar; "Aplicar" substitui a tabela inteira
 * pelo que está na planilha — a planilha é a fonte da verdade, e uma praça
 * apagada nela deixa de valer aqui.
 *
 * Por padrão os pedidos já alocados mantêm o repasse calculado na alocação.
 * Com "retroativo" (ata de 29/10: a tabela que está subindo é uma CORREÇÃO, e
 * os atendimentos passados devem segui-la) os que ainda não foram pagos são
 * refeitos; os já pagos ficam como estão. Ajustes futuros da tabela, sem a
 * opção, valem só daqui para a frente.
 */
export async function importarRepassesPraca(
  _anterior: ResultadoImportacao,
  dados: FormData
): Promise<ResultadoImportacao> {
  const sessao = await exigirResponsavel();
  const aplicar = String(dados.get("modo") ?? "") === "aplicar";

  const arquivo = dados.get("planilha");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: "Escolha a planilha (.xlsx)." };
  if (arquivo.size > LIMITE_ARQUIVO) return { ok: false, erro: "Arquivo grande demais (máximo 2 MB)." };

  let leitura;
  try {
    leitura = lerRegrasDaPlanilha(lerAbaXlsx(Buffer.from(await arquivo.arrayBuffer()), "Repasses"));
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não foi possível ler a planilha." };
  }

  const servicos = await prisma.servico.findMany({ select: { id: true, nome: true } });
  const porNome = new Map(servicos.map((s) => [s.nome.trim().toLowerCase(), s.id]));
  const naoEncontrados = Array.from(
    new Set(leitura.regras.filter((r) => !porNome.has(r.servico.toLowerCase())).map((r) => r.servico))
  );
  const validas = leitura.regras.filter((r) => porNome.has(r.servico.toLowerCase()));

  const resumo: ResultadoImportacao = {
    ok: true,
    aplicada: false,
    regras: validas.length,
    servicosComRegra: new Set(validas.map((r) => r.servico)).size,
    naoEncontrados,
    problemas: leitura.problemas,
    amostra: validas.slice(0, 8).map((r) => ({
      servico: r.servico,
      praca: rotuloDaPraca(r.praca),
      regra: r.fixoCentavos != null ? `R$ ${(r.fixoCentavos / 100).toFixed(2).replace(".", ",")} fixo` : `${r.percent}%`,
    })),
  };
  if (validas.length === 0) return { ...resumo, ok: false, erro: "Nenhum repasse preenchido na planilha." };
  if (!aplicar) return resumo;
  if (leitura.problemas.length > 0) {
    return { ...resumo, ok: false, erro: "Corrija os problemas apontados antes de aplicar." };
  }

  await prisma.$transaction([
    prisma.repassePraca.deleteMany({}),
    prisma.repassePraca.createMany({
      data: validas.map((r) => ({
        servicoId: porNome.get(r.servico.toLowerCase())!,
        praca: r.praca,
        percent: r.percent,
        fixoCentavos: r.fixoCentavos,
        observacao: r.observacao,
      })),
    }),
  ]);
  await registrarAuditoria(
    sessao.usuarioId,
    "RepassePraca",
    "tabela",
    "importar-planilha",
    `${validas.length} regra(s) em ${resumo.servicosComRegra} serviço(s)`
  );
  let recalculados = 0;
  let jaPagos = 0;
  if (String(dados.get("retroativo") ?? "") === "sim") {
    const pedidos = await prisma.pedido.findMany({
      where: { profissionalId: { not: null }, status: { in: ["ALOCADO", "REALIZADO"] } },
      select: {
        id: true,
        servicoId: true,
        profissionalId: true,
        clinicaId: true,
        enderecoId: true,
        valorServicoCentavos: true,
        valorRepasseCentavos: true,
        repasse: { select: { id: true, status: true } },
      },
    });
    for (const p of pedidos) {
      if (p.repasse?.status === "PAGO") {
        jaPagos++;
        continue;
      }
      const novo = await repasseDoPedido(p.profissionalId!, p.servicoId, p.valorServicoCentavos, {
        clinicaId: p.clinicaId,
        enderecoId: p.enderecoId,
      });
      if (novo.valorCentavos === p.valorRepasseCentavos) continue;
      await prisma.pedido.update({ where: { id: p.id }, data: { valorRepasseCentavos: novo.valorCentavos } });
      if (p.repasse) await prisma.repasse.update({ where: { id: p.repasse.id }, data: { valorCentavos: novo.valorCentavos } });
      recalculados++;
    }
    await registrarAuditoria(sessao.usuarioId, "RepassePraca", "tabela", "aplicar-retroativo", `${recalculados} refeito(s), ${jaPagos} já pago(s)`);
  }
  revalidatePath("/painel/financeiro/repasses-por-praca");
  revalidatePath("/painel/financeiro");
  return { ...resumo, aplicada: true, recalculados, jaPagos };
}
