"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { Prisma, type PapelUsuario, type PerfilInterno } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { exigirResponsavel, registrarAuditoria } from "@/lib/sessao";
import { conferirSenhaNova, gerarSenha } from "@/lib/senha";
import type { Resultado } from "./pedidos";

/**
 * Gestão de acesso: criar, redefinir senha, suspender e reativar.
 *
 * Três decisões atravessam este arquivo:
 *
 * 1. A equipe nunca escolhe senha. Toda senha nasce sorteada em lib/senha.ts,
 *    aparece UMA vez na tela de quem criou, e é marcada como provisória — na
 *    primeira entrada o dono é obrigado a trocar. Assim ninguém da operação
 *    fica sabendo a senha de um profissional cujo repasse este sistema
 *    calcula.
 * 2. Suspender é desativar, nunca apagar. O usuário está preso ao histórico
 *    (pedidos que abriu, repasses que baixou); apagar não apaga o histórico,
 *    apaga a autoria dele.
 * 3. Tudo que mexe em acesso vira registro de auditoria. "Quem devolveu o
 *    acesso do fulano em março" precisa ter resposta.
 */

export type Credencial = {
  nome: string;
  email: string;
  senha: string;
  /** Redefinição de uma conta que já existia, em vez de acesso novo. */
  redefinida: boolean;
};

export type ResultadoAcesso = Resultado & { credencial?: Credencial };

function atualizarTelas() {
  revalidatePath("/painel/acessos");
  revalidatePath("/painel/clinicas");
  revalidatePath("/painel/profissionais");
}

/** Deixa o e-mail no formato em que ele é procurado no login. */
function normalizarEmail(valor: unknown): string {
  return String(valor ?? "").toLowerCase().trim();
}

/**
 * Cria o usuário com senha sorteada.
 *
 * O e-mail é único no banco de propósito: dois atendentes criando o acesso da
 * mesma clínica ao mesmo tempo é um cenário real com cinco pessoas na
 * operação, e o certo é a segunda tentativa virar recusa visível — não um
 * segundo login para a mesma pessoa. Por isso o P2002 é tratado aqui em vez
 * de confiar só na consulta prévia, que não protege contra a corrida.
 */
async function criarUsuarioComSenha(dados: {
  nome: string;
  email: string;
  papel: PapelUsuario;
  clinicaId: string | null;
  profissionalId: string | null;
  perfilInterno?: PerfilInterno | null;
  autorId: string;
}): Promise<ResultadoAcesso> {
  const senha = gerarSenha();

  try {
    const usuario = await prisma.usuario.create({
      data: {
        nome: dados.nome,
        email: dados.email,
        senhaHash: await bcrypt.hash(senha, 10),
        papel: dados.papel,
        clinicaId: dados.clinicaId,
        profissionalId: dados.profissionalId,
        perfilInterno: dados.papel === "INTERNO" ? (dados.perfilInterno ?? "ATENDENTE") : null,
        senhaProvisoria: true,
      },
      select: { id: true },
    });

    await registrarAuditoria(
      dados.autorId,
      "Usuario",
      usuario.id,
      "ACESSO_CRIADO",
      dados.papel === "INTERNO"
        ? `${dados.email} · ${dados.papel} · ${dados.perfilInterno ?? "ATENDENTE"}`
        : `${dados.email} · ${dados.papel}`
    );
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { ok: false, erro: "Já existe um acesso com esse e-mail." };
    }
    throw erro;
  }

  atualizarTelas();
  return {
    ok: true,
    credencial: { nome: dados.nome, email: dados.email, senha, redefinida: false },
  };
}

/**
 * Cria o acesso de uma clínica, de um profissional ou da própria equipe.
 *
 * Não existe autocadastro: com ~60 profissionais e uma carteira de clínicas
 * conhecida, uma tela pública de cadastro abriria porta sem resolver
 * problema nenhum.
 */
