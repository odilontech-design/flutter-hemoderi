import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { Aviso, Cartao, Titulo } from "@/components/ui";
import { STATUS_ATIVOS } from "@/lib/pedido";
import { EditarAgendamentoPortal } from "./EditarAgendamentoPortal";

export const dynamic = "force-dynamic";

export default async function EditarAgendamentoDoPortal({ params }: { params: { id: string } }) {
  const sessao = await exigirClinica();

  const pedido = await prisma.pedido.findFirst({
    where: { id: params.id, clinicaId: sessao.clinicaId },
    select: {
      id: true,
      status: true,
      doutorNome: true,
      pacienteNome: true,
      contatoClinica: true,
      procedimentoPaciente: true,
      formaPagamento: true,
      observacoes: true,
    },
  });
  if (!pedido) notFound();

  // Os doutores cadastrados em Configurações, sugeridos no campo do doutor.
  const doutores = await prisma.vinculoPessoaClinica.findMany({
    where: { clinicaId: sessao.clinicaId },
    orderBy: { pessoa: { nome: "asc" } },
    select: { pessoa: { select: { nome: true } } },
  });

  return (
    <>
      <Titulo
        acao={
          <Link href={`/portal/resumo/${pedido.id}`} className="text-[11px] font-semibold text-bordo hover:underline">
            ← voltar ao resumo
          </Link>
        }
      >
        Editar agendamento
      </Titulo>
      <Cartao className="max-w-2xl">
        {!STATUS_ATIVOS.includes(pedido.status) ? (
          <Aviso tom="alerta">Este atendimento já foi finalizado e não pode mais ser editado.</Aviso>
        ) : (
          <>
            <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
              Aqui você corrige doutor, paciente, contato, procedimento, pagamento e observações. Para mudar a data
              ou o horário,{" "}
              <Link href={`/portal/reagendar/${pedido.id}`} className="font-semibold text-bordo underline">
                remarque o atendimento
              </Link>{" "}
              — a central confirma a nova data de novo.
            </div>
            <EditarAgendamentoPortal
              doutores={doutores.map((d) => d.pessoa.nome)}
              dados={{
                id: pedido.id,
                doutorNome: pedido.doutorNome ?? "",
                pacienteNome: pedido.pacienteNome ?? "",
                contatoClinica: pedido.contatoClinica ?? "",
                procedimentoPaciente: pedido.procedimentoPaciente ?? "",
                formaPagamento: pedido.formaPagamento ?? "",
                observacoes: pedido.observacoes ?? "",
              }}
            />
          </>
        )}
      </Cartao>
    </>
  );
}
