import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { formatarData } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { FormularioRelatorio } from "./FormularioRelatorio";

export const dynamic = "force-dynamic";

export default async function Relatorio({ params }: { params: { pedidoId: string } }) {
  const sessao = await exigirProfissional();

  // O filtro por profissionalId é o que impede abrir o atendimento de outra
  // pessoa trocando o id na URL.
  const pedido = await prisma.pedido.findFirst({
    where: { id: params.pedidoId, profissionalId: sessao.profissionalId },
    include: { clinica: { select: { nome: true, endereco: true } }, servico: { select: { nome: true } } },
  });
  if (!pedido) notFound();

  return (
    <>
      <Titulo>Relatório do atendimento</Titulo>
      <Cartao className="max-w-xl">
        <div className="mb-4 pb-4 border-b border-gray-100">
          <div className="font-display font-bold text-navy text-sm">
            #{pedido.numero} · {pedido.servico.nome}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {pedido.clinica.nome} · {formatarData(pedido.data)} às {pedido.horaInicio}
          </div>
          <div className="text-xs text-gray-500">
            Repasse previsto: <strong>{formatarReais(pedido.valorRepasseCentavos)}</strong>
          </div>
        </div>
        <FormularioRelatorio pedidoId={pedido.id} horaPrevista={pedido.horaInicio} />
      </Cartao>
    </>
  );
}
