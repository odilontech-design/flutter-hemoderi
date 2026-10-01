import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import type { PerfilInterno } from "@prisma/client";
import { inicioDe, perfilEfetivo } from "./papeis";

export type SessaoInterno = {
  usuarioId: string;
  nome: string;
  perfil: PerfilInterno;
  /** Preenchido quando o usuário interno também é profissional (dual-perfil). */
  profissionalId?: string;
};
export type SessaoClinica = { usuarioId: string; nome: string; clinicaId: string; clinicaNome: string };
export type SessaoProfissional = {
  usuarioId: string;
  nome: string;
  profissionalId: string;
  profissionalNome: string;
  /** true quando o usuário é INTERNO acessando o portal do profissional (dual-perfil). */
  dualPerfil?: boolean;
};

async function usuarioDaSessao() {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user) redirect("/login");
  return sessao.user;
}

/**
 * Guardas de acesso. TODA página e TODA server action começa por uma delas.
 *
 * A sessão é um JWT — por padrão não precisaria consultar o banco a cada
 * navegação. Mas as três reconferem o vínculo mesmo assim: quem desativa um
 * acesso (um funcionário desligado, uma clínica inadimplente) precisa que o
 * corte valha JÁ, não só da próxima vez que a pessoa tentar entrar — sem
 * isso, o token continua servindo por até 30 dias (padrão do NextAuth)
 * depois da desativação.
 *
 * A mesma consulta resolve a senha provisória: enquanto a senha em uso for a
 * que a equipe sorteou, as três param a pessoa em /trocar-senha. É o que
 * fecha o ciclo da senha gerada — ela serve para entrar uma vez e morre ali,
 * em vez de virar a senha permanente que meia operação conhece.
 *
 * /trocar-senha NÃO pode usar estas guardas (seria um laço de redirect); ela
 * lê a sessão direto, e é a única página assim no sistema.
 */
export const ROTA_TROCAR_SENHA = "/trocar-senha";

export async function exigirInterno(): Promise<SessaoInterno> {
  const u = await usuarioDaSessao();
  if (u.papel !== "INTERNO") redirect(inicioDe(u.papel));

  const usuario = await prisma.usuario.findUnique({
    where: { id: u.id },
    select: { desativadoEm: true, senhaProvisoria: true, perfilInterno: true },
  });
  if (!usuario || usuario.desativadoEm) redirect("/login");
  if (usuario.senhaProvisoria) redirect(ROTA_TROCAR_SENHA);

  return {
    usuarioId: u.id,
    nome: u.name ?? "",
    perfil: perfilEfetivo(usuario.perfilInterno),
    profissionalId: (u as any).profissionalId ?? undefined,
  };
}

/**
 * A metade sensível do painel: repasse aos profissionais e gestão de
 * acesso. Quem não é RESPONSAVEL cai em `/painel` em vez de ver um erro —
 * o item já está fora do menu para esse perfil, chegar aqui só acontece
 * por link direto ou aba antiga, e devolver para a tela de sempre é menos
 * confuso que uma página de "acesso negado" para quem nem escolheu a URL.
 */
export async function exigirResponsavel(): Promise<SessaoInterno> {
  const sessao = await exigirInterno();
  if (sessao.perfil !== "RESPONSAVEL") redirect("/painel");
  return sessao;
}

export async function exigirClinica(): Promise<SessaoClinica> {
  const u = await usuarioDaSessao();
  if (u.papel !== "CLINICA" || !u.clinicaId) redirect(inicioDe(u.papel));

  // Duas contas podem cortar o acesso por caminhos diferentes: desativar
  // ESTE login (Usuario.desativadoEm — a pessoa saiu, a clínica continua) ou
  // desativar a clínica inteira (Clinica.ativa — inadimplência, encerramento
  // de contrato). As duas precisam valer na hora, não só no próximo login.
  const usuario = await prisma.usuario.findUnique({
    where: { id: u.id },
    select: {
      desativadoEm: true,
      senhaProvisoria: true,
      clinica: { select: { ativa: true, nome: true } },
    },
  });
  if (!usuario || usuario.desativadoEm || !usuario.clinica?.ativa) redirect("/login");
  if (usuario.senhaProvisoria) redirect(ROTA_TROCAR_SENHA);

  return {
    usuarioId: u.id,
    nome: u.name ?? "",
    clinicaId: u.clinicaId,
    clinicaNome: usuario.clinica.nome,
  };
}

export async function exigirProfissional(): Promise<SessaoProfissional> {
  const u = await usuarioDaSessao();
  const pu = u as any;
  // Aceita usuários PROFISSIONAL normais e usuários INTERNO com profissionalId (dual-perfil).
  const temAcesso = (u.papel === "PROFISSIONAL" || u.papel === "INTERNO") && pu.profissionalId;
  if (!temAcesso) redirect(inicioDe(u.papel));

  const usuario = await prisma.usuario.findUnique({
    where: { id: u.id },
    select: {
      desativadoEm: true,
      senhaProvisoria: true,
      profissional: { select: { ativo: true, nome: true } },
    },
  });
  if (!usuario || usuario.desativadoEm || !usuario.profissional?.ativo) redirect("/login");
  if (usuario.senhaProvisoria) redirect(ROTA_TROCAR_SENHA);

  return {
    usuarioId: u.id,
    nome: u.name ?? "",
    profissionalId: pu.profissionalId,
    profissionalNome: usuario.profissional.nome,
    dualPerfil: u.papel === "INTERNO",
  };
}

/** Rastro das ações que mexem em dinheiro ou em compromisso assumido. */
export async function registrarAuditoria(
  usuarioId: string | null,
  entidade: string,
  entidadeId: string,
  acao: string,
  detalhe?: string
) {
  await prisma.registroAuditoria.create({
    data: { usuarioId, entidade, entidadeId, acao, detalhe },
  });
}
