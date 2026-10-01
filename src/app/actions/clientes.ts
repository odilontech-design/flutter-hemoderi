"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirInterno, registrarAuditoria } from "@/lib/sessao";
import { perfilPermite } from "@/lib/papeis";
import { lerPerfis } from "@/lib/visibilidade";
import type { Resultado } from "./pedidos";

/**
 * Classificação do cliente (ata de 01/10): o perfil decide o que ele vê no
 * catálogo e a que tabela de preço tem direito. Só a equipe atribui — o
 * cliente declara no autocadastro, a equipe confere e aprova.
 *
 * É a mesa do comercial (a Ana revisa os cadastros novos); o responsável passa
 * em tudo, como em qualquer ação restrita a perfil.
 */
async function exigirComercial() {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "COMERCIAL", "ATENDENTE")) {
    return { sessao, erro: "A classificação de clientes é do comercial." };
  }
  return { sessao, erro: null };
}

function atualizarTelas(clinicaId: string) {
  revalidatePath("/painel/clinicas");
  revalidatePath(`/painel/clinicas/${clinicaId}`);
  revalidatePath("/portal");
}

/** Perfis e tabelas de preço liberados para a clínica — uma ou várias de cada. */
export async function salvarPerfilDaClinica(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const { sessao, erro } = await exigirComercial();
  if (erro) return { ok: false, erro };

  const clinicaId = String(dados.get("clinicaId") ?? "");
  const perfis = lerPerfis(dados.getAll("perfis"));
  const tabelaIds = dados.getAll("tabelas").map(String).filter(Boolean);

  const clinica = await prisma.clinica.findUnique({ where: { id: clinicaId }, select: { id: true } });
  if (!clinica) return { ok: false, erro: "Clínica não encontrada." };

  await prisma.clinica.update({
    where: { id: clinicaId },
    data: { perfis, tabelas: { set: tabelaIds.map((id) => ({ id })) } },
  });
  await registrarAuditoria(
    sessao.usuarioId,
    "Clinica",
    clinicaId,
    "perfil",
    `${perfis.join(", ") || "sem perfil"} · ${tabelaIds.length} tabela(s)`
  );

  atualizarTelas(clinicaId);
  return { ok: true };
}

/**
 * Liga ou desliga UM perfil do cliente — o gesto direto da tela de Acessos,
 * sem abrir a clínica. Mexe só nos perfis: as tabelas liberadas à mão ficam
 * como estão (o perfil traz a tabela dele sozinho, ver tabelasDaClinica).
 */
export async function alternarPerfilDaClinica(clinicaId: string, perfil: string, ligado: boolean): Promise<Resultado> {
  const { sessao, erro } = await exigirComercial();
  if (erro) return { ok: false, erro };

  const [valido] = lerPerfis([perfil]);
  if (!valido) return { ok: false, erro: "Perfil desconhecido." };

  const clinica = await prisma.clinica.findUnique({ where: { id: clinicaId }, select: { perfis: true } });
  if (!clinica) return { ok: false, erro: "Clínica não encontrada." };

  const atuais = clinica.perfis.filter((p) => p !== valido);
  const perfis = ligado ? [...atuais, valido] : atuais;

  await prisma.clinica.update({ where: { id: clinicaId }, data: { perfis } });
  await registrarAuditoria(
    sessao.usuarioId,
    "Clinica",
    clinicaId,
    "perfil",
    `${ligado ? "+" : "-"}${valido} → ${perfis.join(", ") || "sem perfil"}`
  );

  atualizarTelas(clinicaId);
  revalidatePath("/painel/acessos");
  revalidatePath("/portal/catalogo");
  return { ok: true };
}

/**
 * A triagem do autocadastro: confere o que o cliente declarou e libera (ou
 * não) o agendamento. Aprovar grava os perfis CONFIRMADOS — que podem diferir
 * do declarado, é justamente para isso que existe a conferência.
 */
export async function revisarCadastro(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const { sessao, erro } = await exigirComercial();
  if (erro) return { ok: false, erro };

  const clinicaId = String(dados.get("clinicaId") ?? "");
  const decisao = String(dados.get("decisao") ?? "");
  if (decisao !== "aprovar" && decisao !== "recusar") return { ok: false, erro: "Escolha aprovar ou recusar." };

  const clinica = await prisma.clinica.findUnique({
    where: { id: clinicaId },
    select: { id: true, statusCadastro: true },
  });
  if (!clinica) return { ok: false, erro: "Clínica não encontrada." };

  if (decisao === "recusar") {
    await prisma.clinica.update({
      where: { id: clinicaId },
      data: { statusCadastro: "RECUSADO", cadastroRevisadoEm: new Date() },
    });
    await registrarAuditoria(sessao.usuarioId, "Clinica", clinicaId, "cadastro-recusado");
  } else {
    const perfis = lerPerfis(dados.getAll("perfis"));
    if (perfis.length === 0) {
      return { ok: false, erro: "Marque o perfil confirmado do cliente antes de aprovar." };
    }
    const tabelaIds = dados.getAll("tabelas").map(String).filter(Boolean);
    await prisma.clinica.update({
      where: { id: clinicaId },
      data: {
        statusCadastro: "APROVADO",
        cadastroRevisadoEm: new Date(),
        perfis,
        tabelas: { set: tabelaIds.map((id) => ({ id })) },
      },
    });
    await registrarAuditoria(sessao.usuarioId, "Clinica", clinicaId, "cadastro-aprovado", perfis.join(", "));
  }

  atualizarTelas(clinicaId);
  return { ok: true };
}
