"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirClinica, registrarAuditoria } from "@/lib/sessao";
import { gerarSenha } from "@/lib/senha";
import { cnpjValido, cpfValido } from "@/lib/documento";
import { conselhoValido, registroDeConselho } from "@/lib/conselhos";
import { formatarNumero, lerTelefones, tituloDe } from "@/lib/crm";
import type { Resultado } from "./pedidos";
import type { Credencial } from "./acessos";

/**
 * Configurações do portal da clínica (pedido de 06/10): uma clínica tem mais de
 * uma pessoa associada — quem acessa o portal e os doutores que atendem nela.
 *
 * Três regras atravessam este arquivo:
 *
 * 1. O TITULAR é o acesso ativo mais antigo da clínica. Só ele altera dados do
 *    cadastro e gerencia os acessos dos colegas: sem isso, qualquer pessoa da
 *    recepção poderia suspender o dono. Os doutores qualquer um da clínica edita
 *    — é rotina do dia a dia, não segurança.
 * 2. A senha de um colega nasce sorteada e provisória, igual à da equipe: quem
 *    criou vê uma vez, e a pessoa é obrigada a trocar na primeira entrada.
 * 3. O principal endereço, o nome e o perfil do cadastro continuam sendo da
 *    equipe Hemoderi. A clínica completa o que falta (documento, telefone,
 *    e-mail), nunca reescreve o que a equipe já conferiu.
 */

export type ResultadoConfiguracao = Resultado & { credencial?: Credencial };

function atualizarTela() {
  revalidatePath("/portal/configuracoes");
}

/** O acesso ativo mais antigo da clínica. */
async function titularDaClinica(clinicaId: string): Promise<string | null> {
  const titular = await prisma.usuario.findFirst({
    where: { clinicaId, papel: "CLINICA", desativadoEm: null },
    orderBy: { criadoEm: "asc" },
    select: { id: true },
  });
  return titular?.id ?? null;
}

async function exigirTitular() {
  const sessao = await exigirClinica();
  const titular = await titularDaClinica(sessao.clinicaId);
  if (titular !== sessao.usuarioId) {
    return { sessao, erro: "Só o titular do acesso da clínica faz esta alteração. Fale com ele ou com a central." as const };
  }
  return { sessao, erro: null };
}

// ─── Dados da clínica ───────────────────────────────────────────────────────

export async function salvarDadosDaClinica(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const { sessao, erro } = await exigirTitular();
  if (erro) return { ok: false, erro };

  const atual = await prisma.clinica.findUnique({
    where: { id: sessao.clinicaId },
    select: { cnpj: true, conselho: true, registroConselho: true },
  });
  if (!atual) return { ok: false, erro: "Cadastro não encontrado." };

  const telefone = String(dados.get("telefone") ?? "").trim();
  if (telefone.replace(/\D/g, "").length < 10) return { ok: false, erro: "Informe um telefone com DDD." };

  const email = String(dados.get("email") ?? "").toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: "Informe um e-mail válido." };

  // O documento só é preenchido aqui quando ainda não existe: depois de
  // conferido pela equipe, quem muda é a equipe (a cobrança sai dele).
  let cnpj = atual.cnpj;
  if (!cnpj) {
    const documento = String(dados.get("cnpj") ?? "").trim();
    if (documento) {
      if (!cnpjValido(documento) && !cpfValido(documento)) {
        return { ok: false, erro: "CNPJ (ou CPF) inválido — confira se algum dígito ficou trocado." };
      }
      cnpj = documento;
    }
  }

  const conselho = String(dados.get("conselho") ?? "").trim();
  const registroBruto = String(dados.get("registroConselho") ?? "").trim();
  const registro = registroBruto ? registroDeConselho(registroBruto) : null;
  if (conselho && !conselhoValido(conselho)) return { ok: false, erro: "Escolha o conselho de classe da lista." };
  if (registroBruto && !registro) {
    return { ok: false, erro: "Número do registro inválido — use de 3 a 20 caracteres, com ao menos um número." };
  }
  if (registro && !conselho) return { ok: false, erro: "Escolha o conselho de classe do registro informado." };

  await prisma.clinica.update({
    where: { id: sessao.clinicaId },
    data: { telefone, email, cnpj, conselho: conselho || null, registroConselho: registro },
  });
  await registrarAuditoria(sessao.usuarioId, "Clinica", sessao.clinicaId, "DADOS_EDITADOS_PELO_PORTAL");
  atualizarTela();
  return { ok: true };
}

