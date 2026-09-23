"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dataDeISO, dataMinimaAgendamentoPublico, isoDeData, paraMinutos } from "@/lib/data";
import { parametros } from "@/lib/alocacao";
import { numeroParaWhatsapp } from "@/lib/whatsapp-link";
import { cepValido } from "@/lib/documento";
import { gerarSenha } from "@/lib/senha";
import { slugLivre } from "./cadastros";
import type { Resultado } from "./pedidos";

/**
 * O agendamento de quem ainda não é cliente.
 *
 * Rota pública, sem sessão: é a decisão da ata de 14/09 — a pessoa escolhe o
 * serviço e a data primeiro, e só depois se identifica. Exigir cadastro antes
 * de mostrar o que existe é onde a clínica nova desiste.
 *
 * A identificação (ata de 21/09) passou a resolver a clínica na hora, em vez
 * de deixar pendurado para a equipe achar depois: quem já é cliente entra com
 * a própria conta, e quem é novo ganha uma na mesma hora — sorteada como todo
 * acesso deste sistema (lib/senha.ts), mostrada uma vez na tela de sucesso.
 * É o que a ata chamou de "cadastro obrigatório ao final": barra robô e
 * curioso de tráfego pago, e poupa a equipe de adivinhar qual clínica é
 * "clínica da Dra. Marina". A solicitação nasce com a clínica já resolvida —
 * o que falta à equipe conferir é a data, o horário e o serviço, não mais
 * "de quem é isso".
 */

/** Teto por telefone na janela — o caso real de flood é o mesmo número repetindo. */
const LIMITE_POR_TELEFONE = 5;
/** Teto geral, para quem tenta variar o número. Generoso para uso legítimo. */
const LIMITE_GERAL = 60;
const JANELA_MINUTOS = 60;

export type ResultadoSolicitacaoPublica = Resultado & {
  /** Só em cadastro novo — mostrada uma vez, igual a todo acesso criado neste sistema. */
  credencial?: { email: string; senha: string };
};

