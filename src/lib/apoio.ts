import { prisma } from "@/lib/prisma";
import { sincronizarEvento } from "@/lib/integracoes/google-agenda";

/**
 * Profissional adicional (pedido da Joyce, 05/11). O apoio é um pedido próprio
 * — com aceite, check-in, relatório e repasse do profissional dele — mas a
 * data, o horário, o local e a situação são os do atendimento principal.
 * Depois de qualquer mudança no principal, os apoios ativos são acertados
 * aqui: mesmo horário e local; principal cancelado cancela o apoio.
 */

const ENCERRADOS = ["REALIZADO", "FALTOU", "CANCELADO"];

export async function sincronizarApoios(principalIds: string[]): Promise<void> {
  if (principalIds.length === 0) return;
  const principais = await prisma.pedido.findMany({
    where: { id: { in: principalIds }, apoioDeId: null, apoios: { some: {} } },
    select: {
      id: true,
      status: true,
      clinicaId: true,
      servicoId: true,
      data: true,
      horaInicio: true,
      duracaoMin: true,
      enderecoId: true,
      apoios: {
        select: { id: true, status: true, clinicaId: true, servicoId: true, data: true, horaInicio: true, duracaoMin: true, enderecoId: true },
      },
    },
  });

  for (const p of principais) {
    for (const a of p.apoios) {
      if (ENCERRADOS.includes(a.status)) continue;

      if (p.status === "CANCELADO") {
        await prisma.pedido.update({
          where: { id: a.id },
          data: { status: "CANCELADO", canceladoEm: new Date(), motivoCancelamento: "Atendimento principal cancelado" },
        });
        await prisma.mensagemWhatsapp.updateMany({ where: { pedidoId: a.id, status: "PENDENTE" }, data: { status: "CANCELADA" } });
        await sincronizarEvento(a.id);
        continue;
      }

      const trocouServico = a.servicoId !== p.servicoId;
      const mudou =
        trocouServico ||
        a.clinicaId !== p.clinicaId ||
        a.data.getTime() !== p.data.getTime() ||
        a.horaInicio !== p.horaInicio ||
        a.duracaoMin !== p.duracaoMin ||
        a.enderecoId !== p.enderecoId;
      if (!mudou) continue;

      await prisma.pedido.update({
        where: { id: a.id },
        data: {
          clinicaId: p.clinicaId,
          servicoId: p.servicoId,
          data: p.data,
          horaInicio: p.horaInicio,
          duracaoMin: p.duracaoMin,
          enderecoId: p.enderecoId,
          // Serviço trocado: o profissional do apoio pode não estar apto ao novo
          // — volta para "a alocar", como o principal.
          ...(trocouServico ? { profissionalId: null, equipamentoId: null, valorRepasseCentavos: 0, aceitoEm: null, status: "CONFIRMADO" as const } : {}),
        },
      });
      await sincronizarEvento(a.id);
    }
  }
}
