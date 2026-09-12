/**
 * O catálogo real da Hemoderi: parâmetros da operação, o parque de
 * equipamentos e os 18 serviços do site/catálogo do WhatsApp
 * (https://hemoderi.com.br/). Compartilhado entre o seed de desenvolvimento
 * (`prisma/seed.ts`, que soma clínicas e profissionais fictícios por cima) e
 * a configuração inicial de produção (`/api/setup`, que NUNCA deve tocar em
 * dado fictício) — para as duas fontes não divergirem com o tempo.
 *
 * Idempotente: rodar de novo não duplica nada.
 */

import type { PrismaClient } from "@prisma/client";

type CategoriaServico = "ODONTOLOGIA" | "ESTETICA" | "SAUDE";

type DefinicaoEquipamento = { tipo: string; unidades: number };

type DefinicaoServico = {
  nome: string;
  categoria: CategoriaServico;
  descricao: string;
  duracaoMin: number;
  exigeEquipamento: boolean;
  tipoEquipamento?: string;
};

// O parque de aparelhos que os serviços abaixo reservam na alocação. A
// quantidade de cada tipo é um CHUTE — não temos o inventário real — só
// para a alocação ter o que oferecer sem travar toda vez que dois pedidos
// do mesmo tipo caírem no mesmo horário. Confirmar na Fase 0.
export const EQUIPAMENTOS_DO_CATALOGO: DefinicaoEquipamento[] = [
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

// Nome, categoria e a descrição visível vêm do catálogo real; o resto é
// estimativa a confirmar na Fase 0 (ver docs/fase-0-insumos.md):
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
export const SERVICOS_DO_CATALOGO: DefinicaoServico[] = [
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

export type ResultadoInicializacao = {
  equipamentosCriados: number;
  servicosCriados: number;
};

/**
 * Cria os Parametros (se ainda não existirem), o parque de equipamentos e os
 * 18 serviços do catálogo real — nunca dado fictício. Chamada tanto pelo
 * seed de desenvolvimento quanto pela configuração inicial de produção.
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
        data: { ...servico, valorPadraoCentavos: 0, tipoEquipamento: servico.tipoEquipamento ?? null },
      });
      servicosCriados++;
    }
  }

  return { equipamentosCriados, servicosCriados };
}
