/**
 * Dados iniciais para desenvolvimento e demonstração.
 *
 * Não são os dados reais da Hemoderi: serviços, valores e regras de repasse
 * definitivos entram na Fase 0, com a tabela que a operação usa hoje
 * (docs/fase-0-insumos.md). O que está aqui é o suficiente para navegar as
 * três telas e ver a esteira funcionando ponta a ponta.
 *
 * Roda com `npm run db:seed` e é idempotente: repetir não duplica.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { inicializarCatalogo } from "../src/lib/inicializar";

const prisma = new PrismaClient();

async function main() {
  // Parâmetros, equipamentos e os serviços do catálogo real — a mesma
  // função que /api/setup roda em produção. Ver src/lib/inicializar.ts.
  const { equipamentosCriados, servicosCriados } = await inicializarCatalogo(prisma);
  console.log(`Catálogo pronto (${servicosCriados} serviços, ${equipamentosCriados} equipamentos novos).`);

  const senhaHash = await bcrypt.hash("hemoderi123", 10);

  // ── Equipe interna ────────────────────────────────────────────────────────
  // Dois perfis desde o seed, porque a distinção só se testa tendo os dois:
  // o Responsável (financeiro e acessos) e o Atendente (esteira do dia a
  // dia, sem repasse nem gestão de acesso) — a separação que a reunião de
  // 14/09 pediu ao ver "as meninas" mexendo no sistema.
  await prisma.usuario.upsert({
    where: { email: "equipe@hemoderi.com.br" },
    update: {},
    create: {
      nome: "Equipe Hemoderi",
      email: "equipe@hemoderi.com.br",
      senhaHash,
      papel: "INTERNO",
      perfilInterno: "RESPONSAVEL",
    },
  });
  await prisma.usuario.upsert({
    where: { email: "atendente@hemoderi.com.br" },
    update: {},
    create: {
      nome: "Atendente Hemoderi",
      email: "atendente@hemoderi.com.br",
      senhaHash,
      papel: "INTERNO",
      perfilInterno: "ATENDENTE",
    },
  });

  // ── Clínicas ──────────────────────────────────────────────────────────────
  // Daqui para baixo é só para navegar em desenvolvimento — nunca dado real.
  // Por isso o seed inteiro não pode rodar contra produção: /api/setup chama
  // só inicializarCatalogo(), sem nada do que vem a seguir.
  const clinicas = [
    { nome: "Clínica Santa Rita", slug: "clinica-santa-rita", salas: 10, cidade: "São Paulo", uf: "SP" },
    { nome: "Instituto Vida Plena", slug: "instituto-vida-plena", salas: 3, cidade: "Guarulhos", uf: "SP" },
  ];

  for (const clinica of clinicas) {
    const criada = await prisma.clinica.upsert({
      where: { slug: clinica.slug },
      update: {},
      create: { ...clinica, telefone: "5511900000000" },
    });

    await prisma.usuario.upsert({
      where: { email: `${clinica.slug}@exemplo.com.br` },
      update: {},
      create: {
        nome: clinica.nome,
        email: `${clinica.slug}@exemplo.com.br`,
        senhaHash,
        papel: "CLINICA",
        clinicaId: criada.id,
      },
    });
  }

  // ── Profissionais ─────────────────────────────────────────────────────────
  const profissionais = [
    { nome: "Ana Ribeiro", email: "ana@exemplo.com.br", conselho: "COREN-SP", registro: "123456", repassePercentPadrao: 65 },
    { nome: "Bruno Tavares", email: "bruno@exemplo.com.br", conselho: "COREN-SP", registro: "654321", repassePercentPadrao: null },
  ];

  for (const dados of profissionais) {
    const profissional = await prisma.profissional.upsert({
      where: { email: dados.email },
      update: {},
      create: {
        ...dados,
        telefone: "5511911111111",
        especialidade: "Enfermagem",
        chavePix: dados.email,
      },
    });

    // Segunda a sexta, manhã e tarde — o suficiente para a alocação ter o que
    // oferecer no portal.
    for (let diaSemana = 1; diaSemana <= 5; diaSemana++) {
      const jaTem = await prisma.disponibilidade.findFirst({
        where: { profissionalId: profissional.id, diaSemana },
      });
      if (!jaTem) {
        await prisma.disponibilidade.createMany({
          data: [
            { profissionalId: profissional.id, diaSemana, horaInicio: "08:00", horaFim: "12:00" },
            { profissionalId: profissional.id, diaSemana, horaInicio: "13:00", horaFim: "18:00" },
          ],
        });
      }
    }

    await prisma.usuario.upsert({
      where: { email: dados.email },
      update: {},
      create: {
        nome: dados.nome,
        email: dados.email,
        senhaHash,
        papel: "PROFISSIONAL",
        profissionalId: profissional.id,
      },
    });
  }

  console.log("Seed concluído. Senha de todos os acessos de exemplo: hemoderi123");
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
