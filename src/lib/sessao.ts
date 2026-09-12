import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { inicioDe } from "./papeis";

export type SessaoInterno = { usuarioId: string; nome: string };
export type SessaoClinica = { usuarioId: string; nome: string; clinicaId: string; clinicaNome: string };
export type SessaoProfissional = {
  usuarioId: string;
  nome: string;
  profissionalId: string;
  profissionalNome: string;
};

async function usuarioDaSessao() {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user) redirect("/login");
  return sessao.user;
}

/**
 * Guardas de acesso. TODA página e TODA server action começa por uma delas.
 *
 * A sessão é um JWT e não consulta o banco a cada request — de propósito, para
 * não pagar uma ida ao banco por navegação. O preço é que uma desativação
 * feita no meio da sessão de alguém só valeria no próximo login; por isso as
 * guardas de clínica e de profissional reconferem o vínculo. Quem desativa um
 * cliente inadimplente precisa que o corte valha agora, não amanhã.
 */
export async function exigirInterno(): Promise<SessaoInterno> {
  const u = await usuarioDaSessao();
  if (u.papel !== "INTERNO") redirect(inicioDe(u.papel));
  return { usuarioId: u.id, nome: u.name ?? "" };
}

export async function exigirClinica(): Promise<SessaoClinica> {
  const u = await usuarioDaSessao();
  if (u.papel !== "CLINICA" || !u.clinicaId) redirect(inicioDe(u.papel));

  const clinica = await prisma.clinica.findUnique({
    where: { id: u.clinicaId },
    select: { ativa: true, nome: true },
  });
  if (!clinica?.ativa) redirect("/login");

  return {
    usuarioId: u.id,
    nome: u.name ?? "",
    clinicaId: u.clinicaId,
    clinicaNome: clinica.nome,
  };
}

export async function exigirProfissional(): Promise<SessaoProfissional> {
  const u = await usuarioDaSessao();
  if (u.papel !== "PROFISSIONAL" || !u.profissionalId) redirect(inicioDe(u.papel));

  const profissional = await prisma.profissional.findUnique({
    where: { id: u.profissionalId },
    select: { ativo: true, nome: true },
  });
  if (!profissional?.ativo) redirect("/login");

  return {
    usuarioId: u.id,
    nome: u.name ?? "",
    profissionalId: u.profissionalId,
    profissionalNome: profissional.nome,
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
