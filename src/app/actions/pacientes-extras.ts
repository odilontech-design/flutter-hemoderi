"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirInterno, registrarAuditoria } from "@/lib/sessao";
import { perfilPermite } from "@/lib/papeis";
import { chaveDoPaciente, lerPacientesExtras, MAXIMO_DE_PACIENTES_EXTRAS } from "@/lib/pacientes-extras";
import { valorDoServico } from "@/lib/valor-do-servico";
import { repasseDoPedido } from "@/lib/repasse-pedido";
import { pagaRepasseNaVisita } from "@/lib/curso-repasse";
import { proximoNumeroDePedido } from "@/lib/numero-pedido";
import { totalDoItem } from "@/lib/cobranca";
import { competenciaDe } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import type { Resultado } from "./pedidos";

/**
 * Paciente atendido além do agendado (Joyce, 19/11: "teve mais um paciente,
 * não foi informado — o profissional consegue alocar mais um relatório ou
 * preciso fazer um novo agendamento?"). Duas ações da equipe, sem devolver o
 * relatório ao profissional:
 *   - acrescentar o paciente ao relatório já enviado;
 *   - transformar o paciente num atendimento próprio da mesma visita, com
 *     cobrança, repasse e relatório (que vai para a conferência normal).
 */

const PERFIS = ["POS_VENDA", "LOGISTICA", "COMERCIAL"] as const;

function atualizarTelas(pedidoId: string) {
  revalidatePath(`/painel/pedidos/${pedidoId}`);
  revalidatePath("/painel/pedidos");
  revalidatePath("/painel/financeiro");
  revalidatePath("/painel");
  revalidatePath("/portal");
  revalidatePath("/profissional");
}

/** A equipe acrescenta um paciente que o relatório não trazia. */
export async function acrescentarPacienteAoRelatorio(pedidoId: string, nomeBruto: string, procedimentoBruto: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, ...PERFIS)) return { ok: false, erro: "Sem permissão para acrescentar paciente ao relatório." };

  const lido = lerPacientesExtras([nomeBruto], [procedimentoBruto]);
  if (!lido.ok) return { ok: false, erro: lido.erro };
  const paciente = lido.lista[0];
  if (!paciente) return { ok: false, erro: "Informe o nome do paciente e o procedimento realizado." };

  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { id: true, apoioDeId: true, relatorio: { select: { id: true, compareceu: true, pacientesExtras: { select: { nome: true } } } } },
  });
  if (!pedido) return { ok: false, erro: "Agendamento não encontrado." };
  if (pedido.apoioDeId) return { ok: false, erro: "Acrescente o paciente no atendimento principal." };
  if (!pedido.relatorio) return { ok: false, erro: "Este atendimento ainda não tem relatório." };
  if (!pedido.relatorio.compareceu) return { ok: false, erro: "O relatório diz que o paciente não compareceu." };
  const existentes = pedido.relatorio.pacientesExtras;
  if (existentes.some((e) => chaveDoPaciente(e.nome) === chaveDoPaciente(paciente.nome))) {
    return { ok: false, erro: "Esse paciente já está na lista." };
  }
  if (existentes.length >= MAXIMO_DE_PACIENTES_EXTRAS) return { ok: false, erro: `No máximo ${MAXIMO_DE_PACIENTES_EXTRAS} pacientes a mais por relatório.` };

  await prisma.relatorioPacienteExtra.create({
    data: { relatorioId: pedido.relatorio.id, nome: paciente.nome, procedimento: paciente.procedimento, ordem: existentes.length, acrescentadoPorId: sessao.usuarioId },
  });
  await registrarAuditoria(sessao.usuarioId, "Pedido", pedido.id, "paciente-extra-acrescentado", `${paciente.nome} — ${paciente.procedimento}`);
  atualizarTelas(pedido.id);
  return { ok: true };
}

/**
 * Cria o atendimento do paciente a mais: mesma visita (grupo), clínica, data,
 * horário e profissional do atendimento principal, já REALIZADO, com o valor do
 * serviço pela tabela da clínica, o repasse pela tabela de repasses (no curso,
 * só o primeiro paciente da visita paga) e um relatório que entra na fila de
 * conferência do pós-venda. Não cria duas vezes o mesmo paciente.
 */
