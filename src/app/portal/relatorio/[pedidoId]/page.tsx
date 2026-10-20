import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { formatarData } from "@/lib/data";
import { codigoDoPedido } from "@/lib/numeracao";
import { INCLUIR_ADICIONAIS, RelatorioPreenchido } from "@/components/RelatorioPreenchido";

export const dynamic = "force-dynamic";

/**
 * O relatório do atendimento para a clínica (ata de 20/10), só depois de a
 * central aprovar: antes disso ainda pode ser corrigido, e a clínica veria uma
 * versão que muda. Sai sem o que é da operação (ajuda de custo, recebimento,
 * localização) — ver `paraClinica` em RelatorioPreenchido.
 */
export default async function RelatorioDaClinica({ params }: { params: { pedidoId: string } }) {
  const sessao = await exigirClinica();
  const pedido = await prisma.pedido.findFirst({
    where: { id: params.pedidoId, clinicaId: sessao.clinicaId, relatorio: { is: { aprovadoEm: { not: null } } } },
    select: {
      numero: true,
      data: true,
      horaInicio: true,
      doutorNome: true,
      clinica: { select: { nome: true } },
      servico: { select: { nome: true } },
      profissional: { select: { nome: true } },
      relatorio: { include: INCLUIR_ADICIONAIS },
    },
  });
  if (!pedido?.relatorio) notFound();

  return (
    <>
      <Titulo>Relatório do atendimento</Titulo>
      <Cartao className="max-w-3xl">
        <div className="mb-4 pb-4 border-b border-gray-100">
          <div className="font-display font-bold text-bordo text-sm">
            {codigoDoPedido(pedido.numero, pedido.clinica.nome, pedido.data)} · {pedido.servico.nome}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {formatarData(pedido.data)} às {pedido.horaInicio}
            {pedido.profissional ? ` · ${pedido.profissional.nome}` : ""}
            {pedido.doutorNome ? ` · Dr(a). ${pedido.doutorNome}` : ""}
          </div>
        </div>
        <RelatorioPreenchido relatorio={pedido.relatorio} paraClinica />
        <div className="mt-6 pt-4 border-t border-gray-100">
          <Link href="/portal/historico" className="text-xs font-semibold text-bordo hover:underline">
            ← Voltar ao histórico
          </Link>
        </div>
      </Cartao>
    </>
  );
}
