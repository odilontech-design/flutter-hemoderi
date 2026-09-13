"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CategoriaServico } from "@prisma/client";
import { exigirInterno } from "@/lib/sessao";
import { gerarSlug } from "@/lib/slug";
import { lerCentavos } from "@/lib/dinheiro";
import type { Resultado } from "./pedidos";

/**
 * Cadastros da operação. Todos passam por exigirInterno(): clínica e
 * profissional consultam o próprio escopo, nunca cadastram.
 */

async function slugLivre(base: string): Promise<string> {
  const raiz = gerarSlug(base) || "clinica";
  let candidato = raiz;
  let n = 2;
  // O slug vai para o link público e para o QR Code impresso; duas clínicas
  // com nome parecido não podem disputar o mesmo endereço.
  while (await prisma.clinica.findUnique({ where: { slug: candidato }, select: { id: true } })) {
    candidato = `${raiz}-${n++}`;
  }
  return candidato;
}

export async function salvarClinica(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  await exigirInterno();

  const id = String(dados.get("id") ?? "");
  const nome = String(dados.get("nome") ?? "").trim();
  if (!nome) return { ok: false, erro: "Informe o nome da clínica." };

  const salas = Number(dados.get("salas") ?? 1);
  const comum = {
    nome,
    cnpj: String(dados.get("cnpj") ?? "") || null,
    telefone: String(dados.get("telefone") ?? "") || null,
    email: String(dados.get("email") ?? "") || null,
    endereco: String(dados.get("endereco") ?? "") || null,
    cidade: String(dados.get("cidade") ?? "") || null,
    uf: String(dados.get("uf") ?? "") || null,
    salas: Number.isFinite(salas) && salas > 0 ? Math.trunc(salas) : 1,
    observacoes: String(dados.get("observacoes") ?? "") || null,
  };

  if (id) {
    await prisma.clinica.update({ where: { id }, data: comum });
  } else {
    await prisma.clinica.create({ data: { ...comum, slug: await slugLivre(nome) } });
  }

  revalidatePath("/painel/clinicas");
  return { ok: true };
}

export async function alternarClinica(id: string, ativa: boolean): Promise<Resultado> {
  await exigirInterno();
  await prisma.clinica.update({
    where: { id },
    data: { ativa, desativadaEm: ativa ? null : new Date() },
  });
  revalidatePath("/painel/clinicas");
  return { ok: true };
}

export async function salvarProfissional(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  await exigirInterno();

  const id = String(dados.get("id") ?? "");
  const nome = String(dados.get("nome") ?? "").trim();
  if (!nome) return { ok: false, erro: "Informe o nome do profissional." };

  const percent = String(dados.get("repassePercentPadrao") ?? "").replace(",", ".");
  const comum = {
    nome,
    cpf: String(dados.get("cpf") ?? "") || null,
    telefone: String(dados.get("telefone") ?? "") || null,
    email: String(dados.get("email") ?? "").toLowerCase().trim() || null,
    conselho: String(dados.get("conselho") ?? "") || null,
    registro: String(dados.get("registro") ?? "") || null,
    especialidade: String(dados.get("especialidade") ?? "") || null,
    chavePix: String(dados.get("chavePix") ?? "") || null,
    repassePercentPadrao: percent ? Number(percent) : null,
  };

  if (id) {
    await prisma.profissional.update({ where: { id }, data: comum });
  } else {
    await prisma.profissional.create({ data: comum });
  }

  revalidatePath("/painel/profissionais");
  return { ok: true };
}

export async function alternarProfissional(id: string, ativo: boolean): Promise<Resultado> {
  await exigirInterno();
  await prisma.profissional.update({
    where: { id },
    data: { ativo, desativadoEm: ativo ? null : new Date() },
  });
  revalidatePath("/painel/profissionais");
  return { ok: true };
}

export async function salvarServico(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  await exigirInterno();

  const id = String(dados.get("id") ?? "");
  const nome = String(dados.get("nome") ?? "").trim();
  if (!nome) return { ok: false, erro: "Informe o nome do serviço." };

  const categoria = String(dados.get("categoria") ?? "");
  if (!["ODONTOLOGIA", "ESTETICA", "SAUDE"].includes(categoria)) {
    return { ok: false, erro: "Selecione a categoria do serviço." };
  }

  const duracao = Number(dados.get("duracaoMin") ?? 60);
  const percent = String(dados.get("repassePercent") ?? "").replace(",", ".");
  const fixo = String(dados.get("repasseFixo") ?? "");
  const exigeEquipamento = String(dados.get("exigeEquipamento") ?? "") === "sim";

  const comum = {
    nome,
    categoria: categoria as CategoriaServico,
    descricao: String(dados.get("descricao") ?? "") || null,
    duracaoMin: Number.isFinite(duracao) && duracao > 0 ? Math.trunc(duracao) : 60,
    valorPadraoCentavos: lerCentavos(String(dados.get("valorPadrao") ?? "")),
    repassePercent: percent ? Number(percent) : null,
    repasseFixoCentavos: fixo ? lerCentavos(fixo) : null,
    exigeEquipamento,
    // Sem "exige equipamento", tipo não faz sentido — mantém o dado limpo em
    // vez de deixar um tipo órfão de um serviço que não usa mais equipamento.
    tipoEquipamento: exigeEquipamento ? String(dados.get("tipoEquipamento") ?? "").trim() || null : null,
  };

  if (id) {
    await prisma.servico.update({ where: { id }, data: comum });
  } else {
    await prisma.servico.create({ data: comum });
  }

  revalidatePath("/painel/catalogo");
  return { ok: true };
}

export async function alternarServico(id: string, ativo: boolean): Promise<Resultado> {
  await exigirInterno();
  await prisma.servico.update({
    where: { id },
    data: { ativo, desativadoEm: ativo ? null : new Date() },
  });
  revalidatePath("/painel/catalogo");
  return { ok: true };
}

export async function salvarEquipamento(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  await exigirInterno();

  const id = String(dados.get("id") ?? "");
  const nome = String(dados.get("nome") ?? "").trim();
  if (!nome) return { ok: false, erro: "Informe o nome do equipamento." };

  const comum = {
    nome,
    tipo: String(dados.get("tipo") ?? "") || null,
    patrimonio: String(dados.get("patrimonio") ?? "") || null,
    status: (String(dados.get("status") ?? "DISPONIVEL") as any) || "DISPONIVEL",
    observacoes: String(dados.get("observacoes") ?? "") || null,
  };

  if (id) {
    await prisma.equipamento.update({ where: { id }, data: comum });
  } else {
    await prisma.equipamento.create({ data: comum });
  }

  revalidatePath("/painel/catalogo");
  return { ok: true };
}

/** Preço negociado de um serviço para uma clínica. Vazio remove o acordo. */
export async function salvarPreco(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  await exigirInterno();

  const clinicaId = String(dados.get("clinicaId") ?? "");
  const servicoId = String(dados.get("servicoId") ?? "");
  const texto = String(dados.get("valor") ?? "").trim();
  if (!clinicaId || !servicoId) return { ok: false, erro: "Clínica e serviço são obrigatórios." };

  if (!texto) {
    await prisma.precoClinica.deleteMany({ where: { clinicaId, servicoId } });
  } else {
    const valorCentavos = lerCentavos(texto);
    await prisma.precoClinica.upsert({
      where: { clinicaId_servicoId: { clinicaId, servicoId } },
      update: { valorCentavos },
      create: { clinicaId, servicoId, valorCentavos },
    });
  }

  revalidatePath("/painel/clinicas");
  return { ok: true };
}
