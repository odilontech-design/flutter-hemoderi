"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dataDeISO, paraMinutos } from "@/lib/data";
import { parametros } from "@/lib/alocacao";
import { numeroParaWhatsapp } from "@/lib/whatsapp-link";
import type { Resultado } from "./pedidos";

/**
 * O agendamento de quem ainda não é cliente.
 *
 * Rota pública, sem sessão: é a decisão da ata de 14/09 — a pessoa escolhe o
 * serviço e a data primeiro, e só depois se identifica. Exigir cadastro antes
 * de mostrar o que existe é onde a clínica nova desiste.
 *
 * O que entra aqui NÃO é um agendamento: é um pedido de agendamento. A
 * clínica é o escopo inteiro do sistema (preço, sala, fatura, portal), e sem
 * ela não dá para alocar nem cobrar. A equipe tria, vincula ao cadastro pelo
 * telefone ou cria a clínica, e só então vira Pedido.
 */

/** Teto por telefone na janela — o caso real de flood é o mesmo número repetindo. */
const LIMITE_POR_TELEFONE = 5;
/** Teto geral, para quem tenta variar o número. Generoso para uso legítimo. */
const LIMITE_GERAL = 60;
const JANELA_MINUTOS = 60;

export async function solicitarPublico(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const servicoId = String(dados.get("servicoId") ?? "");
  const dataISO = String(dados.get("data") ?? "");
  const horarioDesejado = String(dados.get("horarioDesejado") ?? "");
  const solicitante = String(dados.get("solicitante") ?? "").trim();
  const clinicaNome = String(dados.get("clinicaNome") ?? "").trim();
  const telefoneBruto = String(dados.get("telefone") ?? "");

  if (!servicoId || !dataISO || !horarioDesejado) {
    return { ok: false, erro: "Escolha o serviço, a data e o horário." };
  }
  if (!solicitante || !clinicaNome) {
    return { ok: false, erro: "Informe seu nome e o nome da clínica." };
  }

  // Guardado só com dígitos: é a chave que casa esta solicitação com um
  // cadastro existente, e "(11) 99999-0000" nunca casaria com "11999990000".
  const telefone = numeroParaWhatsapp(telefoneBruto);
  if (!telefone) return { ok: false, erro: "Informe um telefone com DDD." };

  const servico = await prisma.servico.findFirst({
    where: { id: servicoId, ativo: true },
    select: { id: true },
  });
  if (!servico) return { ok: false, erro: "Serviço indisponível." };

  const data = dataDeISO(dataISO);
  if (Number.isNaN(data.getTime())) return { ok: false, erro: "Data inválida." };

  const config = await parametros();
  const minutos = paraMinutos(horarioDesejado);
  if (
    !Number.isFinite(minutos) ||
    minutos < paraMinutos(config.horaAbertura) ||
    minutos > paraMinutos(config.horaFechamento)
  ) {
    return { ok: false, erro: "Horário fora do funcionamento da operação." };
  }

  // Passado não é pedido: é engano de quem clicou no calendário errado.
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  if (data < hoje) return { ok: false, erro: "Escolha uma data a partir de hoje." };

  // Rota aberta pede teto. Sem isso, um formulário público é um convite a
  // encher a fila de trabalho da equipe com trote.
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60 * 1000);
  const [doTelefone, noGeral] = await Promise.all([
    prisma.solicitacaoPublica.count({ where: { telefone, criadaEm: { gte: desde } } }),
    prisma.solicitacaoPublica.count({ where: { criadaEm: { gte: desde } } }),
  ]);
  if (doTelefone >= LIMITE_POR_TELEFONE || noGeral >= LIMITE_GERAL) {
    return {
      ok: false,
      erro: "Recebemos vários pedidos deste número agora há pouco. Fale com a central pelo WhatsApp.",
    };
  }

  await prisma.solicitacaoPublica.create({
    data: {
      telefone,
      solicitante,
      clinicaNome,
      email: String(dados.get("email") ?? "").toLowerCase().trim() || null,
      servicoId,
      dataDesejada: data,
      horarioDesejado,
      doutorNome: String(dados.get("doutorNome") ?? "").trim() || null,
      pacienteNome: String(dados.get("pacienteNome") ?? "").trim() || null,
      observacoes: String(dados.get("observacoes") ?? "").trim() || null,
    },
  });

  revalidatePath("/painel/solicitacoes");
  return { ok: true };
}

