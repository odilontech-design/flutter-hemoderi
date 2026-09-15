/**
 * O catálogo real da Hemoderi: parâmetros da operação, o parque de
 * equipamentos e os serviços do catálogo comercial 2026
 * (CAT_LOGO_HEMODERI_2026.pdf — enviado pela Hemoderi). Compartilhado entre
 * o seed de desenvolvimento (`prisma/seed.ts`, que soma clínicas e
 * profissionais fictícios por cima) e a configuração inicial de produção
 * (`/api/setup`, que NUNCA deve tocar em dado fictício) — para as duas
 * fontes não divergirem com o tempo.
 *
 * Idempotente na criação: rodar de novo não duplica nada, mas também não
 * ATUALIZA um serviço que já existe — o cadastro pelo painel (agora com
 * todo campo editável) é o caminho certo para corrigir um valor depois do
 * catálogo já estar de pé, sem que rodar `/api/setup` de novo apague um
 * ajuste que a equipe fez na tela.
 */

import type { PrismaClient } from "@prisma/client";

type CategoriaServico = "ODONTOLOGIA" | "ESTETICA" | "SAUDE";

type DefinicaoEquipamento = { tipo: string; unidades: number };

type DefinicaoServico = {
  nome: string;
  categoria: CategoriaServico;
  descricao: string;
  duracaoMin: number;
  /** Em centavos — o "Investimento" do catálogo 2026, valor Grande São Paulo. */
  valorPadraoCentavos: number;
  exigeEquipamento: boolean;
  tipoEquipamento?: string;
};

// O parque de aparelhos que os serviços abaixo reservam na alocação. A
// quantidade de cada tipo é um CHUTE — não temos o inventário real — só
// para a alocação ter o que oferecer sem travar toda vez que dois pedidos
// do mesmo tipo caírem no mesmo horário. Confirmar na Fase 0.
export const EQUIPAMENTOS_DO_CATALOGO: DefinicaoEquipamento[] = [
  { tipo: "GBT AirFlow", unidades: 1 },
  { tipo: "Centrífuga PRF", unidades: 2 }, // cinco serviços de PRF dependem deste tipo
  { tipo: "Laser LiteTouch", unidades: 1 },
  { tipo: "Piezosurgery Mectron Touch", unidades: 1 },
  { tipo: "Motor de Implante", unidades: 1 },
  { tipo: "Bisturi Elétrico", unidades: 1 },
  { tipo: "Laser Therapy EC + ILIB", unidades: 1 },
  { tipo: "Platinum Platform", unidades: 1 },
  { tipo: "Megaderme", unidades: 1 },
  { tipo: "Atria Ultrassom", unidades: 1 },
];