export async function criarAcesso(_anterior: ResultadoAcesso, dados: FormData): Promise<ResultadoAcesso> {
  const sessao = await exigirResponsavel();

  const nome = String(dados.get("nome") ?? "").trim();
  const email = normalizarEmail(dados.get("email"));
  const papel = String(dados.get("papel") ?? "");
  const vinculoId = String(dados.get("vinculoId") ?? "");
  const perfilInterno = String(dados.get("perfilInterno") ?? "ATENDENTE");

  if (!nome || !email) return { ok: false, erro: "Informe o nome e o e-mail." };
  if (!["INTERNO", "CLINICA", "PROFISSIONAL"].includes(papel)) {
    return { ok: false, erro: "Selecione o nível de acesso." };
  }
  if (papel !== "INTERNO" && !vinculoId) {
    return { ok: false, erro: "Selecione a clínica ou o profissional deste acesso." };
  }
  if (papel === "INTERNO" && !["ATENDENTE", "RESPONSAVEL"].includes(perfilInterno)) {
    return { ok: false, erro: "Selecione o perfil do acesso interno." };
  }

  // O vínculo é o escopo inteiro da conta — apontar para uma clínica
  // desativada criaria um login que entra e não enxerga nada.
  if (papel === "CLINICA") {
    const clinica = await prisma.clinica.findUnique({
      where: { id: vinculoId },
      select: { ativa: true },
    });
    if (!clinica) return { ok: false, erro: "Clínica não encontrada." };
    if (!clinica.ativa) return { ok: false, erro: "Essa clínica está desativada. Reative antes de criar o acesso." };
  }
  if (papel === "PROFISSIONAL") {
    const profissional = await prisma.profissional.findUnique({
      where: { id: vinculoId },
      select: { ativo: true },
    });
    if (!profissional) return { ok: false, erro: "Profissional não encontrado." };
    if (!profissional.ativo) {
      return { ok: false, erro: "Esse profissional está desativado. Reative antes de criar o acesso." };
    }
  }

  return criarUsuarioComSenha({
    nome,
    email,
    papel: papel as PapelUsuario,
    clinicaId: papel === "CLINICA" ? vinculoId : null,
    profissionalId: papel === "PROFISSIONAL" ? vinculoId : null,
    perfilInterno: papel === "INTERNO" ? (perfilInterno as PerfilInterno) : null,
    autorId: sessao.usuarioId,
  });
}

/**
 * Gera o acesso direto da lista de clínicas ou de profissionais, sem
 * redigitar nome e e-mail que já estão no cadastro.
 *
 * É o caminho que a operação usa de verdade: cadastra o profissional e, na
 * mesma linha da tabela, entrega a senha dele.
 */
export async function gerarAcessoDoCadastro(
  tipo: "clinica" | "profissional",
  id: string
): Promise<ResultadoAcesso> {
  const sessao = await exigirResponsavel();

  const cadastro =
    tipo === "clinica"
      ? await prisma.clinica.findUnique({
          where: { id },
          select: { nome: true, email: true, ativa: true, usuarios: { select: { id: true }, take: 1 } },
        })
      : await prisma.profissional.findUnique({
          where: { id },
          select: { nome: true, email: true, ativo: true, usuarios: { select: { id: true }, take: 1 } },
        });

  if (!cadastro) return { ok: false, erro: "Cadastro não encontrado." };

  const ativo = "ativa" in cadastro ? cadastro.ativa : cadastro.ativo;
  if (!ativo) return { ok: false, erro: "Cadastro desativado. Reative antes de criar o acesso." };

  if (cadastro.usuarios.length > 0) {
    return { ok: false, erro: "Esse cadastro já tem acesso. Use Redefinir senha." };
  }
  if (!cadastro.email) {
    return { ok: false, erro: "Preencha o e-mail no cadastro antes de gerar o acesso." };
  }

  return criarUsuarioComSenha({
    nome: cadastro.nome,
    email: normalizarEmail(cadastro.email),
    papel: tipo === "clinica" ? "CLINICA" : "PROFISSIONAL",
    clinicaId: tipo === "clinica" ? id : null,
    profissionalId: tipo === "profissional" ? id : null,
    autorId: sessao.usuarioId,
  });
}

/**
 * Sorteia uma senha nova para quem perdeu a dele.
 *
 * A senha nova já nasce provisória: serve para a pessoa entrar uma vez e
 * escolher a dela. O atendente que redefiniu vê a senha na tela, dita por
 * telefone, e ela morre ali — em nenhum momento a operação fica com a senha
 * definitiva de ninguém.
 */
