import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { parametros } from "@/lib/alocacao";
import { Aviso, Cartao, Titulo } from "@/components/ui";
import { formatarData } from "@/lib/data";
import { codigoDoPedido } from "@/lib/numeracao";
import { STATUS_ATIVOS } from "@/lib/pedido";
import { FormularioReagendamento } from "./FormularioReagendamento";

export const dynamic = "force-dynamic";

export default async function Reagendar({ params }: { params: { pedidoId: string } }) {
  const sessao = await exigirClinica();

  const pedido = await prisma.pedido.findFirst({
    where: { id: params.pedidoId, clinicaId: sessao.clinicaId },
    include: {
      servico: { select: { id: true, nome: true, duracaoMin: true } },
      profissional: { select: { id: true, nome: true } },
      clinica: { select: { nome: true } },
    },
  });
  if (!pedido) notFound();

  const config = await parametros();
  const finalizado = !STATUS_ATIVOS.includes(pedido.status);

  return (
    <>
      <Titulo>Reagendar atendimento</Titulo>
      <Cartao className="max-w-2xl">
        <div className="mb-4 pb-4 border-b border-gray-100">
          <div className="font-display font-bold text-bordo text-sm">
            {codigoDoPedido(pedido.numero, pedido.clinica.nome, pedido.data)} · {pedido.servico.nome}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Hoje marcado para {formatarData(pedido.data)} às {pedido.horaInicio}
            {pedido.profissional ? ` com ${pedido.profissional.nome}` : ""}.
          </div>
        </div>

        {finalizado ? (
          <Aviso tom="alerta">Este atendimento já foi finalizado e não pode ser remarcado.</Aviso>
        ) : (
          <FormularioReagendamento
            pedidoId={pedido.id}
            servicoId={pedido.servico.id}
            profissionalId={pedido.profissional?.id ?? null}
            profissionalNome={pedido.profissional?.nome ?? null}
            antecedenciaHoras={config.antecedenciaMinimaHoras}
          />
        )}
      </Cartao>
    </>
  );
}