export async function criarAtendimentoDoPacienteExtra(extraId: string): Promise<Resultado> {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, ...PERFIS)) return { ok: false, erro: "Sem permissão para criar o atendimento." };

  const extra = await prisma.relatorioPacienteExtra.findUnique({
    where: { id: extraId },
    select: {
      id: true,
      nome: true,
      procedimento: true,
      pedidoGeradoId: true,
      relatorio: {
        select: {
          compareceu: true,
          servicoRealizadoId: true,
          inicioReal: true,
          fimReal: true,
          doutorNomeInformado: true,
          pedido: {
            select: {
              id: true,
              numero: true,
              status: true,
              apoioDeId: true,
              grupoId: true,
              clinicaId: true,
              servicoId: true,
              modalidade: true,
              enderecoId: true,
              data: true,
              horaInicio: true,
              duracaoMin: true,
              profissionalId: true,
              doutorNome: true,
              contatoClinica: true,
              formaPagamento: true,
              condicaoPagamento: true,
              endereco: { select: { uf: true } },
            },
          },
        },
      },
    },
  });
  if (!extra) return { ok: false, erro: "Paciente não encontrado." };
  if (extra.pedidoGeradoId) return { ok: false, erro: "O atendimento deste paciente já foi criado." };
  const base = extra.relatorio.pedido;
  if (base.apoioDeId) return { ok: false, erro: "Crie o atendimento a partir do atendimento principal." };
  if (base.status !== "REALIZADO" || !extra.relatorio.compareceu) return { ok: false, erro: "Só dá para criar o atendimento de um paciente a mais depois de o atendimento principal estar realizado." };
  if (!base.profissionalId) return { ok: false, erro: "O atendimento principal não tem profissional." };

  const servicoId = extra.relatorio.servicoRealizadoId ?? base.servicoId;
  const servico = await prisma.servico.findUnique({ where: { id: servicoId } });
  if (!servico) return { ok: false, erro: "Serviço não encontrado." };
  const quantidade = Math.max(1, servico.quantidadeMinima ?? 1);
  const modalidade = base.modalidade === "CURSO" ? "CURSO" : "PARTICULAR";
  const unitario = await valorDoServico(base.clinicaId, servicoId, base.endereco?.uf, modalidade);
  const valorServicoCentavos = totalDoItem(unitario, quantidade, servico);
  const repasse = await repasseDoPedido(base.profissionalId, servicoId, valorServicoCentavos, { clinicaId: base.clinicaId, enderecoId: base.enderecoId });
  const grupoId = base.grupoId ?? crypto.randomUUID();

  const novo = await prisma.$transaction(async (tx) => {
    if (!base.grupoId) await tx.pedido.update({ where: { id: base.id }, data: { grupoId } });
    const criado = await tx.pedido.create({
      data: {
        numero: await proximoNumeroDePedido(tx),
        grupoId,
        clinicaId: base.clinicaId,
        servicoId,
        modalidade: base.modalidade,
        enderecoId: base.enderecoId,
        quantidade,
        data: base.data,
        horaInicio: base.horaInicio,
        duracaoMin: base.duracaoMin,
        status: "REALIZADO",
        origem: "INTERNO",
        valorServicoCentavos,
        valorRepasseCentavos: 0,
        profissionalId: base.profissionalId,
        pacienteNome: extra.nome,
        procedimentoPaciente: extra.procedimento,
        doutorNome: extra.relatorio.doutorNomeInformado ?? base.doutorNome,
        contatoClinica: base.contatoClinica,
        formaPagamento: base.formaPagamento,
        condicaoPagamento: base.condicaoPagamento,
        criadoPorId: sessao.usuarioId,
      },
      select: { id: true, numero: true },
    });
    const valorRepasse = (await pagaRepasseNaVisita(tx, { id: criado.id, modalidade: base.modalidade, grupoId })) ? repasse.valorCentavos : 0;
    await tx.pedido.update({ where: { id: criado.id }, data: { valorRepasseCentavos: valorRepasse } });
    await tx.repasse.create({
      data: { pedidoId: criado.id, profissionalId: base.profissionalId!, competencia: competenciaDe(base.data), valorCentavos: valorRepasse, status: "AGUARDANDO_APROVACAO" },
    });
    // O relatório do paciente a mais: o que o profissional já disse (horário,
    // doutor) sem inventar sinais vitais. Entra na conferência normal do pós-venda.
    await tx.relatorioAtendimento.create({
      data: {
        pedidoId: criado.id,
        profissionalId: base.profissionalId!,
        compareceu: true,
        inicioReal: extra.relatorio.inicioReal,
        fimReal: extra.relatorio.fimReal,
        quantidade,
        observacoes: `Paciente a mais informado no relatório do atendimento nº ${base.numero}.`,
      },
    });
    // Quem chegou primeiro leva o paciente: se outro clique já gerou o
    // atendimento, esta troca não acha a linha livre e a transação inteira
    // volta atrás — sem isto, dois cliques criariam dois atendimentos.
    const marcado = await tx.relatorioPacienteExtra.updateMany({ where: { id: extra.id, pedidoGeradoId: null }, data: { pedidoGeradoId: criado.id } });
    if (marcado.count !== 1) throw new Error("JA_CRIADO");
    return { ...criado, valorRepasse };
  }).catch((erro: unknown) => {
    if (erro instanceof Error && erro.message === "JA_CRIADO") return null;
    throw erro;
  });
  if (!novo) return { ok: false, erro: "O atendimento deste paciente já foi criado." };

  await registrarAuditoria(sessao.usuarioId, "Pedido", base.id, "paciente-extra-gerado", `${extra.nome} → atendimento nº ${novo.numero}`);
  await registrarAuditoria(sessao.usuarioId, "Pedido", novo.id, "criado-de-paciente-extra", `a partir do atendimento nº ${base.numero}`);
  atualizarTelas(base.id);
  const avisos = [
    `Atendimento nº ${novo.numero} criado para ${extra.nome}: ${servico.nome}, ${formatarReais(valorServicoCentavos)}; repasse ${formatarReais(novo.valorRepasse)}. O relatório dele está na fila de conferência.`,
  ];
  if (servico.unidadeCobranca !== "PACIENTE") avisos.push("Este serviço não é cobrado por paciente: confira o valor do atendimento criado.");
  if (valorServicoCentavos <= 0) avisos.push("O serviço está sem preço na tabela da clínica (R$ 0): ajuste o valor.");
  return { ok: true, avisos };
}
