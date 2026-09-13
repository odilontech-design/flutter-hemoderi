/**
 * Cria (ou redefine a senha de) um acesso pela linha de comando.
 *
 * Existe porque o primeiro acesso interno não pode depender de uma tela
 * pública de cadastro: quem cria um usuário INTERNO enxerga a operação
 * inteira, e essa porta se abre com acesso ao banco, não pela internet.
 *
 *   npm run db:usuario -- --email=ana@hemoderi.com.br --nome="Ana" --senha=... --papel=INTERNO
 */

import { PrismaClient, type PapelUsuario } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function argumento(nome: string): string | undefined {
  const encontrado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return encontrado?.split("=").slice(1).join("=");
}

async function main() {
  const email = argumento("email")?.toLowerCase().trim();
  const nome = argumento("nome");
  const senha = argumento("senha");
  const papel = (argumento("papel") ?? "INTERNO") as PapelUsuario;
  const vinculoId = argumento("vinculo");

  if (!email || !nome || !senha) {
    console.error('Uso: npm run db:usuario -- --email=... --nome="..." --senha=... [--papel=INTERNO|CLINICA|PROFISSIONAL] [--vinculo=id]');
    process.exit(1);
  }
  if (senha.length < 8) {
    console.error("A senha precisa ter ao menos 8 caracteres.");
    process.exit(1);
  }
  if (papel !== "INTERNO" && !vinculoId) {
    console.error("Acesso de clínica ou profissional exige --vinculo=<id do cadastro>.");
    process.exit(1);
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  // senhaProvisoria fica em false de propósito: esta rotina é a saída de
  // emergência (recuperar o acesso da equipe quando ninguém consegue entrar
  // pelo painel), e quem a roda já está no terminal escolhendo a senha. Forçar
  // troca aqui seria travar justamente o caminho de destravar. Pelo painel,
  // que é como a operação cria acesso no dia a dia, a senha sempre nasce
  // sorteada e provisória.
  await prisma.usuario.upsert({
    where: { email },
    update: { senhaHash, nome, papel, desativadoEm: null, senhaProvisoria: false, senhaTrocadaEm: new Date() },
    create: {
      email,
      nome,
      senhaHash,
      papel,
      senhaProvisoria: false,
      senhaTrocadaEm: new Date(),
      clinicaId: papel === "CLINICA" ? vinculoId : null,
      profissionalId: papel === "PROFISSIONAL" ? vinculoId : null,
    },
  });

  console.log(`Acesso pronto: ${email} (${papel}).`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