// ─── Pessoas com acesso ao portal ───────────────────────────────────────────

export async function adicionarPessoaComAcesso(
  _anterior: ResultadoConfiguracao,
  dados: FormData
): Promise<ResultadoConfiguracao> {
  const { sessao, erro } = await exigirTitular();
  if (erro) return { ok: false, erro };

  const nome = String(dados.get("nome") ?? "").replace(/\s+/g, " ").trim();
  const email = String(dados.get("email") ?? "").toLowerCase().trim();
  if (!nome) return { ok: false, erro: "Informe o nome da pessoa." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: "Informe um e-mail válido." };

  const senha = gerarSenha();
  try {
    const criado = await prisma.usuario.create({
      data: {
        nome,
        email,
        senhaHash: await bcrypt.hash(senha, 10),
        papel: "CLINICA",
        clinicaId: sessao.clinicaId,
        senhaProvisoria: true,
      },
      select: { id: true },
    });
    await registrarAuditoria(sessao.usuarioId, "Usuario", criado.id, "ACESSO_CRIADO_PELA_CLINICA", email);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, erro: "Já existe um acesso com esse e-mail." };
    }
    throw e;
  }

  atualizarTela();
  return { ok: true, credencial: { nome, email, senha, redefinida: false } };
}

/** O colega de acesso, desta clínica, que não é o titular nem a própria pessoa. */
async function colegaGerenciavel(clinicaId: string, solicitanteId: string, usuarioId: string) {
  if (usuarioId === solicitanteId) return { erro: "Para o seu próprio acesso use Trocar senha, no menu." as const };
  const alvo = await prisma.usuario.findFirst({
    where: { id: usuarioId, clinicaId, papel: "CLINICA" },
    select: { id: true, nome: true, email: true },
  });
  if (!alvo) return { erro: "Acesso não encontrado." as const };
  return { alvo, erro: null };
}

export async function redefinirSenhaDeColega(usuarioId: string): Promise<ResultadoConfiguracao> {
  const { sessao, erro } = await exigirTitular();
  if (erro) return { ok: false, erro };
  const g = await colegaGerenciavel(sessao.clinicaId, sessao.usuarioId, usuarioId);
  if (g.erro) return { ok: false, erro: g.erro };

  const senha = gerarSenha();
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { senhaHash: await bcrypt.hash(senha, 10), senhaProvisoria: true, senhaTrocadaEm: null },
  });
  await registrarAuditoria(sessao.usuarioId, "Usuario", usuarioId, "SENHA_REDEFINIDA_PELA_CLINICA", g.alvo.email);
  atualizarTela();
  return { ok: true, credencial: { nome: g.alvo.nome, email: g.alvo.email, senha, redefinida: true } };
}

export async function alternarAcessoDeColega(usuarioId: string, ativo: boolean): Promise<Resultado> {
  const { sessao, erro } = await exigirTitular();
  if (erro) return { ok: false, erro };
  const g = await colegaGerenciavel(sessao.clinicaId, sessao.usuarioId, usuarioId);
  if (g.erro) return { ok: false, erro: g.erro };

  await prisma.usuario.update({ where: { id: usuarioId }, data: { desativadoEm: ativo ? null : new Date() } });
  await registrarAuditoria(
    sessao.usuarioId,
    "Usuario",
    usuarioId,
    ativo ? "ACESSO_REATIVADO_PELA_CLINICA" : "ACESSO_SUSPENSO_PELA_CLINICA",
    g.alvo.email
  );
  atualizarTela();
  return { ok: true };
}

// ─── Doutores da clínica ────────────────────────────────────────────────────