export async function solicitarPublico(
  _anterior: ResultadoSolicitacaoPublica,
  dados: FormData
): Promise<ResultadoSolicitacaoPublica> {
  const servicoId = String(dados.get("servicoId") ?? "");
  const dataISO = String(dados.get("data") ?? "");
  const horarioDesejado = String(dados.get("horarioDesejado") ?? "");
  const solicitante = String(dados.get("solicitante") ?? "").trim();
  const telefoneBruto = String(dados.get("telefone") ?? "");

  if (!servicoId || !dataISO || !horarioDesejado) {
    return { ok: false, erro: "Escolha o serviço, a data e o horário." };
  }
  if (!solicitante) return { ok: false, erro: "Informe seu nome." };

  // Guardado só com dígitos: é a chave que casa esta solicitação com um
  // cadastro existente, e "(11) 99999-0000" nunca casaria com "11999990000".
  const telefone = numeroParaWhatsapp(telefoneBruto);
  if (!telefone) return { ok: false, erro: "Informe um WhatsApp com DDD." };

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

  // Regra da ata de 21/09: nada de hoje por aqui (é emergência, vai pelo
  // WhatsApp) e amanhã só até as 18h de hoje. A mesma conta que já bloqueia o
  // seletor de data na tela — conferida de novo aqui porque é o servidor
  // quem decide de verdade.
  if (isoDeData(data) < dataMinimaAgendamentoPublico()) {
    return {
      ok: false,
      erro: "Essa data está fora do prazo do site. Para menos de um dia de antecedência, fale com a central pelo WhatsApp.",
    };
  }

  // Endereço do atendimento — obrigatório desde a mesma ata, e a mesma fonte
  // (CEP) que o resto do sistema usa para não depender de endereço digitado.
  const cep = String(dados.get("cep") ?? "").trim();
  const endereco = String(dados.get("endereco") ?? "").trim();
  const bairro = String(dados.get("bairro") ?? "").trim();
  const cidade = String(dados.get("cidade") ?? "").trim();
  const uf = String(dados.get("uf") ?? "").trim().toUpperCase();
  const numero = String(dados.get("numero") ?? "").trim();
  if (!cepValido(cep) || !endereco || !bairro || !cidade || !uf) {
    return { ok: false, erro: "Informe o CEP e confira se o endereço veio preenchido." };
  }
  if (!numero) return { ok: false, erro: "Informe o número do endereço." };

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

  // Duas portas para a mesma exigência (identificar a clínica agora, não
  // depois): quem já é cliente entra com a conta; quem é novo ganha uma.
  const modo = String(dados.get("modo") ?? "novo");
  let clinicaId: string;
  let clinicaNome: string;
  let credencial: { email: string; senha: string } | undefined;

  if (modo === "login") {
    const emailLogin = String(dados.get("emailLogin") ?? "").toLowerCase().trim();
    const senhaLogin = String(dados.get("senhaLogin") ?? "");
    if (!emailLogin || !senhaLogin) return { ok: false, erro: "Informe seu e-mail e senha para entrar." };

    const usuario = await prisma.usuario.findUnique({
      where: { email: emailLogin },
      select: {
        senhaHash: true,
        desativadoEm: true,
        papel: true,
        clinica: { select: { id: true, nome: true, ativa: true } },
      },
    });
    const confere = usuario ? await bcrypt.compare(senhaLogin, usuario.senhaHash) : false;
    if (!usuario || usuario.desativadoEm || usuario.papel !== "CLINICA" || !usuario.clinica || !confere) {
      return { ok: false, erro: "E-mail ou senha não conferem." };
    }
    if (!usuario.clinica.ativa) {
      return { ok: false, erro: "Este cadastro está desativado. Fale com a central pelo WhatsApp." };
    }

    clinicaId = usuario.clinica.id;
    clinicaNome = usuario.clinica.nome;
  } else {
    const clinicaNomeInformado = String(dados.get("clinicaNome") ?? "").trim();
    const emailNovo = String(dados.get("email") ?? "").toLowerCase().trim();
    if (!clinicaNomeInformado) return { ok: false, erro: "Informe o nome da clínica." };
    if (!emailNovo) return { ok: false, erro: "Informe um e-mail — é por ele que você entra no portal depois." };

    try {
      const senha = gerarSenha();
      const clinica = await prisma.clinica.create({
        data: {
          nome: clinicaNomeInformado,
          slug: await slugLivre(clinicaNomeInformado),
          telefone,
          email: emailNovo,
          cep,
          endereco,
          numero,
          complemento: String(dados.get("complemento") ?? "").trim() || null,
          bairro,
          cidade,
          uf,
          salas: 1,
          usuarios: {
            create: { nome: solicitante, email: emailNovo, senhaHash: await bcrypt.hash(senha, 10), papel: "CLINICA", senhaProvisoria: true },
          },
        },
        select: { id: true, nome: true },
      });

      clinicaId = clinica.id;
      clinicaNome = clinica.nome;
      credencial = { email: emailNovo, senha };
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        return {
          ok: false,
          erro: 'Já existe uma conta com esse e-mail. Se você já é cliente, use "Já sou cliente" para entrar.',
        };
      }
      throw erro;
    }
  }

  await prisma.solicitacaoPublica.create({
    data: {
      telefone,
      solicitante,
      clinicaNome,
      clinicaId,
      email: String(dados.get("email") ?? dados.get("emailLogin") ?? "").toLowerCase().trim() || null,
      servicoId,
      dataDesejada: data,
      horarioDesejado,
      cep,
      endereco,
      numero: numero || null,
      complemento: String(dados.get("complemento") ?? "").trim() || null,
      bairro,
      cidade,
      uf,
      pontoReferencia: String(dados.get("pontoReferencia") ?? "").trim() || null,
      doutorNome: String(dados.get("doutorNome") ?? "").trim() || null,
      pacienteNome: String(dados.get("pacienteNome") ?? "").trim() || null,
      observacoes: String(dados.get("observacoes") ?? "").trim() || null,
    },
  });

  revalidatePath("/painel/solicitacoes");
  return { ok: true, credencial };
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
