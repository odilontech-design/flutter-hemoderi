"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type PerfilCliente } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { perfilPermite } from "@/lib/papeis";
import { lerCentavos } from "@/lib/dinheiro";
import { TODOS_OS_PERFIS } from "@/lib/visibilidade";
import type { Resultado } from "./pedidos";

/**
 * Tabelas de preço por perfil de cliente (ata de 01/10): "Consultório
 * particular", "Cursos", "Mandic". É preço comercial — mexe no que a clínica
 * paga —, então fica com o comercial (e com o responsável, que passa em tudo).
 */
async function exigirComercial() {
  const sessao = await exigirInterno();
  if (!perfilPermite(sessao.perfil, "COMERCIAL", "ATENDENTE")) {
    return { sessao, erro: "Tabelas de preço são do comercial." };
  }
  return { sessao, erro: null };
}

function lerPerfil(valor: FormDataEntryValue | null): PerfilCliente | null {
  const texto = String(valor ?? "");
  return (TODOS_OS_PERFIS as string[]).includes(texto) ? (texto as PerfilCliente) : null;
}

function atualizarTelas() {
  revalidatePath("/painel/catalogo/tabelas");
  revalidatePath("/painel/clinicas");
}

/**
 * Cria ou renomeia uma tabela. No cadastro novo, "copiar de" parte de uma
 * tabela existente — é como "Cursos" nasce de "Consultório" com três preços
 * ajustados, em vez de redigitar trinta e quatro.
 */
export async function salvarTabela(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const { erro } = await exigirComercial();
  if (erro) return { ok: false, erro };

  const id = String(dados.get("id") ?? "");
  const nome = String(dados.get("nome") ?? "").trim();
  if (!nome) return { ok: false, erro: "Dê um nome à tabela — é por ele que a equipe a reconhece." };

  const comum = {
    nome,
    descricao: String(dados.get("descricao") ?? "").trim() || null,
    perfil: lerPerfil(dados.get("perfil")),
  };

  try {
    if (id) {
      await prisma.tabelaPreco.update({ where: { id }, data: comum });
    } else {
      const copiarDeId = String(dados.get("copiarDeId") ?? "");
      await prisma.$transaction(async (tx) => {
        const nova = await tx.tabelaPreco.create({ data: comum });
        if (copiarDeId) {
          const itens = await tx.precoTabela.findMany({
            where: { tabelaId: copiarDeId },
            select: { servicoId: true, valorCentavos: true },
          });
          if (itens.length > 0) {
            await tx.precoTabela.createMany({
              data: itens.map((item) => ({ ...item, tabelaId: nova.id })),
            });
          }
        }
      });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, erro: `Já existe uma tabela chamada "${nome}".` };
    }
    throw e;
  }

  atualizarTelas();
  return { ok: true };
}

/** Duplica uma tabela com todos os preços — a "cópia" da ata, em um clique. */
export async function duplicarTabela(id: string): Promise<Resultado> {
  const { erro } = await exigirComercial();
  if (erro) return { ok: false, erro };

  const origem = await prisma.tabelaPreco.findUnique({
    where: { id },
    include: { itens: { select: { servicoId: true, valorCentavos: true } } },
  });
  if (!origem) return { ok: false, erro: "Tabela não encontrada." };

  // Nome livre: "X (cópia)", "X (cópia 2)"… sem estourar a unicidade.
  let nome = `${origem.nome} (cópia)`;
  for (let n = 2; await prisma.tabelaPreco.findUnique({ where: { nome }, select: { id: true } }); n++) {
    nome = `${origem.nome} (cópia ${n})`;
  }

  await prisma.tabelaPreco.create({
    data: {
      nome,
      descricao: origem.descricao,
      perfil: origem.perfil,
      itens: { create: origem.itens },
    },
  });

  atualizarTelas();
  return { ok: true };
}

export async function alternarTabela(id: string, ativa: boolean): Promise<Resultado> {
  const { erro } = await exigirComercial();
  if (erro) return { ok: false, erro };
  await prisma.tabelaPreco.update({ where: { id }, data: { ativa } });
  atualizarTelas();
  return { ok: true };
}

/** Preço de um serviço numa tabela. Vazio remove — o serviço sai da tabela. */
export async function salvarPrecoTabela(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const { erro } = await exigirComercial();
  if (erro) return { ok: false, erro };

  const tabelaId = String(dados.get("tabelaId") ?? "");
  const servicoId = String(dados.get("servicoId") ?? "");
  const texto = String(dados.get("valor") ?? "").trim();
  if (!tabelaId || !servicoId) return { ok: false, erro: "Tabela e serviço são obrigatórios." };

  if (!texto) {
    await prisma.precoTabela.deleteMany({ where: { tabelaId, servicoId } });
  } else {
    const valorCentavos = lerCentavos(texto);
    if (valorCentavos <= 0) return { ok: false, erro: "Informe um valor maior que zero." };
    await prisma.precoTabela.upsert({
      where: { tabelaId_servicoId: { tabelaId, servicoId } },
      update: { valorCentavos },
      create: { tabelaId, servicoId, valorCentavos },
    });
  }

  revalidatePath("/painel/catalogo/tabelas");
  return { ok: true };
}
