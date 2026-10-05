"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, type CategoriaServico, type UnidadeCobranca } from "@prisma/client";
import { exigirInterno } from "@/lib/sessao";
import { gerarSlug } from "@/lib/slug";
import { lerCentavos } from "@/lib/dinheiro";
import { cepValido, cnpjValido, cpfValido } from "@/lib/documento";
import { condicaoValida } from "@/lib/pagamento";
import { lerUfs } from "@/lib/uf";
import { lerPerfis } from "@/lib/visibilidade";
import type { Resultado } from "./pedidos";

/**
 * Cadastros da operação. Todos passam por exigirInterno(): clínica e
 * profissional consultam o próprio escopo, nunca cadastram.
 */

export async function slugLivre(base: string): Promise<string> {
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

  // O documento é conferido no servidor mesmo já sendo conferido na tela: a
  // server action é chamável sem passar por formulário nenhum.
  const cnpj = String(dados.get("cnpj") ?? "").trim();
  if (cnpj && !cnpjValido(cnpj) && !cpfValido(cnpj)) {
    return { ok: false, erro: "CNPJ (ou CPF) inválido — confira se algum dígito ficou trocado." };
  }

  const cep = String(dados.get("cep") ?? "").trim();
  if (!cepValido(cep)) {
    return { ok: false, erro: "Informe um CEP válido: é dele que sai o endereço do atendimento." };
  }

  const salas = Number(dados.get("salas") ?? 1);
  const condicaoInformada = String(dados.get("condicaoPagamento") ?? "").trim();
  const comum = {
    nome,
    cnpj: cnpj || null,
    telefone: String(dados.get("telefone") ?? "") || null,
    email: String(dados.get("email") ?? "") || null,
    cep,
    endereco: String(dados.get("endereco") ?? "") || null,
    numero: String(dados.get("numero") ?? "").trim() || null,
    complemento: String(dados.get("complemento") ?? "").trim() || null,
    bairro: String(dados.get("bairro") ?? "") || null,
    cidade: String(dados.get("cidade") ?? "") || null,
    uf: String(dados.get("uf") ?? "") || null,
    salas: Number.isFinite(salas) && salas > 0 ? Math.trunc(salas) : 1,
    // Mesmo vocabulário fechado do pedido (lib/pagamento.ts): duas listas
    // diferentes para a mesma pergunta viram "Antecipado" e "antecipado"
    // significando a mesma coisa no fechamento do mês.
    condicaoPagamento: condicaoValida(condicaoInformada) ? condicaoInformada : null,
    observacoes: String(dados.get("observacoes") ?? "") || null,
  };

  if (id) {
    await prisma.clinica.update({ where: { id }, data: comum });
  } else {
    // O cadastro novo feito pela equipe já nasce com o perfil escolhido; na
    // edição os perfis têm tela própria (Perfil e tabelas de preço) e não são
    // tocados aqui — senão salvar o endereço apagaria a classificação.
    await prisma.clinica.create({
      data: { ...comum, slug: await slugLivre(nome), perfis: lerPerfis(dados.getAll("perfis")) },
    });
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

  const cpf = String(dados.get("cpf") ?? "").trim();
  if (cpf && !cpfValido(cpf)) {
    return { ok: false, erro: "CPF inválido — confira se algum dígito ficou trocado." };
  }

  const percent = String(dados.get("repassePercentPadrao") ?? "").replace(",", ".");
  const fixo = String(dados.get("repasseFixoCentavos") ?? "").trim();
  const comum = {
    nome,
    cpf: cpf || null,
    telefone: String(dados.get("telefone") ?? "") || null,
    email: String(dados.get("email") ?? "").toLowerCase().trim() || null,
    conselho: String(dados.get("conselho") ?? "") || null,
    registro: String(dados.get("registro") ?? "") || null,
    especialidade: String(dados.get("especialidade") ?? "").trim() || null,
    chavePix: String(dados.get("chavePix") ?? "") || null,
    repassePercentPadrao: percent ? Number(percent) : null,
    // O valor fixo é o combinado atual da operação (ata de 14/09); o
    // percentual fica ao lado como histórico de acertos anteriores.
    repasseFixoCentavos: fixo ? lerCentavos(fixo) : null,
    // A equipe pode preencher pelo profissional (é comum ele passar o e-mail
    // por WhatsApp), mas quem conecta de verdade é ele: compartilhar a agenda
    // com a conta de serviço só acontece dentro da conta Google dele.
    googleAgendaId: String(dados.get("googleAgendaId") ?? "").toLowerCase().trim() || null,
    // Praça onde atende de fato (ata de 21/09 — repasse varia por estado) e o
    // grupo que decide o repasse dele quando não há acerto individual.
    uf: String(dados.get("uf") ?? "").toUpperCase().trim().slice(0, 2) || null,
    grupoRepasseId: String(dados.get("grupoRepasseId") ?? "") || null,
  };

  // Serviços aptos (ata de 02/10): só ids que existem; a lista inteira é
  // substituída a cada salvamento, inclusive para esvaziar.
  const idsPedidos = dados.getAll("servicosAptosIds").map(String).filter(Boolean);
  const idsValidos = idsPedidos.length
    ? (await prisma.servico.findMany({ where: { id: { in: idsPedidos } }, select: { id: true } })).map((x) => x.id)
    : [];

  if (id) {
    await prisma.profissional.update({
      where: { id },
      data: { ...comum, servicosAptos: { set: idsValidos.map((servicoId) => ({ id: servicoId })) } },
    });
  } else {
    await prisma.profissional.create({
      data: { ...comum, servicosAptos: { connect: idsValidos.map((servicoId) => ({ id: servicoId })) } },
    });
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

/**
 * Cobrança, quantidade e oferta do serviço (ata de 01/10). Sem quantidade
 * variável, o rótulo e o máximo são limpos: um "dentes" órfão de um serviço
 * que não conta mais dentes confundiria a próxima pessoa que abrisse o cadastro.
 */
function lerRegrasDeOferta(dados: FormData) {
  const unidade = String(dados.get("unidadeCobranca") ?? "PACIENTE");
  const permiteQuantidade = String(dados.get("permiteQuantidade") ?? "nao") === "sim";
  const maxima = Math.trunc(Number(dados.get("quantidadeMaxima")));
  const minima = Math.trunc(Number(dados.get("quantidadeMinima")));
  const incluida = Math.trunc(Number(dados.get("quantidadeIncluida")));

  return {
    unidadeCobranca: (["PACIENTE", "PERIODO", "HORA"].includes(unidade) ? unidade : "PACIENTE") as UnidadeCobranca,
    permiteQuantidade,
    rotuloQuantidade: permiteQuantidade ? String(dados.get("rotuloQuantidade") ?? "").trim() || null : null,
    quantidadeMaxima: permiteQuantidade && Number.isFinite(maxima) && maxima > 0 ? maxima : null,
    quantidadeMinima: permiteQuantidade && Number.isFinite(minima) && minima > 0 ? minima : 1,
    // Franquia e adicional andam juntos: um adicional sem franquia não teria a
    // partir de quando valer.
    quantidadeIncluida: permiteQuantidade && Number.isFinite(incluida) && incluida > 0 ? incluida : null,
    valorAdicionalCentavos:
      permiteQuantidade && Number.isFinite(incluida) && incluida > 0
        ? lerCentavos(String(dados.get("valorAdicional") ?? ""))
        : 0,
    perfis: lerPerfis(dados.getAll("perfis")),
    ufsIndisponiveis: lerUfs(dados.getAll("ufsIndisponiveis").join(",")),
  };
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
  // Três estados num seletor só: não exige, exige e reserva, exige sem
  // disputar estoque.
  const escolhaEquipamento = String(dados.get("exigeEquipamento") ?? "");
  const exigeEquipamento = escolhaEquipamento === "sim" || escolhaEquipamento === "ilimitado";
  const equipamentoIlimitado = escolhaEquipamento === "ilimitado";

  const comum = {
    nome,
    categoria: categoria as CategoriaServico,
    descricao: String(dados.get("descricao") ?? "") || null,
    duracaoMin: Number.isFinite(duracao) && duracao > 0 ? Math.trunc(duracao) : 60,
    valorPadraoCentavos: lerCentavos(String(dados.get("valorPadrao") ?? "")),
    repassePercent: percent ? Number(percent) : null,
    repasseFixoCentavos: fixo ? lerCentavos(fixo) : null,
    exigeEquipamento,
    equipamentoIlimitado,
    // Vazio deixa lib/familia.ts inferir do nome — a vitrine pública não pode
    // depender de alguém classificar dezoito itens antes de existir.
    familia: String(dados.get("familia") ?? "").trim() || null,
    // Sem "exige equipamento", tipo não faz sentido — mantém o dado limpo em
    // vez de deixar um tipo órfão de um serviço que não usa mais equipamento.
    tipoEquipamento: exigeEquipamento ? String(dados.get("tipoEquipamento") ?? "").trim() || null : null,
    ...lerRegrasDeOferta(dados),
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

/**
 * Praça de preço: um nome e as UFs que caem nela (ata de 28/09).
 *
 * A sobreposição é recusada, não resolvida por desempate: duas praças
 * reivindicando SP fariam o preço da clínica paulista depender de qual
 * consulta o banco devolvesse primeiro — e um preço que oscila sozinho é
 * pior do que um cadastro que reclama na hora.
 */
export async function salvarRegiaoPreco(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  await exigirInterno();

  const id = String(dados.get("id") ?? "");
  const nome = String(dados.get("nome") ?? "").trim();
  if (!nome) return { ok: false, erro: "Dê um nome à praça — é por ele que a equipe a reconhece." };

  const ufs = lerUfs(String(dados.get("ufs") ?? ""));
  if (ufs.length === 0) {
    return { ok: false, erro: "Informe ao menos uma UF válida (ex.: SP, RJ, MG)." };
  }

  const conflitos = await prisma.regiaoPreco.findMany({
    where: { ufs: { hasSome: ufs }, ...(id ? { NOT: { id } } : {}) },
    select: { nome: true, ufs: true },
  });
  if (conflitos.length > 0) {
    const repetidas = [...new Set(conflitos.flatMap((c) => c.ufs.filter((uf) => ufs.includes(uf as never))))];
    return {
      ok: false,
      erro: `${repetidas.join(", ")} já está em "${conflitos[0].nome}". Cada UF pertence a uma praça só.`,
    };
  }

  try {
    if (id) {
      await prisma.regiaoPreco.update({ where: { id }, data: { nome, ufs } });
    } else {
      await prisma.regiaoPreco.create({ data: { nome, ufs } });
    }
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { ok: false, erro: `Já existe uma praça chamada "${nome}".` };
    }
    throw erro;
  }

  revalidatePath("/painel/catalogo/regioes");
  return { ok: true };
}

export async function alternarRegiaoPreco(id: string, ativa: boolean): Promise<Resultado> {
  await exigirInterno();
  await prisma.regiaoPreco.update({ where: { id }, data: { ativa } });
  revalidatePath("/painel/catalogo/regioes");
  return { ok: true };
}

/** Preço de um serviço numa praça. Vazio remove — o serviço volta à tabela. */
export async function salvarPrecoRegiao(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  await exigirInterno();

  const regiaoId = String(dados.get("regiaoId") ?? "");
  const servicoId = String(dados.get("servicoId") ?? "");
  const texto = String(dados.get("valor") ?? "").trim();
  if (!regiaoId || !servicoId) return { ok: false, erro: "Praça e serviço são obrigatórios." };

  if (!texto) {
    await prisma.precoRegiao.deleteMany({ where: { regiaoId, servicoId } });
  } else {
    const valorCentavos = lerCentavos(texto);
    if (valorCentavos <= 0) return { ok: false, erro: "Informe um valor maior que zero." };
    await prisma.precoRegiao.upsert({
      where: { regiaoId_servicoId: { regiaoId, servicoId } },
      update: { valorCentavos },
      create: { regiaoId, servicoId, valorCentavos },
    });
  }

  revalidatePath("/painel/catalogo/regioes");
  return { ok: true };
}
