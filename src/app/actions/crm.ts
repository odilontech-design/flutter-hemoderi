"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirResponsavel, registrarAuditoria } from "@/lib/sessao";
import { ArquivoCrmInvalido, montarPlanoCrm, type EstadoImportacaoCrm } from "@/lib/crm";
import { executarPlanoCrm } from "@/lib/crm-importacao";

const LIMITE_ARQUIVO_BYTES = 3 * 1024 * 1024;

async function lerArquivo(valor: FormDataEntryValue | null, nome: string): Promise<string | { erro: string }> {
  if (!(valor instanceof File) || valor.size === 0) return { erro: `Escolha o arquivo de ${nome}.` };
  if (valor.size > LIMITE_ARQUIVO_BYTES) return { erro: `O arquivo de ${nome} passou de 3 MB.` };
  return valor.text();
}

/**
 * Importa a base do CRM (PipeDrive) como pré-cadastros — ver lib/crm-importacao.
 * Em duas etapas pelo mesmo formulário: sem `confirmar`, só simula e mostra o
 * que entraria; com `confirmar=sim`, grava. Só o responsável: é a base de
 * clientes inteira, com nome e telefone de milhares de pessoas (LGPD).
 */
export async function importarCrm(_anterior: EstadoImportacaoCrm, dados: FormData): Promise<EstadoImportacaoCrm> {
  const sessao = await exigirResponsavel();

  const organizacoes = await lerArquivo(dados.get("organizacoes"), "organizações");
  if (typeof organizacoes !== "string") return { etapa: "inicial", erro: organizacoes.erro };
  const pessoas = await lerArquivo(dados.get("pessoas"), "pessoas");
  if (typeof pessoas !== "string") return { etapa: "inicial", erro: pessoas.erro };

  let plano;
  try {
    plano = montarPlanoCrm(organizacoes, pessoas);
  } catch (erro) {
    if (erro instanceof ArquivoCrmInvalido) return { etapa: "inicial", erro: erro.message };
    throw erro;
  }
  if (plano.clinicas.length === 0) {
    return { etapa: "inicial", erro: "Nenhuma organização ou pessoa encontrada nos arquivos." };
  }

  const confirmar = String(dados.get("confirmar") ?? "") === "sim";
  const execucao = await executarPlanoCrm(prisma, plano, confirmar);

  if (!confirmar) return { etapa: "previa", resumo: plano.resumo, execucao };

  await registrarAuditoria(sessao.usuarioId, "Clinica", "crm", "importar-crm", JSON.stringify(execucao));
  revalidatePath("/painel/clinicas");
  return { etapa: "concluida", resumo: plano.resumo, execucao };
}
