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
 *
 * Chave Pix (ata de 04/11): o próprio profissional informa e troca, sem
 * depender da central. Para não virar atalho de desvio, a troca exige digitar
 * a chave nova duas vezes, fica na auditoria (antiga → nova) e marca
 * `chavePixAlteradaEm`, que o financeiro vê ao pagar o repasse.
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

  const chavePix = String(dados.get("chavePix") ?? "").trim();
  const confirmacaoPix = String(dados.get("chavePixConfirmacao") ?? "").trim();
  if (chavePix.length > 140) return { ok: false, erro: "Chave Pix longa demais." };

  const antes = await prisma.usuario.findUnique({ where: { id: sessao.usuarioId }, select: { email: true } });
  const atual = await prisma.profissional.findUnique({ where: { id: sessao.profissionalId }, select: { chavePix: true } });
  const pixNovo = chavePix && chavePix !== (atual?.chavePix ?? "") ? chavePix : null;
  if (pixNovo && confirmacaoPix !== chavePix) {
    return { ok: false, erro: "A confirmação não bate com a chave Pix nova. Digite a mesma chave nos dois campos." };
  }
  await prisma.$transaction([
    prisma.profissional.update({
      where: { id: sessao.profissionalId },
      data: {
        email,
        telefone: formatarTelefoneBrasileiro(telefone),
        googleAgendaId: agenda || null,
        ...(pixNovo ? { chavePix: pixNovo, ...(atual?.chavePix ? { chavePixAlteradaEm: new Date() } : {}) } : {}),
      },
    }),
    prisma.usuario.update({ where: { id: sessao.usuarioId }, data: { email } }),
  ]);
  await registrarAuditoria(
    sessao.usuarioId,
    "Profissional",
    sessao.profissionalId,
    "meus-dados",
    [
      antes?.email !== email ? `e-mail de acesso: ${antes?.email} → ${email}` : "contato atualizado",
      pixNovo
        ? atual?.chavePix
          ? `chave Pix trocada pelo profissional: ${atual.chavePix} → ${pixNovo}`
          : "chave Pix informada pelo profissional"
        : null,
    ]
      .filter(Boolean)
      .join(" · ")
  );
  revalidatePath("/profissional");
  revalidatePath("/profissional/meus-dados");
  revalidatePath("/profissional/disponibilidade");
  revalidatePath("/painel/financeiro");
  return { ok: true };
}
