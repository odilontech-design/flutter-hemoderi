"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirProfissional, registrarAuditoria } from "@/lib/sessao";
import { formatarTelefoneBrasileiro, lerTelefoneBrasileiro, MENSAGEM_TELEFONE_INVALIDO } from "@/lib/telefone";
import type { Resultado } from "./pedidos";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * O profissional mantém os próprios dados de contato (ata de 20/10): e-mail
 * — que também é o de acesso ao portal —, telefone e a agenda do Google.
 * Nome, CPF, registro e chave Pix continuam com a central: são os dados que
 * identificam quem atende e para onde vai o pagamento, e trocar a chave Pix
 * sozinho seria o atalho de quem quer desviar um repasse.
 */
export async function salvarMeusDados(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await exigirProfissional();

  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, erro: "Informe um e-mail válido — é com ele que você entra no portal." };

  const telefone = lerTelefoneBrasileiro(String(dados.get("telefone") ?? ""));
  if (!telefone) return { ok: false, erro: `Telefone: ${MENSAGEM_TELEFONE_INVALIDO}` };

  const agenda = String(dados.get("googleAgendaId") ?? "").trim().toLowerCase();
  if (agenda && !EMAIL.test(agenda)) {
    return { ok: false, erro: "A agenda do Google é o e-mail da sua conta Google (ex.: voce@gmail.com)." };
  }

  const [outroUsuario, outroProfissional] = await Promise.all([
    prisma.usuario.findFirst({ where: { email, id: { not: sessao.usuarioId } }, select: { id: true } }),
    prisma.profissional.findFirst({ where: { email, id: { not: sessao.profissionalId } }, select: { id: true } }),
  ]);
  if (outroUsuario || outroProfissional) {
    return { ok: false, erro: "Esse e-mail já está em outro cadastro. Use outro ou fale com a central." };
  }

  const antes = await prisma.usuario.findUnique({ where: { id: sessao.usuarioId }, select: { email: true } });
  await prisma.$transaction([
    prisma.profissional.update({
      where: { id: sessao.profissionalId },
      data: { email, telefone: formatarTelefoneBrasileiro(telefone), googleAgendaId: agenda || null },
    }),
    prisma.usuario.update({ where: { id: sessao.usuarioId }, data: { email } }),
  ]);
  await registrarAuditoria(
    sessao.usuarioId,
    "Profissional",
    sessao.profissionalId,
    "meus-dados",
    antes?.email !== email ? `e-mail de acesso: ${antes?.email} → ${email}` : "contato atualizado"
  );

  revalidatePath("/profissional/meus-dados");
  revalidatePath("/profissional/disponibilidade");
  return { ok: true };
}