// Nome, categoria, preço e descrição vêm do catálogo 2026 (a seção
// "Investimento", páginas finais — é a tabela que a própria Hemoderi usa
// como preço de referência). O que ainda é estimativa a confirmar na Fase 0
// (docs/fase-0-insumos.md):
//
//   • Duração: onde o catálogo declara o período contratado ("4 horas",
//     "até 3 horas de funcionamento"), a duração vem de lá. Sem essa
//     informação, é um chute a partir do tipo de procedimento — a agenda
//     precisa de algo para calcular até a equipe confirmar o tempo real.
//   • Categoria: nossa leitura da divisão que a própria Hemoderi usa no
//     catálogo ("🦷 Odontologia | ✨ Estética | 🩸 Saúde") — alguns itens
//     cruzam especialidade (PRF, Sedação) e a categorização é só uma
//     primeira aproximação para revisão da equipe.
//   • Preço: é o valor "Grande São Paulo" quando o catálogo lista mais de
//     uma região (Sedação Consciente também tem tarifa de Interior,
//     R$1.050,00 — fica só na descrição, o sistema não modela preço por
//     praça). É o valor de TABELA: PrecoClinica continua sendo onde mora o
//     valor negociado por clínica quando ele existir.
//
// Um combo do catálogo ficou de fora de propósito: "Stickybone + Membranas
// + Piezosurgery + Sedação" (R$1.690,00) reserva DOIS equipamentos ao mesmo
// tempo (Piezo e Rotamix), e o sistema hoje só trava um tipo de equipamento
// por serviço. Cadastrar esse combo aqui arriscaria dar dois "sim" para o
// mesmo Rotamix em horários simultâneos — o oposto do que a alocação existe
// para evitar. Falta modelar equipamento múltiplo por serviço antes de
// oferecê-lo como reserva automática.
export const SERVICOS_DO_CATALOGO: DefinicaoServico[] = [
  // ── AirFlow – GBT Machine ──────────────────────────────────────────────
  {
    nome: "AirFlow – GBT Machine (1 paciente)",
    categoria: "ODONTOLOGIA",
    descricao: "Profilaxia guiada (GBT): identifica e remove o biofilme com AirFlow, minimamente invasiva.",
    duracaoMin: 60,
    valorPadraoCentavos: 50_000,
    exigeEquipamento: true,
    tipoEquipamento: "GBT AirFlow",
  },
  {
    nome: "AirFlow – GBT Machine (pacote 3 pacientes)",
    categoria: "ODONTOLOGIA",
    descricao: "Locação do GBT Machine por 4 horas para até 3 pacientes, com profissional incluso no primeiro.",
    duracaoMin: 240,
    valorPadraoCentavos: 120_000,
    exigeEquipamento: true,
    tipoEquipamento: "GBT AirFlow",
  },
  {
    nome: "AirFlow – GBT Machine (pacote 6 pacientes)",
    categoria: "ODONTOLOGIA",
    descricao: "Locação do GBT Machine por 6 horas para até 6 pacientes, com profissional incluso no primeiro.",
    duracaoMin: 360,
    valorPadraoCentavos: 210_000,
    exigeEquipamento: true,
    tipoEquipamento: "GBT AirFlow",
  },
  {
    nome: "AirFlow – GBT Machine (pacote 9 pacientes)",
    categoria: "ODONTOLOGIA",
    descricao: "Locação do GBT Machine por 8 horas para até 9 pacientes, com profissional incluso no primeiro.",
    duracaoMin: 480,
    valorPadraoCentavos: 300_000,
    exigeEquipamento: true,
    tipoEquipamento: "GBT AirFlow",
  },

  // ── LiteTouch ────────────────────────────────────────────────────────────
  {
    nome: "LiteTouch – Remoção de Lentes, Facetas e Coroas",
    categoria: "ODONTOLOGIA",
    descricao: "Remoção com laser de alta potência, por paciente, até 2 elementos.",
    duracaoMin: 60,
    valorPadraoCentavos: 75_000,
    exigeEquipamento: true,
    tipoEquipamento: "Laser LiteTouch",
  },
  {
    nome: "LiteTouch – Remoção de Lentes, Facetas e Coroas (FULL)",
    categoria: "ODONTOLOGIA",
    descricao: "Remoção com laser de alta potência para casos acima de 5 elementos.",
    duracaoMin: 120,
    valorPadraoCentavos: 150_000,
    exigeEquipamento: true,
    tipoEquipamento: "Laser LiteTouch",
  },
  {
    nome: "LiteTouch – Dessensibilização Dentária",
    categoria: "ODONTOLOGIA",
    descricao: "Dessensibilização a laser, por paciente, sem limite de elementos.",
    duracaoMin: 45,
    valorPadraoCentavos: 75_000,
    exigeEquipamento: true,
    tipoEquipamento: "Laser LiteTouch",
  },
  {
    nome: "LiteTouch – Frenectomia",
    categoria: "ODONTOLOGIA",
    descricao: "Frenectomia com laser de alta potência, por paciente.",
    duracaoMin: 60,
    valorPadraoCentavos: 150_000,
    exigeEquipamento: true,
    tipoEquipamento: "Laser LiteTouch",
  },

  // ── Piezosurgery ─────────────────────────────────────────────────────────
  {
    nome: "Piezosurgery Mectron Touch",
    categoria: "ODONTOLOGIA",
    descricao: "Tecnologia e precisão para elevar o nível dos seus procedimentos cirúrgicos.",
    duracaoMin: 60,
    valorPadraoCentavos: 63_500,
    exigeEquipamento: true,
    tipoEquipamento: "Piezosurgery Mectron Touch",
  },
  {
    nome: "Piezosurgery + Stickybone + Membranas",
    categoria: "ODONTOLOGIA",
    descricao: "Piezosurgery com produção de Stickybone e membranas de PRF no mesmo procedimento.",
    duracaoMin: 90,
    valorPadraoCentavos: 93_500,
    exigeEquipamento: true,
    tipoEquipamento: "Piezosurgery Mectron Touch",
  },

  // ── PRF ──────────────────────────────────────────────────────────────────
  {
    nome: "Membranas – PRF",
    categoria: "ODONTOLOGIA",
    descricao: "Produção especializada de membranas de PRF (L-PRF, A-PRF, A-PRF+) para complementar o procedimento.",
    duracaoMin: 30,
    valorPadraoCentavos: 35_000,
    exigeEquipamento: true,
    tipoEquipamento: "Centrífuga PRF",
  },
  {
    nome: "Stickybone + Membranas",
    categoria: "ODONTOLOGIA",
    descricao: "Produção de membranas e Stickybone personalizado (enxerto ósseo) no mesmo procedimento.",
    duracaoMin: 45,
    valorPadraoCentavos: 60_000,
    exigeEquipamento: true,
    tipoEquipamento: "Centrífuga PRF",
  },
  {
    nome: "PRF para Harmonização",
    categoria: "ESTETICA",
    descricao: "Produção de I-PRF, I-PRF+, S-PRF ou PRP e aplicação, por paciente/procedimento.",
    duracaoMin: 45,
    valorPadraoCentavos: 35_000,
    exigeEquipamento: true,
    tipoEquipamento: "Centrífuga PRF",
  },
  {
    nome: "PRF para Medicina",
    categoria: "SAUDE",
    descricao: "Produção de membranas, PRP e PRF em fase líquida para consultórios e hospitais.",
    duracaoMin: 45,
    valorPadraoCentavos: 70_000,
    exigeEquipamento: true,
    tipoEquipamento: "Centrífuga PRF",
  },
  {
    nome: "I-PRF Day",
    categoria: "SAUDE",
    descricao: "Produção de I-PRF, I-PRF+, S-PRF ou PRP por período de 4 horas, para até 6 pessoas.",
    duracaoMin: 240,
    valorPadraoCentavos: 75_000,
    exigeEquipamento: true,
    tipoEquipamento: "Centrífuga PRF",
  },

  // ── Fotografia ───────────────────────────────────────────────────────────
  {
    nome: "Cobertura Fotográfica Odontológica",
    categoria: "ODONTOLOGIA",
    descricao: "Fotógrafo especialista em fotografia odontológica intra oral, disponível por 4 horas.",
    duracaoMin: 240,
    valorPadraoCentavos: 67_000,
    exigeEquipamento: false,
  },

  // ── Sedação ──────────────────────────────────────────────────────────────
  {
    nome: "Sedação Consciente",
    categoria: "SAUDE",
    descricao: "Locação de equipamento Rotamix com cirurgião habilitado, até 3h de funcionamento (Interior: R$1.050,00).",
    duracaoMin: 180,
    valorPadraoCentavos: 85_000,
    exigeEquipamento: false,
  },

  // ── Megaderme ────────────────────────────────────────────────────────────
  {
    nome: "Megaderme – Tratamento Facial (1 paciente)",
    categoria: "ESTETICA",
    descricao: "Microagulhamento com radiofrequência fracionada, por paciente.",
    duracaoMin: 60,
    valorPadraoCentavos: 78_000,
    exigeEquipamento: true,
    tipoEquipamento: "Megaderme",
  },
  {
    nome: "Megaderme – Pacote 2 Pacientes",
    categoria: "ESTETICA",
    descricao: "Locação do Megaderme por 2 horas, para 2 pacientes.",
    duracaoMin: 120,
    valorPadraoCentavos: 140_000,
    exigeEquipamento: true,
    tipoEquipamento: "Megaderme",
  },
  {
    nome: "Megaderme – Pacote 3 Pacientes",
    categoria: "ESTETICA",
    descricao: "Locação do Megaderme por 3 horas, para 3 pacientes.",
    duracaoMin: 180,
    valorPadraoCentavos: 200_000,
    exigeEquipamento: true,
    tipoEquipamento: "Megaderme",
  },
  {
    nome: "Megaderme – Pacote 4 Pacientes",
    categoria: "ESTETICA",
    descricao: "Locação do Megaderme por 4 horas, para 4 pacientes.",
    duracaoMin: 240,
    valorPadraoCentavos: 260_000,
    exigeEquipamento: true,
    tipoEquipamento: "Megaderme",
  },

  // ── Platinum Platform ────────────────────────────────────────────────────
  {
    nome: "Platinum Platform – Pacote 1 Paciente",
    categoria: "ESTETICA",
    descricao: "Locação da Platinum Platform (IPL, Er:Yag e Q-Switched), por paciente.",
    duracaoMin: 60,
    valorPadraoCentavos: 99_000,
    exigeEquipamento: true,
    tipoEquipamento: "Platinum Platform",
  },
  {
    nome: "Platinum Platform – Locação 4 Horas",
    categoria: "ESTETICA",
    descricao: "Locação da Platinum Platform por 4 horas, sem limite de pacientes no período.",
    duracaoMin: 240,
    valorPadraoCentavos: 150_000,
    exigeEquipamento: true,
    tipoEquipamento: "Platinum Platform",
  },
  {
    nome: "Platinum Platform – Locação 8 Horas",
    categoria: "ESTETICA",
    descricao: "Locação da Platinum Platform por 8 horas, sem limite de pacientes no período.",
    duracaoMin: 480,
    valorPadraoCentavos: 199_000,
    exigeEquipamento: true,
    tipoEquipamento: "Platinum Platform",
  },

  // ── Ultrassom Atria® ─────────────────────────────────────────────────────
  {
    nome: "Ultrassom Atria® – Tratamento Facial",
    categoria: "ESTETICA",
    descricao: "Ultrassom micro e macrofocado para tratamento facial, por paciente.",
    duracaoMin: 60,
    valorPadraoCentavos: 99_000,
    exigeEquipamento: true,
    tipoEquipamento: "Atria Ultrassom",
  },
  {
    nome: "Ultrassom Atria® – Tratamento Corporal",
    categoria: "ESTETICA",
    descricao: "Ultrassom micro e macrofocado para tratamento corporal, por paciente.",
    duracaoMin: 90,
    valorPadraoCentavos: 180_000,
    exigeEquipamento: true,
    tipoEquipamento: "Atria Ultrassom",
  },
  {
    nome: "Ultrassom Atria® – Locação 4 Horas",
    categoria: "ESTETICA",
    descricao: "Locação do equipamento Atria® por período de 4 horas.",
    duracaoMin: 240,
    valorPadraoCentavos: 174_000,
    exigeEquipamento: true,
    tipoEquipamento: "Atria Ultrassom",
  },
  {
    nome: "Ultrassom Atria® – Locação 8 Horas",
    categoria: "ESTETICA",
    descricao: "Locação do equipamento Atria® por período de 8 horas.",
    duracaoMin: 480,
    valorPadraoCentavos: 320_000,
    exigeEquipamento: true,
    tipoEquipamento: "Atria Ultrassom",
  },

  // ── Laser Therapy EC + ILIB ──────────────────────────────────────────────
  {
    nome: "Laser Therapy EC + ILIB",
    categoria: "SAUDE",
    descricao: "Terapia fotodinâmica por paciente, acompanhada por profissional habilitado.",
    duracaoMin: 60,
    valorPadraoCentavos: 30_000,
    exigeEquipamento: true,
    tipoEquipamento: "Laser Therapy EC + ILIB",
  },
  {
    nome: "Laser Therapy EC + ILIB (adicional a outro serviço)",
    categoria: "SAUDE",
    descricao: "Valor exclusivo para contratação junto de outro serviço Hemoderi no mesmo atendimento.",
    duracaoMin: 30,
    valorPadraoCentavos: 10_000,
    exigeEquipamento: true,
    tipoEquipamento: "Laser Therapy EC + ILIB",
  },

  // ── Motor de Implante ────────────────────────────────────────────────────
  {
    nome: "Motor de Implante – Por Cirurgia",
    categoria: "ODONTOLOGIA",
    descricao: "Locação do motor de implante para 1 cirurgia, com entrega e retirada.",
    duracaoMin: 90,
    valorPadraoCentavos: 50_000,
    exigeEquipamento: true,
    tipoEquipamento: "Motor de Implante",
  },
  {
    nome: "Motor de Implante – Diária (8 Horas)",
    categoria: "ODONTOLOGIA",
    descricao: "Locação do motor de implante por diária de até 8 horas, horários flexíveis.",
    duracaoMin: 480,
    valorPadraoCentavos: 75_000,
    exigeEquipamento: true,
    tipoEquipamento: "Motor de Implante",
  },

  // ── Bisturi Elétrico ─────────────────────────────────────────────────────
  {
    nome: "Bisturi Elétrico – Por Cirurgia",
    categoria: "SAUDE",
    descricao: "Locação do bisturi elétrico para 1 cirurgia, com entrega e retirada.",
    duracaoMin: 60,
    valorPadraoCentavos: 50_000,
    exigeEquipamento: true,
    tipoEquipamento: "Bisturi Elétrico",
  },
  {
    nome: "Bisturi Elétrico – Diária (8 Horas)",
    categoria: "SAUDE",
    descricao: "Locação do bisturi elétrico por diária de até 8 horas, horários flexíveis.",
    duracaoMin: 480,
    valorPadraoCentavos: 75_000,
    exigeEquipamento: true,
    tipoEquipamento: "Bisturi Elétrico",
  },
];

