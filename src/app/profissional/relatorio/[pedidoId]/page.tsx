import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirProfissional } from "@/lib/sessao";
import { Aviso, Cartao, Titulo } from "@/components/ui";
import { formatarData } from "@/lib/data";
import { codigoDoPedido } from "@/lib/numeracao";
import { formatarReais } from "@/lib/dinheiro";
import { FormularioRelatorio } from "./FormularioRelatorio";

export const dynamic = "force-dynamic";

export default async function Relatorio({ params }: { params: { pedidoId: string } }) {
  const sessao = await exigirProfissional();

  // O filtro por profissionalId é o que impede abrir o atendimento de outra
  // pessoa trocando o id na URL.
  const pedido = await prisma.pedido.findFirst({
    where: { id: params.pedidoId, profissionalId: sessao.profissionalId },
    include: {
      clinica: { select: { nome: true, endereco: true } },
      servico: { select: { nome: true } },
      profissional: { select: { chavePix: true } },
      relatorio: { select: { chavePixConfirmada: true, aprovadoEm: true } },
    },
  });
  if (!pedido) notFound();

  return (
    <>
      <Titulo>Relatório do atendimento</Titulo>
      <Cartao className="max-w-xl">
        <div className="mb-4 pb-4 border-b border-gray-100">
          <div className="font-display font-bold text-bordo text-sm">
            {codigoDoPedido(pedido.numero, pedido.clinica.nome, pedido.data)} · {pedido.servico.nome}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {pedido.clinica.nome} · {formatarData(pedido.data)} às {pedido.horaInicio}
          </div>
          <div className="text-xs text-gray-500">
            Repasse previsto: <strong>{formatarReais(pedido.valorRepasseCentavos)}</strong>
          </div>
        </div>
        {pedido.relatorio?.aprovadoEm ? (
          <Aviso tom="info">
            Este relatório já foi conferido pela central e o repasse está liberado. Para corrigir
            alguma coisa, fale com a central.
          </Aviso>
        ) : (
          <FormularioRelatorio
            pedidoId={pedido.id}
            horaPrevista={pedido.horaInicio}
            chavePixCadastro={pedido.relatorio?.chavePixConfirmada ?? pedido.profissional?.chavePix ?? null}
            jaEnviado={pedido.relatorio != null}
          />
        )}
      </Cartao>
    </>
  );
}
