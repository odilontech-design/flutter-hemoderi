import { prisma } from "@/lib/prisma";
import { formatarData } from "@/lib/data";
import { codigoDoPedido } from "@/lib/numeracao";
import { formatarReais } from "@/lib/dinheiro";
import { CAMPOS_CLINICOS, enderecoEmUmaLinha } from "@/lib/relatorio";
import { comEnderecoDoPedido } from "@/lib/endereco";
import { textoDoRelatorio } from "@/lib/relatorio-texto";
import { pedeOrcamentoEPg } from "@/lib/mandic";

/**
 * O relatório de um atendimento em texto, no modelo da equipe — o mesmo que o
 * profissional compartilha no grupo. Vai nas observações do negócio do
 * PipeDrive (ata de 03/11: texto, para a Stephanie copiar e colar).
 * Null quando o atendimento ainda não tem relatório.
 */
export async function textoDoRelatorioDoPedido(pedidoId: string): Promise<string | null> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: {
      clinica: { select: { nome: true, endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true } },
      endereco: { select: { rotulo: true, endereco: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true } },
      servico: { select: { nome: true } },
      profissional: { select: { nome: true } },
      relatorio: {
        include: {
          servicoRealizado: { select: { nome: true } },
          adicionais: { select: { quantidade: true, servico: { select: { nome: true } } } },
        },
      },
    },
  });
  const r = pedido?.relatorio;
  if (!pedido || !r) return null;
  const mandic = await pedeOrcamentoEPg(prisma, pedido.clinicaId);

  return textoDoRelatorio({
    codigo: codigoDoPedido(pedido.numero, pedido.clinica.nome, pedido.data),
    data: formatarData(pedido.data),
    hora: pedido.horaInicio,
    profissional: pedido.profissional?.nome ?? "",
    clinica: r.clinicaNomeInformado ?? (pedido.endereco?.rotulo || pedido.clinica.nome),
    endereco: r.enderecoInformado ?? enderecoEmUmaLinha(comEnderecoDoPedido(pedido.clinica, pedido.endereco)),
    doutor: r.doutorNomeInformado ?? pedido.doutorNome,
    paciente: r.pacienteNomeInformado ?? pedido.pacienteNome,
    procedimento: r.procedimentoInformado ?? pedido.procedimentoPaciente,
    valor: (pedido.valorServicoCentavos / 100).toFixed(2).replace(".", ","),
    formaDoCliente: pedido.formaPagamento,
    servico: r.servicoRealizado?.nome ?? pedido.servico.nome,
    quantidade: r.quantidade,
    adicionais: r.adicionais.map((a) => ({ nome: a.servico.nome, quantidade: a.quantidade })),
    justificativaAdicionais: r.servicosAdicionais,
    compareceu: r.compareceu,
    inicioReal: r.inicioReal,
    fimReal: r.fimReal,
    intercorrencia: r.intercorrencia,
    sinais: Object.fromEntries(CAMPOS_CLINICOS.map((c) => [c.nome, (r as unknown as Record<string, string | null>)[c.nome] ?? null])),
    recebimento: r.recebimento,
    formaRecebimento: r.formaRecebimento,
    valorRecebido: r.valorRecebidoCentavos != null ? formatarReais(r.valorRecebidoCentavos) : null,
    observacaoRecebimento: r.observacaoRecebimento,
    observacoes: r.observacoes,
    mandic: mandic ? { orcamento: r.orcamentoNumero, pg: r.pgNumero } : null,
  });
}
