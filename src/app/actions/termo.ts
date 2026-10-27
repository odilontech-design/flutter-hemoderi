"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/sessao";
import { VERSAO_DO_TERMO } from "@/lib/termo-aceite";
import type { Resultado } from "./pedidos";

/** "Li e concordei": grava a versão aceita e quando — a prova de que o cliente concordou. */
export async function aceitarTermo(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user?.id || sessao.user.papel !== "CLINICA") return { ok: false, erro: "Sessão expirada. Entre de novo." };
  if (dados.get("concordo") !== "on") return { ok: false, erro: "Marque \"Li e concordo\" para continuar." };

  await prisma.usuario.update({
    where: { id: sessao.user.id },
    data: { termoAceitoEm: new Date(), termoVersao: VERSAO_DO_TERMO },
  });
  await registrarAuditoria(sessao.user.id, "Usuario", sessao.user.id, "aceitar-termo", `versão ${VERSAO_DO_TERMO}`);
  return { ok: true };
}