/**
 * A triagem: a solicitação vira agendamento de verdade.
 *
 * Duas saídas, e as duas passam por aqui de propósito. A equipe é quem sabe
 * se "Clínica da Dra. Marina" é a Santa Rita cadastrada com outro nome — o
 * telefone ajuda, mas não decide sozinho. Automatizar essa escolha criaria
 * agendamento na clínica errada, que é mais caro de desfazer do que de
 * conferir.
 */
export async function vincularSolicitacao(
  solicitacaoId: string,
  clinicaId: string
): Promise<Resultado> {
  const { exigirInterno, registrarAuditoria } = await import("@/lib/sessao");
  const sessao = await exigirInterno();

  const solicitacao = await prisma.solicitacaoPublica.findUnique({
    where: { id: solicitacaoId },
    include: { servico: { select: { id: true, duracaoMin: true, valorPadraoCentavos: true } } },
  });
  if (!solicitacao) return { ok: false, erro: "Solicitação não encontrada." };
  if (solicitacao.status !== "NOVA") return { ok: false, erro: "Esta solicitação já foi tratada." };

  const clinica = await prisma.clinica.findFirst({
    where: { id: clinicaId, ativa: true },
    select: { id: true },
  });
  if (!clinica) return { ok: false, erro: "Clínica não encontrada ou desativada." };

  // O preço negociado da clínica vence a tabela — a mesma regra do resto do
  // sistema; a solicitação pública não é exceção só por ter vindo de fora.
  const preco = await prisma.precoClinica.findUnique({
    where: { clinicaId_servicoId: { clinicaId, servicoId: solicitacao.servicoId } },
    select: { valorCentavos: true },
  });

  const pedido = await prisma.$transaction(async (tx) => {
    const config = await tx.parametros.update({
      where: { id: "hemoderi" },
      data: { proximoNumeroPedido: { increment: 1 } },
      select: { proximoNumeroPedido: true },
    });

    const criado = await tx.pedido.create({
      data: {
        numero: config.proximoNumeroPedido,
        clinicaId,
        servicoId: solicitacao.servicoId,
        data: solicitacao.dataDesejada,
        horaInicio: solicitacao.horarioDesejado,
        duracaoMin: solicitacao.servico.duracaoMin,
        // Nasce SOLICITADO, não confirmado: o horário era preferência de quem
        // pediu, e quem confere agenda e equipamento é a equipe.
        status: "SOLICITADO",
        origem: "PORTAL_CLINICA",
        valorServicoCentavos: preco?.valorCentavos ?? solicitacao.servico.valorPadraoCentavos,
        doutorNome: solicitacao.doutorNome,
        pacienteNome: solicitacao.pacienteNome,
        pacienteContato: solicitacao.telefone,
        observacoes: solicitacao.observacoes,
        criadoPorId: sessao.usuarioId,
      },
    });

    await tx.solicitacaoPublica.update({
      where: { id: solicitacaoId },
      data: {
        status: "VINCULADA",
        clinicaId,
        pedidoId: criado.id,
        tratadaEm: new Date(),
        tratadaPorId: sessao.usuarioId,
      },
    });

    return criado;
  });

  await registrarAuditoria(
    sessao.usuarioId,
    "Pedido",
    pedido.id,
    "vincular-solicitacao",
    `${solicitacao.clinicaNome} · ${solicitacao.telefone}`
  );

  revalidatePath("/painel/solicitacoes");
  revalidatePath("/painel/pedidos");
  return { ok: true };
}

/** Trote, fora de área, serviço que a operação não faz. */
export async function recusarSolicitacao(solicitacaoId: string, motivo: string): Promise<Resultado> {
  const { exigirInterno, registrarAuditoria } = await import("@/lib/sessao");
  const sessao = await exigirInterno();

  const solicitacao = await prisma.solicitacaoPublica.findUnique({
    where: { id: solicitacaoId },
    select: { status: true },
  });
  if (!solicitacao) return { ok: false, erro: "Solicitação não encontrada." };
  if (solicitacao.status !== "NOVA") return { ok: false, erro: "Esta solicitação já foi tratada." };

  await prisma.solicitacaoPublica.update({
    where: { id: solicitacaoId },
    data: {
      status: "RECUSADA",
      motivoRecusa: motivo.trim() || null,
      tratadaEm: new Date(),
      tratadaPorId: sessao.usuarioId,
    },
  });

  await registrarAuditoria(sessao.usuarioId, "SolicitacaoPublica", solicitacaoId, "recusar", motivo);

  revalidatePath("/painel/solicitacoes");
  return { ok: true };
}
