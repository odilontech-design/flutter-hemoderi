"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cepValido, cnpjValido, cpfValido } from "@/lib/documento";
import { conferirSenhaNova } from "@/lib/senha";
import { PERFIS_DO_AUTOCADASTRO } from "@/lib/visibilidade";
import { slugLivre } from "./cadastros";
import type { Resultado } from "./pedidos";

/**
 * Autocadastro do cliente (ata de 01/10): o cliente cria a própria conta e
 * declara o perfil — Odontologia, Medicina ou Estética. Cursos e parcerias são
 * atribuídos só pela equipe: nove em cada dez dentistas também lecionam, e
 * deixar a pessoa escolher "curso" seria desconto por autodeclaração.
 *
 * A conta nasce PENDENTE. Entra e vê o catálogo, mas só agenda depois que a
 * equipe confere o perfil (ver `revisarCadastro`).
 *
 * Rota pública: nada aqui confia no navegador. O campo `site` é uma isca para
 * robôs — pessoa de verdade nunca o vê, nem o preenche.
 */
export async function autocadastrar(_anterior: Resultado, dados: FormData): Promise<Resultado> {
  if (String(dados.get("site") ?? "").trim()) {
    // Robô: responde como se tivesse dado certo, sem criar nada.
    return { ok: true };
  }

  const perfil = String(dados.get("perfil") ?? "");
  if (!(PERFIS_DO_AUTOCADASTRO as string[]).includes(perfil)) {
    return { ok: false, erro: "Escolha o seu perfil: Odontologia, Medicina ou Estética." };
  }

  const nome = String(dados.get("nome") ?? "").trim();
  const responsavel = String(dados.get("responsavel") ?? "").trim();
  if (!nome) return { ok: false, erro: "Informe o nome da clínica ou consultório." };
  if (!responsavel) return { ok: false, erro: "Informe o nome do responsável." };

  const email = String(dados.get("email") ?? "").toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: "Informe um e-mail válido." };

  const telefone = String(dados.get("telefone") ?? "").trim();
  if (telefone.replace(/\D/g, "").length < 10) return { ok: false, erro: "Informe um telefone com DDD." };

  const documento = String(dados.get("cnpj") ?? "").trim();
  if (documento && !cnpjValido(documento) && !cpfValido(documento)) {
    return { ok: false, erro: "CNPJ (ou CPF) inválido — confira se algum dígito ficou trocado." };
  }

  const cep = String(dados.get("cep") ?? "").trim();
  const endereco = String(dados.get("endereco") ?? "").trim();
  const numero = String(dados.get("numero") ?? "").trim();
  const uf = String(dados.get("uf") ?? "").trim().toUpperCase().slice(0, 2);
  if (!cepValido(cep) || !endereco || uf.length !== 2) {
    return { ok: false, erro: "Informe o CEP do atendimento — é dele que sai o endereço e a praça de preço." };
  }
  if (!numero) return { ok: false, erro: "Informe o número do endereço." };

  const problemaSenha = conferirSenhaNova(
    String(dados.get("senha") ?? ""),
    String(dados.get("confirmacao") ?? "")
  );
  if (problemaSenha) return { ok: false, erro: problemaSenha };

  const existente = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
  if (existente) {
    return { ok: false, erro: "Já existe um acesso com esse e-mail. Entre pela tela de login — ou fale com a central." };
  }

  const senhaHash = await bcrypt.hash(String(dados.get("senha")), 10);
  const slug = await slugLivre(nome);

  try {
    await prisma.clinica.create({
    data: {
      nome,
      slug,
      cnpj: documento || null,
      telefone,
      email,
      cep,
      endereco,
      numero,
      complemento: String(dados.get("complemento") ?? "").trim() || null,
      bairro: String(dados.get("bairro") ?? "").trim() || null,
      cidade: String(dados.get("cidade") ?? "").trim() || null,
      uf,
      perfilDeclarado: perfil as (typeof PERFIS_DO_AUTOCADASTRO)[number],
      statusCadastro: "PENDENTE",
      autocadastro: true,
      usuarios: {
        create: {
          nome: responsavel,
          email,
          telefone,
          senhaHash,
          papel: "CLINICA",
          // A senha é do próprio cliente: não há o que trocar na primeira entrada.
          senhaProvisoria: false,
        },
      },
    },
    });
  } catch (e) {
    // Duas pessoas (ou dois cliques) com o mesmo e-mail ao mesmo tempo: a
    // conferência de cima passou para as duas, e o índice único recusa a segunda.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, erro: "Já existe um acesso com esse e-mail. Entre pela tela de login." };
    }
    throw e;
  }

  return { ok: true };
}