/**
 * Cadastra ou edita um doutor da clínica. Qualquer pessoa da clínica pode: a
 * recepção é quem mais mexe nisso, e a lista alimenta o campo "Doutor(a)
 * responsável" do agendamento.
 */
export async function salvarDoutor(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await exigirClinica();

  const id = String(dados.get("id") ?? "");
  const nome = String(dados.get("nome") ?? "").replace(/\s+/g, " ").trim();
  if (!nome) return { ok: false, erro: "Informe o nome do doutor(a)." };

  const email = String(dados.get("email") ?? "").toLowerCase().trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: "E-mail inválido." };

  const telefoneBruto = String(dados.get("telefone") ?? "").trim();
  const telefone = telefoneBruto ? lerTelefones(telefoneBruto).telefones[0] : null;
  if (telefoneBruto && !telefone) return { ok: false, erro: "Telefone inválido — informe com DDD." };

  const conselho = String(dados.get("conselho") ?? "").trim();
  const registroBruto = String(dados.get("registroConselho") ?? "").trim();
  const registro = registroBruto ? registroDeConselho(registroBruto) : null;
  if (conselho && !conselhoValido(conselho)) return { ok: false, erro: "Escolha o conselho de classe da lista." };
  if (registroBruto && !registro) {
    return { ok: false, erro: "Número do registro inválido — use de 3 a 20 caracteres, com ao menos um número." };
  }
  if (registro && !conselho) return { ok: false, erro: "Escolha o conselho de classe do registro informado." };

  const campos = {
    nome,
    titulo: tituloDe(nome),
    telefone: telefone ? formatarNumero(telefone.numero) : null,
    tipoTelefone: telefone?.tipo ?? null,
    email: email || null,
    conselho: conselho || null,
    registroConselho: registro,
  };

  if (id) {
    // Só edita quem está ligado a ESTA clínica: o id vem do navegador.
    const vinculo = await prisma.vinculoPessoaClinica.findUnique({
      where: { pessoaId_clinicaId: { pessoaId: id, clinicaId: sessao.clinicaId } },
      select: { id: true },
    });
    if (!vinculo) return { ok: false, erro: "Doutor(a) não encontrado nesta clínica." };
    await prisma.pessoaCliente.update({ where: { id }, data: campos });
  } else {
    const jaTem = await prisma.vinculoPessoaClinica.findFirst({
      where: { clinicaId: sessao.clinicaId, pessoa: { nome: { equals: nome, mode: "insensitive" } } },
      select: { id: true },
    });
    if (jaTem) return { ok: false, erro: "Já existe um doutor(a) com esse nome nesta clínica." };
    await prisma.pessoaCliente.create({
      data: {
        ...campos,
        idCrm: `app:${randomUUID()}`,
        origemCrm: "Portal",
        vinculos: { create: { clinicaId: sessao.clinicaId } },
      },
    });
  }

  atualizarTela();
  return { ok: true };
}

/**
 * Tira o doutor da lista da clínica. O cadastro vindo do CRM continua existindo
 * (carrega histórico de negócios); só o que foi criado aqui, e ficou sem
 * nenhuma clínica, é apagado.
 */
export async function removerDoutor(pessoaId: string): Promise<Resultado> {
  const sessao = await exigirClinica();
  const vinculo = await prisma.vinculoPessoaClinica.findUnique({
    where: { pessoaId_clinicaId: { pessoaId, clinicaId: sessao.clinicaId } },
    select: { id: true, pessoa: { select: { idCrm: true, _count: { select: { vinculos: true } } } } },
  });
  if (!vinculo) return { ok: false, erro: "Doutor(a) não encontrado nesta clínica." };

  await prisma.vinculoPessoaClinica.delete({ where: { id: vinculo.id } });
  if (vinculo.pessoa.idCrm.startsWith("app:") && vinculo.pessoa._count.vinculos <= 1) {
    await prisma.pessoaCliente.delete({ where: { id: pessoaId } });
  }
  atualizarTela();
  return { ok: true };
}
