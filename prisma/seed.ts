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

  // ── Equipamentos ──────────────────────────────────────────────────────────
  // O parque de aparelhos que os serviços abaixo reservam na alocação. A
  // quantidade de cada tipo é um CHUTE — não temos o inventário real — só
  // para a alocação ter o que oferecer sem travar toda vez que dois pedidos
  // do mesmo tipo caírem no mesmo horário. Confirmar na Fase 0.
  const equipamentos: { tipo: string; unidades: number }[] = [
    { tipo: "GBT AirFlow", unidades: 1 },
    { tipo: "Centrífuga PRF", unidades: 2 }, // seis serviços de PRF dependem deste tipo
    { tipo: "Laser LiteTouch", unidades: 1 },
    { tipo: "Piezosurgery Mectron Touch", unidades: 1 },
    { tipo: "Motor de Implante", unidades: 1 },
    { tipo: "Bisturi Elétrico", unidades: 1 },
    { tipo: "Laser Therapy EC + ILIB", unidades: 1 },
    { tipo: "Platinum Platform", unidades: 1 },
    { tipo: "Megaderme", unidades: 1 },
    { tipo: "Atria Ultrassom", unidades: 1 },
  ];

  let numeroPatrimonio = 1;
  for (const { tipo, unidades } of equipamentos) {
    for (let i = 0; i < unidades; i++) {
      const patrimonio = `HMD-${String(numeroPatrimonio++).padStart(3, "0")}`;
      await prisma.equipamento.upsert({
        where: { patrimonio },
        update: {},
        create: { nome: tipo, tipo, patrimonio },
      });
    }
  }

  // ── Serviços ──────────────────────────────────────────────────────────────
  // Os 18 itens do catálogo comercial real da Hemoderi (site/catálogo do
  // WhatsApp — https://hemoderi.com.br/). Nome, categoria e a descrição
  // visível vêm de lá; o resto é estimativa a confirmar na Fase 0:
  //
  //   • Preço: fica em branco (0) de propósito. O catálogo não lista preço
  //     porque o modelo é negociado por clínica — é para isso que existe
  //     PrecoClinica; a "tabela" aqui só serve de referência interna.
  //   • Duração: chute a partir do tipo de procedimento, para a agenda ter
  //     algo para calcular. Precisa vir da equipe antes do go-live real.
  //   • Categoria: nossa leitura da divisão que a própria Hemoderi usa no
  //     catálogo ("🦷 Odontologia | ✨ Estética | 🩸 Saúde") — alguns itens
  //     cruzam especialidade (PRF, Sedação) e a categorização é só uma
  //     primeira aproximação para revisão da equipe.
  const servicos: {
    nome: string;
    categoria: "ODONTOLOGIA" | "ESTETICA" | "SAUDE";
    descricao: string;
    duracaoMin: number;
    exigeEquipamento: boolean;
    tipoEquipamento?: string;
  }[] = [
    {
      nome: "GBT Machine – AirFlow",
      categoria: "ODONTOLOGIA",
      descricao: "Leve uma nova experiência de profilaxia para os seus pacientes. A tecnologia GBT…",
      duracaoMin: 45,
      exigeEquipamento: true,
      tipoEquipamento: "GBT AirFlow",
    },
    {
      nome: "PRF – Coleta e Produção de Concentrados Plaquetários",
      categoria: "SAUDE",
      descricao: "Transforme seus procedimentos com o suporte completo da Hemoderi na produção…",
      duracaoMin: 30,
      exigeEquipamento: true,
      tipoEquipamento: "Centrífuga PRF",
    },
    {
      nome: "LiteTouch – Laser de Alta Potência",
      categoria: "ODONTOLOGIA",
      descricao: "Tenha acesso à tecnologia do Laser LiteTouch diretamente na sua clínica.",
      duracaoMin: 60,
      exigeEquipamento: true,
      tipoEquipamento: "Laser LiteTouch",
    },
    {
      nome: "Piezosurgery + Stickybone + Membranas",
      categoria: "ODONTOLOGIA",
      descricao: "Uma solução completa para procedimentos que exigem tecnologia e planejamento.",
      duracaoMin: 90,
      exigeEquipamento: true,
      tipoEquipamento: "Piezosurgery Mectron Touch",
    },
    {
      nome: "Piezosurgery Mectron Touch",
      categoria: "ODONTOLOGIA",
      descricao: "Tecnologia e precisão para elevar o nível dos seus procedimentos cirúrgicos.",
      duracaoMin: 60,
      exigeEquipamento: true,
      tipoEquipamento: "Piezosurgery Mectron Touch",
    },
    {
      nome: "PRF para Medicina",
      categoria: "SAUDE",
      descricao: "Estrutura e suporte profissional para procedimentos realizados em consultórios e…",
      duracaoMin: 45,
      exigeEquipamento: true,
      tipoEquipamento: "Centrífuga PRF",
    },
    {
      nome: "PRF para Harmonização",
      categoria: "ESTETICA",
      descricao: "Leve a tecnologia dos concentrados plaquetários para seus procedimentos…",
      duracaoMin: 45,
      exigeEquipamento: true,
      tipoEquipamento: "Centrífuga PRF",
    },
    {
      nome: "I-PRF Day",
      categoria: "SAUDE",
      descricao: "Uma experiência completa para produção de concentrados plaquetários em um…",
      duracaoMin: 240,
      exigeEquipamento: true,
      tipoEquipamento: "Centrífuga PRF",
    },
    {
      nome: "Stickybone / PRF Block",
      categoria: "ODONTOLOGIA",
      descricao: "Mais personalização para o planejamento dos seus procedimentos.",
      duracaoMin: 30,
      exigeEquipamento: true,
      tipoEquipamento: "Centrífuga PRF",
    },
    {
      nome: "Membranas – PRF",
      categoria: "ODONTOLOGIA",
      descricao: "Produção especializada de membranas de PRF para complementar seus…",
      duracaoMin: 30,
      exigeEquipamento: true,
      tipoEquipamento: "Centrífuga PRF",
    },
    {
      nome: "Motor de Implante",
      categoria: "ODONTOLOGIA",
      descricao: "Tenha mais praticidade para realizar seus procedimentos com uma…",
      duracaoMin: 90,
      exigeEquipamento: true,
      tipoEquipamento: "Motor de Implante",
    },
    {
      nome: "Bisturi Elétrico",
      categoria: "SAUDE",
      descricao: "Mais estrutura e praticidade para seus procedimentos cirúrgicos.",
      duracaoMin: 60,
      exigeEquipamento: true,
      tipoEquipamento: "Bisturi Elétrico",
    },
    {
      nome: "Laser Therapy EC + ILIB",
      categoria: "SAUDE",
      descricao: "Uma solução prática para profissionais que desejam contar com tecnologia de…",
      duracaoMin: 60,
      exigeEquipamento: true,
      tipoEquipamento: "Laser Therapy EC + ILIB",
    },
    {
      nome: "Platinum Platform",
      categoria: "ESTETICA",
      descricao: "Uma plataforma. Múltiplas possibilidades. A Platinum Platform reúne tecnologia…",
      duracaoMin: 60,
      exigeEquipamento: true,
      tipoEquipamento: "Platinum Platform",
    },
    {
      nome: "Megaderme® – Radiofrequência Microagulhada",
      categoria: "ESTETICA",
      descricao: "Tecnologia avançada para protocolos estéticos que buscam inovação e resultados.",
      duracaoMin: 60,
      exigeEquipamento: true,
      tipoEquipamento: "Megaderme",
    },
    {
      nome: "Ultrassom Micro e Macrofocado – Atria®",
      categoria: "ESTETICA",
      descricao: "Tecnologia, inovação e suporte especializado para seus protocolos estéticos.",
      duracaoMin: 60,
      exigeEquipamento: true,
      tipoEquipamento: "Atria Ultrassom",
    },
    {
      nome: "Cobertura Fotográfica Odontológica",
      categoria: "ODONTOLOGIA",
      descricao: "Cada detalhe merece ser registrado com qualidade profissional.",
      duracaoMin: 60,
      exigeEquipamento: false,
    },
    {
      nome: "Sedação Consciente",
      categoria: "SAUDE",
      descricao: "Mais tranquilidade para o profissional. Mais conforto durante o atendimento.",
      duracaoMin: 60,
      exigeEquipamento: false,
    },
  ];

  for (const servico of servicos) {
    const existente = await prisma.servico.findFirst({ where: { nome: servico.nome } });
    if (!existente) {
      await prisma.servico.create({
        data: { ...servico, valorPadraoCentavos: 0, tipoEquipamento: servico.tipoEquipamento ?? null },
      });
    }
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
