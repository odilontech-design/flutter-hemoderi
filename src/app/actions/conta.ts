"use server";

import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hojeUTC } from "@/lib/data";
import { registrarAuditoria } from "@/lib/sessao";
import { NOME_DA_CONTA_EXCLUIDA, emailAnonimizado, motivoParaNaoExcluir } from "@/lib/exclusao-conta";
import type { Resultado } from "./pedidos";

/**
 * Exclusão da própria conta (clínica ou profissional), pedida de dentro do
 * app. Exige a senha. A conta é encerrada e anonimizada; o histórico que a
 * lei manda guardar (atendimentos, relatórios, repasses e faturas) continua,
 * sem ligação com a pessoa pelo acesso.
 */
export async function excluirMinhaConta(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user?.id) return { ok: false, erro: "Entre para excluir a conta." };
  if (String(dados.get("confirmo") ?? "") !== "sim") return { ok: false, erro: "Marque que entende que o acesso será encerrado." };
  const senha = String(dados.get("senha") ?? "");
  if (!senha) return { ok: false, erro: "Digite a sua senha para confirmar." };

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.user.id },
    select: { id: true, senhaHash: true, papel: true, desativadoEm: true, clinicaId: true, profissionalId: true },
  });
  if (!usuario || usuario.desativadoEm) return { ok: false, erro: "Conta não encontrada." };
  if (!(await bcrypt.compare(senha, usuario.senhaHash))) return { ok: false, erro: "Senha incorreta." };

  const hoje = hojeUTC();
  const ativos = { in: ["SOLICITADO", "CONFIRMADO", "ALOCADO"] as ("SOLICITADO" | "CONFIRMADO" | "ALOCADO")[] };
  const [futurosDoProfissional, futurosDaClinica, acessosDaClinica] = await Promise.all([
    usuario.papel === "PROFISSIONAL" && usuario.profissionalId
      ? prisma.pedido.count({ where: { profissionalId: usuario.profissionalId, status: "ALOCADO", data: { gte: hoje } } })
      : 0,
    usuario.papel === "CLINICA" && usuario.clinicaId
      ? prisma.pedido.count({ where: { clinicaId: usuario.clinicaId, status: ativos, data: { gte: hoje } } })
      : 0,
    usuario.papel === "CLINICA" && usuario.clinicaId
      ? prisma.usuario.count({ where: { clinicaId: usuario.clinicaId, papel: "CLINICA", desativadoEm: null } })
      : 0,
  ]);
  const motivo = motivoParaNaoExcluir({
    papel: usuario.papel,
    atendimentosFuturosDoProfissional: futurosDoProfissional,
    ehOUnicoAcessoDaClinica: acessosDaClinica <= 1,
    agendamentosFuturosDaClinica: futurosDaClinica,
  });
  if (motivo) return { ok: false, erro: motivo };

  await prisma.$transaction(async (tx) => {
    await tx.dispositivoPush.deleteMany({ where: { usuarioId: usuario.id } });
    await tx.usuario.update({
      where: { id: usuario.id },
      data: {
        nome: NOME_DA_CONTA_EXCLUIDA,
        email: emailAnonimizado(usuario.id),
        telefone: null,
        // Senha que ninguém conhece: o acesso não volta nem por redefinição.
        senhaHash: await bcrypt.hash(crypto.randomUUID() + crypto.randomUUID(), 10),
        desativadoEm: new Date(),
      },
    });
    // Profissional: some o contato e a agenda do Google. CPF e chave Pix ficam
    // enquanto houver repasse a prestar contas (obrigação legal).
    if (usuario.papel === "PROFISSIONAL" && usuario.profissionalId) {
      await tx.profissional.update({
        where: { id: usuario.profissionalId },
        data: { telefone: null, email: null, googleAgendaId: null, ativo: false },
      });
    }
  });
  await registrarAuditoria(usuario.id, "Usuario", usuario.id, "excluir-conta", usuario.papel === "PROFISSIONAL" ? "profissional" : "clínica");
  return { ok: true };
}
