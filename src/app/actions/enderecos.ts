"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { cepValido } from "@/lib/documento";
import { mesmoLocal } from "@/lib/endereco";
import type { Resultado } from "./pedidos";

/**
 * Endereços de atendimento adicionais da clínica (ata de 01/10) — o "casa /
 * trabalho" dos aplicativos de entrega. O escopo vem SEMPRE da sessão: a
 * clínica nunca informa de quem é o endereço.
 */

export async function adicionarEndereco(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  const sessao = await exigirClinica();

  const rotulo = String(dados.get("rotulo") ?? "").trim();
  if (!rotulo) return { ok: false, erro: "Informe o nome da clínica ou consultório (ex.: Unidade Moema)." };

  const cep = String(dados.get("cep") ?? "").trim();
  if (!cepValido(cep)) return { ok: false, erro: "Informe um CEP válido: é dele que sai o endereço do atendimento." };

  const endereco = String(dados.get("endereco") ?? "").trim();
  const uf = String(dados.get("uf") ?? "").trim().toUpperCase().slice(0, 2);
  if (!endereco || uf.length !== 2) return { ok: false, erro: "Confira o CEP — não foi possível preencher o endereço." };

  const numero = String(dados.get("numero") ?? "").trim();
  if (!numero) return { ok: false, erro: "Informe o número." };
  const complemento = String(dados.get("complemento") ?? "").trim() || null;

  // Sem duplicata (ata de 13/10): o mesmo lugar cadastrado duas vezes vira duas
  // opções iguais na hora de agendar, e a central não sabe qual é a certa.
  const clinica = await prisma.clinica.findUnique({
    where: { id: sessao.clinicaId },
    select: {
      cep: true,
      numero: true,
      complemento: true,
      enderecos: { where: { ativo: true }, select: { rotulo: true, cep: true, numero: true, complemento: true } },
    },
  });
  const novo = { cep, numero, complemento };
  if (clinica && mesmoLocal(novo, clinica)) {
    return { ok: false, erro: "Esse endereço já é o do cadastro principal da clínica." };
  }
  const repetido = clinica?.enderecos.find((e) => mesmoLocal(novo, e));
  if (repetido) return { ok: false, erro: `Esse endereço já está cadastrado como "${repetido.rotulo}".` };

  await prisma.enderecoClinica.create({
    data: {
      clinicaId: sessao.clinicaId,
      rotulo,
      cep,
      endereco,
      numero,
      complemento,
      observacoes: String(dados.get("observacoes") ?? "").trim().slice(0, 500) || null,
      bairro: String(dados.get("bairro") ?? "").trim() || null,
      cidade: String(dados.get("cidade") ?? "").trim() || null,
      uf,
    },
  });

  revalidatePath("/portal/enderecos");
  revalidatePath("/portal/agendar");
  return { ok: true };
}

/**
 * Desativa em vez de apagar: pedidos antigos apontam para o endereço, e o
 * histórico precisa continuar dizendo onde o atendimento aconteceu.
 */
export async function removerEndereco(id: string): Promise<Resultado> {
  const sessao = await exigirClinica();
  const resultado = await prisma.enderecoClinica.updateMany({
    where: { id, clinicaId: sessao.clinicaId },
    data: { ativo: false },
  });
  if (resultado.count === 0) return { ok: false, erro: "Endereço não encontrado." };

  revalidatePath("/portal/enderecos");
  revalidatePath("/portal/agendar");
  return { ok: true };
}