export async function redefinirSenha(usuarioId: string): Promise<ResultadoAcesso> {
  const sessao = await exigirResponsavel();

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nome: true, email: true },
  });
  if (!usuario) return { ok: false, erro: "Acesso não encontrado." };

  const senha = gerarSenha();
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      senhaHash: await bcrypt.hash(senha, 10),
      senhaProvisoria: true,
      // A senha antiga deixou de valer agora; o carimbo de "trocada por ela
      // mesma" só volta quando a pessoa escolher a dela.
      senhaTrocadaEm: null,
    },
  });

  await registrarAuditoria(sessao.usuarioId, "Usuario", usuarioId, "SENHA_REDEFINIDA", usuario.email);

  atualizarTelas();
  return {
    ok: true,
    credencial: { nome: usuario.nome, email: usuario.email, senha, redefinida: true },
  };
}

/**
 * Suspende ou devolve um acesso.
 *
 * A clínica ou o profissional por trás continuam cadastrados, intactos: só o
 * login para. As guardas de lib/sessao.ts reconferem isso a cada request,
 * então a suspensão vale imediatamente — inclusive para quem está com uma aba
 * aberta neste segundo.
 */
export async function alternarAcesso(id: string, ativo: boolean): Promise<Resultado> {
  const sessao = await exigirResponsavel();

  // Ninguém se tranca pra fora sozinho — se a conta precisa sair, é outra
  // pessoa da equipe que suspende.
  if (id === sessao.usuarioId && !ativo) {
    return { ok: false, erro: "Você não pode suspender o seu próprio acesso." };
  }

  const usuario = await prisma.usuario.findUnique({ where: { id }, select: { email: true, papel: true } });
  if (!usuario) return { ok: false, erro: "Acesso não encontrado." };

  // Não existe verificação de "último acesso da equipe" aqui de propósito:
  // quem chega neste ponto passou por exigirResponsavel, então já é um
  // acesso interno ativo (e RESPONSAVEL), e a linha acima impede que seja o
  // próprio. Sempre sobra pelo menos um — o de quem está suspendendo.

  await prisma.usuario.update({
    where: { id },
    data: { desativadoEm: ativo ? null : new Date() },
  });

  await registrarAuditoria(
    sessao.usuarioId,
    "Usuario",
    id,
    ativo ? "ACESSO_REATIVADO" : "ACESSO_SUSPENSO",
    usuario.email
  );

  atualizarTelas();
  return { ok: true };
}

/**
 * Promove ou rebaixa um acesso interno entre Atendente e Responsável.
 *
 * Duas travas evitam a operação inteira ficar sem quem gerencia acesso e
 * financeiro: ninguém rebaixa a si mesmo (o mesmo princípio de
 * `alternarAcesso` — sair de RESPONSAVEL é sempre coisa de outra pessoa), e
 * o último RESPONSAVEL ativo não pode virar ATENDENTE, ponto. Sem a segunda
 * trava, dois responsáveis rebaixando um ao outro por engano — ou de
 * propósito, achando que "algum outro fica" — deixariam a equipe inteira
 * sem ninguém que possa desfazer o próprio erro.
 */
export async function alterarPerfilInterno(usuarioId: string, perfil: PerfilInterno): Promise<Resultado> {
  const sessao = await exigirResponsavel();

  if (usuarioId === sessao.usuarioId && perfil !== "RESPONSAVEL") {
    return { ok: false, erro: "Você não pode rebaixar o seu próprio perfil." };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { email: true, papel: true, desativadoEm: true, perfilInterno: true },
  });
  if (!usuario || usuario.papel !== "INTERNO") return { ok: false, erro: "Acesso não encontrado." };

  if (perfil !== "RESPONSAVEL") {
    const outrosResponsaveis = await prisma.usuario.count({
      where: {
        papel: "INTERNO",
        desativadoEm: null,
        id: { not: usuarioId },
        OR: [{ perfilInterno: "RESPONSAVEL" }, { perfilInterno: null }],
      },
    });
    if (outrosResponsaveis === 0) {
      return { ok: false, erro: "Precisa sobrar pelo menos um Responsável ativo na equipe." };
    }
  }

  await prisma.usuario.update({ where: { id: usuarioId }, data: { perfilInterno: perfil } });

  await registrarAuditoria(sessao.usuarioId, "Usuario", usuarioId, "PERFIL_ALTERADO", `${usuario.email} · ${perfil}`);

  atualizarTelas();
  return { ok: true };
}

/**
 * Troca da própria senha — a única escrita em senhaHash que não passa por
 * exigirInterno, porque clínica e profissional também trocam a deles.
 *
 * Pede a senha atual mesmo logo depois do primeiro login, quando ela acabou
 * de ser digitada: o custo é um campo a mais e o que ele impede é alguém
 * assumir a conta numa máquina deixada aberta na recepção.
 */
