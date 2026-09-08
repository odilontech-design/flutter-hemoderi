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

const prisma = new PrismaClient();

async function main() {
  const config = await prisma.parametros.upsert({
    where: { id: "hemoderi" },
    update: {},
    create: { id: "hemoderi", whatsapp: "5511994772191", email: "andre@hemoderi.com.br" },
  });
  console.log(`Parâmetros da operação prontos (repasse padrão ${config.repassePercentPadrao}%).`);

  const senhaHash = await bcrypt.hash("hemoderi123", 10);

  // ── Equipe interna ────────────────────────────────────────────────────────
  await prisma.usuario.upsert({
    where: { email: "equipe@hemoderi.com.br" },
    update: {},
    create: { nome: "Equipe Hemoderi", email: "equipe@hemoderi.com.br", senhaHash, papel: "INTERNO" },
  });

  // ── Serviços ──────────────────────────────────────────────────────────────
  const servicos = [
    { nome: "Coleta domiciliar", duracaoMin: 45, valorPadraoCentavos: 18_000, exigeEquipamento: false },
    { nome: "Aplicação em consultório", duracaoMin: 60, valorPadraoCentavos: 22_000, exigeEquipamento: true },
    {
      nome: "Acompanhamento em sessão",
      duracaoMin: 120,
      valorPadraoCentavos: 38_000,
      exigeEquipamento: true,
      // Serviço em que a Hemoderi banca o insumo: repassa menos, e essa
      // exceção vence o percentual do profissional (ver lib/repasse.ts).
      repassePercent: 45,
    },
  ];

  for (const servico of servicos) {
    const existente = await prisma.servico.findFirst({ where: { nome: servico.nome } });
    if (!existente) await prisma.servico.create({ data: servico });
  }

  // ── Equipamentos ──────────────────────────────────────────────────────────
  for (const patrimonio of ["HMD-001", "HMD-002", "HMD-003"]) {
    await prisma.equipamento.upsert({
      where: { patrimonio },
      update: {},
      create: { nome: `Bomba de infusão ${patrimonio}`, tipo: "Bomba de infusão", patrimonio },
    });
  }

  // ── Clínicas ──────────────────────────────────────────────────────────────
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