export type ResultadoInicializacao = {
  equipamentosCriados: number;
  servicosCriados: number;
};

/**
 * Cria os Parametros (se ainda não existirem), o parque de equipamentos e os
 * serviços do catálogo real — nunca dado fictício. Chamada tanto pelo seed
 * de desenvolvimento quanto pela configuração inicial de produção.
 */
export async function inicializarCatalogo(prisma: PrismaClient): Promise<ResultadoInicializacao> {
  await prisma.parametros.upsert({
    where: { id: "hemoderi" },
    update: {},
    create: { id: "hemoderi", whatsapp: "5511994772191", email: "andre@hemoderi.com.br" },
  });

  let equipamentosCriados = 0;
  let numeroPatrimonio = 1;
  for (const { tipo, unidades } of EQUIPAMENTOS_DO_CATALOGO) {
    for (let i = 0; i < unidades; i++) {
      const patrimonio = `HMD-${String(numeroPatrimonio++).padStart(3, "0")}`;
      // Checa antes de criar (não upsert direto): é o que permite contar
      // quantos equipamentos são realmente NOVOS nesta chamada, para o
      // relatório do /api/setup dizer "criou 10", não só "rodou sem erro".
      const jaExiste = await prisma.equipamento.findUnique({ where: { patrimonio } });
      if (!jaExiste) {
        await prisma.equipamento.create({ data: { nome: tipo, tipo, patrimonio } });
        equipamentosCriados++;
      }
    }
  }

  let servicosCriados = 0;
  for (const servico of SERVICOS_DO_CATALOGO) {
    const existente = await prisma.servico.findFirst({ where: { nome: servico.nome } });
    if (!existente) {
      await prisma.servico.create({
        data: { ...servico, tipoEquipamento: servico.tipoEquipamento ?? null },
      });
      servicosCriados++;
    }
  }

  return { equipamentosCriados, servicosCriados };
}