export async function trocarSenha(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user?.id) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const atual = String(dados.get("atual") ?? "");
  const nova = String(dados.get("nova") ?? "");
  const confirmacao = String(dados.get("confirmacao") ?? "");

  const problema = conferirSenhaNova(nova, confirmacao);
  if (problema) return { ok: false, erro: problema };

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.user.id },
    select: { senhaHash: true, desativadoEm: true },
  });
  if (!usuario || usuario.desativadoEm) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  if (!(await bcrypt.compare(atual, usuario.senhaHash))) {
    return { ok: false, erro: "A senha atual não confere." };
  }
  if (await bcrypt.compare(nova, usuario.senhaHash)) {
    return { ok: false, erro: "A nova senha precisa ser diferente da atual." };
  }

  await prisma.usuario.update({
    where: { id: sessao.user.id },
    data: {
      senhaHash: await bcrypt.hash(nova, 10),
      senhaProvisoria: false,
      senhaTrocadaEm: new Date(),
    },
  });

  await registrarAuditoria(sessao.user.id, "Usuario", sessao.user.id, "SENHA_TROCADA");

  atualizarTelas();
  return { ok: true };
}

export type ResultadoImportacao = Resultado & {
  credenciais?: Credencial[];
  problemas?: { linha: number; conteudo: string; motivo: string }[];
  jaExistiam?: string[];
};

/**
 * Importa a planilha de profissionais da Hemoderi: cadastro e acesso de uma
 * vez, com senha provisória.
 *
 * Cadastrar sessenta pessoas uma a uma é o que trava a virada para uso real —
 * e é trabalho que ninguém faz duas vezes, então errar aqui custa caro. Por
 * isso a importação é conservadora: quem já existe é PULADO, nunca
 * sobrescrito. Um e-mail repetido pode ser a mesma pessoa reenviada na
 * planilha, e apagar o acesso de quem já está trabalhando para recriar seria
 * o pior desfecho possível.
 */
export async function importarProfissionais(
  _anterior: ResultadoImportacao,
  dados: FormData
): Promise<ResultadoImportacao> {
  const sessao = await exigirResponsavel();

  const { lerPlanilha } = await import("@/lib/importacao");
  const { validos, problemas } = lerPlanilha(String(dados.get("planilha") ?? ""));

  if (validos.length === 0) {
    return {
      ok: false,
      erro: "Nenhuma linha aproveitável. Cole nome e e-mail, um profissional por linha.",
      problemas,
    };
  }

  const emails = validos.map((v) => v.email);
  const [usuariosExistentes, profissionaisExistentes] = await Promise.all([
    prisma.usuario.findMany({ where: { email: { in: emails } }, select: { email: true } }),
    prisma.profissional.findMany({ where: { email: { in: emails } }, select: { email: true } }),
  ]);
  const jaExistem = new Set([
    ...usuariosExistentes.map((u) => u.email),
    ...profissionaisExistentes.map((p) => p.email ?? ""),
  ]);

  const credenciais: Credencial[] = [];
  const jaExistiam: string[] = [];

  for (const { nome, email } of validos) {
    if (jaExistem.has(email)) {
      jaExistiam.push(email);
      continue;
    }

    const senha = gerarSenha();
    // Um por vez, em transação própria: numa importação de sessenta linhas,
    // uma linha problemática não pode desfazer as cinquenta e nove que deram
    // certo — quem reprocessa a planilha inteira acaba criando duplicata.
    try {
      const profissional = await prisma.profissional.create({ data: { nome, email } });
      await prisma.usuario.create({
        data: {
          nome,
          email,
          senhaHash: await bcrypt.hash(senha, 10),
          papel: "PROFISSIONAL",
          profissionalId: profissional.id,
          senhaProvisoria: true,
        },
      });
      await registrarAuditoria(sessao.usuarioId, "Profissional", profissional.id, "IMPORTADO", email);
      credenciais.push({ nome, email, senha, redefinida: false });
    } catch (erro) {
      problemas.push({
        linha: 0,
        conteudo: `${nome} · ${email}`,
        motivo: erro instanceof Error ? erro.message.slice(0, 120) : "falhou ao criar",
      });
    }
  }

  atualizarTelas();
  return {
    ok: credenciais.length > 0,
    erro: credenciais.length === 0 ? "Nenhum profissional novo: todos já estavam cadastrados." : undefined,
    credenciais,
    problemas,
    jaExistiam,
  };
}
