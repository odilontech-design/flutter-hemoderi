/**
 * O catálogo real da Hemoderi: parâmetros da operação, o parque de
 * equipamentos e os serviços do catálogo comercial 2026
 * (CAT_LOGO_HEMODERI_2026.pdf — enviado pela Hemoderi, atualizado em 01/10).
 * Compartilhado entre o seed de desenvolvimento (`prisma/seed.ts`, que soma
 * clínicas e profissionais fictícios por cima) e a configuração inicial de
 * produção (`/api/setup`, que NUNCA deve tocar em dado fictício) — para as
 * duas fontes não divergirem com o tempo.
 *
 * Idempotente na criação: rodar de novo não duplica nada, mas também não
 * ATUALIZA um serviço que já existe — o cadastro pelo painel (todo campo
 * editável) é o caminho certo para corrigir um valor depois do catálogo já
 * estar de pé, sem que rodar `/api/setup` de novo apague um ajuste que a
 * equipe fez na tela. A atualização de um banco que já tinha o catálogo
 * antigo é um passo à parte, feito uma vez (docs/catalogo-2026-10-01.sql).
 */

import type { PrismaClient } from "@prisma/client";
import { CATEGORIAS_DO_CATALOGO } from "@/lib/familia";
import { UFS } from "@/lib/uf";

type CategoriaServico = "ODONTOLOGIA" | "ESTETICA" | "SAUDE";
type UnidadeCobranca = "PACIENTE" | "PERIODO" | "HORA";

type DefinicaoEquipamento = { tipo: string; unidades: number };

export type DefinicaoServico = {
  nome: string;
  /** A categoria do catálogo (sumário, página 2) — ver CATEGORIAS_DO_CATALOGO. */
  familia: (typeof CATEGORIAS_DO_CATALOGO)[number];
  /** Área da operação, para relatório: Odontologia, Estética ou Saúde. */
  categoria: CategoriaServico;
  descricao: string;
  duracaoMin: number;
  /** Em centavos — o preço do catálogo 2026, valor Grande São Paulo. */
  valorPadraoCentavos: number;
  exigeEquipamento: boolean;
  tipoEquipamento?: string;
  /** Padrão: por paciente. Pacotes e diárias são cobrados por período. */
  unidadeCobranca?: UnidadeCobranca;
  /**
   * Serviço com quantidade variável. `incluida` e `adicionalCentavos` são a
   * franquia: o valor de tabela cobre até `incluida` e cada unidade acima
   * soma o adicional (ver lib/cobranca.ts).
   */
  quantidade?: {
    rotulo: string;
    minima?: number;
    incluida?: number;
    adicionalCentavos?: number;
  };
  /** Estados em que o serviço é atendido; nos demais ele não aparece. */
  soAtendeEm?: readonly string[];
  /** Nomes que este serviço tinha no catálogo anterior — a atualização renomeia em vez de duplicar. */
  nomesAnteriores?: string[];
};

// O parque de aparelhos que os serviços abaixo reservam na alocação. A
// quantidade de cada tipo é um CHUTE — não temos o inventário real — só
// para a alocação ter o que oferecer sem travar toda vez que dois pedidos
// do mesmo tipo caírem no mesmo horário. Confirmar na Fase 0.
export const EQUIPAMENTOS_DO_CATALOGO: DefinicaoEquipamento[] = [
  { tipo: "GBT AirFlow", unidades: 1 },
  { tipo: "Centrífuga PRF", unidades: 2 }, // os serviços de PRF dependem deste tipo
  { tipo: "Laser LiteTouch", unidades: 1 },
  { tipo: "Piezosurgery Mectron Touch", unidades: 1 },
  { tipo: "Motor de Implante", unidades: 1 },
  { tipo: "Bisturi Elétrico", unidades: 1 },
  { tipo: "Laser Therapy EC + ILIB", unidades: 1 },
  { tipo: "Platinum Platform", unidades: 1 },
  { tipo: "Megaderme", unidades: 1 },
  { tipo: "Atria Ultrassom", unidades: 1 },
];

/**
 * Nomes de serviços do catálogo anterior que não existem mais no atual — a
 * atualização os DESATIVA (nunca apaga: pedidos antigos apontam para eles).
 */
export const SERVICOS_APOSENTADOS: string[] = ["PRF – Coleta e Produção de Concentrados Plaquetários"];

// Segmentação: cada serviço clínico do sumário (página 2) é uma CATEGORIA
// (`familia`) e cada procedimento dentro dele é uma subcategoria. A ordem
// abaixo é a do sumário.
//
// Preços: todos em Grande São Paulo (catálogo 2026). A taxa de deslocamento
// de R$ 200,00 para atendimentos além de 150 km de São Paulo não é um preço
// de serviço — é um acréscimo por distância, e o sistema ainda não o modela.
//
// O que ainda é estimativa a confirmar:
//   • Duração: onde o catálogo declara o período contratado ("4 horas",
//     "até 3 horas de funcionamento"), a duração vem de lá; nos demais é um
//     chute a partir do tipo de procedimento.
//   • Preço dos pacotes de disparos do ultrassom: o catálogo informa o VALOR
//     DO DISPARO e o mínimo de disparos; o total aqui é a conta (disparo ×
//     mínimo), igual ao que a tela de pacotes mostra.
//   • Disponibilidade por estado: o catálogo restringe alguns serviços a uma
//     região ("Grande São Paulo", "regiões metropolitanas de SP, RJ, Curitiba
//     e Vila Velha"); como a praça do sistema é a UF, aqui vira "só SP" e
//     "só SP, RJ, PR e ES".
export const SERVICOS_DO_CATALOGO: DefinicaoServico[] = [
  // ── AirFlow GBT Machine ────────────────────────────────────────────────
  {
    nome: "AirFlow – GBT Machine (1 paciente)",
    nomesAnteriores: ["GBT Machine – AirFlow"],
    familia: "AirFlow GBT Machine",
    categoria: "ODONTOLOGIA",
    descricao:
      "Tratamento por paciente (Guided Biofilm Therapy): locação do GBT Machine com 1 cirurgião dentista treinado na metodologia GBT. Insumos inclusos: pó de eritritol, revelador de biofilme, ponta Perioflow descartável e ponta ultrassônica PS.",
    duracaoMin: 60,
    valorPadraoCentavos: 50_000,
    exigeEquipamento: true,
    tipoEquipamento: "GBT AirFlow",
  },
  {
    nome: "AirFlow – GBT Machine (pacote 3 pacientes)",
    familia: "AirFlow GBT Machine",
    categoria: "ODONTOLOGIA",
    descricao:
      "Locação do GBT Machine por 4 horas para 3 pacientes, com 1 cirurgião dentista (primeiro paciente), insumos e 1 câmara de pó AirFlow Plus.",
    duracaoMin: 240,
    valorPadraoCentavos: 120_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "GBT AirFlow",
  },
  {
    nome: "AirFlow – GBT Machine (pacote 6 pacientes)",
    familia: "AirFlow GBT Machine",
    categoria: "ODONTOLOGIA",
    descricao:
      "Locação do GBT Machine por 6 horas para 6 pacientes, com 1 cirurgião dentista (primeiro paciente), insumos e 2 câmaras de pó AirFlow Plus.",
    duracaoMin: 360,
    valorPadraoCentavos: 210_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "GBT AirFlow",
  },
  {
    nome: "AirFlow – GBT Machine (pacote 9 pacientes)",
    familia: "AirFlow GBT Machine",
    categoria: "ODONTOLOGIA",
    descricao:
      "Locação do GBT Machine por 8 horas para 9 pacientes, com 1 cirurgião dentista (primeiro paciente), insumos e 3 câmaras de pó AirFlow Plus.",
    duracaoMin: 480,
    valorPadraoCentavos: 300_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "GBT AirFlow",
  },

  // ── LiteTouch™ ───────────────────────────────────────────────────────────
  {
    nome: "LiteTouch – Remoção de Lentes, Facetas e Coroas",
    nomesAnteriores: ["LiteTouch – Laser de Alta Potência"],
    familia: "LiteTouch™",
    categoria: "ODONTOLOGIA",
    descricao:
      "Por paciente, até 2 elementos; cada elemento adicional soma R$ 400,00. Realizado por cirurgião dentista especialista Hemoderi + assistente.",
    duracaoMin: 60,
    valorPadraoCentavos: 75_000,
    exigeEquipamento: true,
    tipoEquipamento: "Laser LiteTouch",
    quantidade: { rotulo: "elementos", incluida: 2, adicionalCentavos: 40_000 },
  },
  {
    nome: "LiteTouch – Remoção de Lentes, Facetas e Coroas (FULL)",
    familia: "LiteTouch™",
    categoria: "ODONTOLOGIA",
    descricao:
      "Por paciente, remoção acima de 5 elementos. Realizado por cirurgião dentista especialista Hemoderi + assistente; levamos todos os instrumentais.",
    duracaoMin: 120,
    valorPadraoCentavos: 150_000,
    exigeEquipamento: true,
    tipoEquipamento: "Laser LiteTouch",
  },
  {
    nome: "LiteTouch – Dessensibilização Dentária",
    familia: "LiteTouch™",
    categoria: "ODONTOLOGIA",
    descricao:
      "Por paciente, sem limite de elementos. Cirurgião dentista especialista Hemoderi + assistente; insumos e EPIs necessários inclusos.",
    duracaoMin: 45,
    valorPadraoCentavos: 75_000,
    exigeEquipamento: true,
    tipoEquipamento: "Laser LiteTouch",
  },
  {
    nome: "LiteTouch – Frenectomia",
    familia: "LiteTouch™",
    categoria: "ODONTOLOGIA",
    descricao:
      "Por paciente. Cirurgião dentista especialista Hemoderi + assistente; instrumentais, insumos e EPIs necessários inclusos.",
    duracaoMin: 60,
    valorPadraoCentavos: 150_000,
    exigeEquipamento: true,
    tipoEquipamento: "Laser LiteTouch",
  },

  // ── Rotamix Sedação Consciente ──────────────────────────────────────────
  {
    nome: "Sedação Consciente – Grande São Paulo",
    nomesAnteriores: ["Sedação Consciente"],
    familia: "Rotamix Sedação Consciente",
    categoria: "SAUDE",
    descricao:
      "Valor por cirurgia/paciente, até 3 horas de funcionamento do equipamento. Cirurgião dentista habilitado disponível durante todo o procedimento, cilindros de oxigênio e óxido nitroso medicinal e monitoramento dos sinais vitais. Atendimentos dentro da Grande São Paulo.",
    duracaoMin: 180,
    valorPadraoCentavos: 85_000,
    exigeEquipamento: false,
  },
  {
    nome: "Sedação Consciente – Interior (até 150 km)",
    familia: "Rotamix Sedação Consciente",
    categoria: "SAUDE",
    descricao:
      "Mesmo serviço, para atendimentos fora da Grande São Paulo até 150 km. Acima de 150 km da cidade de São Paulo, consulte o deslocamento.",
    duracaoMin: 180,
    valorPadraoCentavos: 105_000,
    exigeEquipamento: false,
  },

  // ── Piezosurgery Mectron Touch ──────────────────────────────────────────
  {
    nome: "Piezosurgery Mectron Touch",
    familia: "Piezosurgery Mectron Touch",
    categoria: "ODONTOLOGIA",
    descricao:
      "Locação para 1 cirurgia/paciente, com pontas inclusas e profissional para instrumentação cirúrgica do equipamento.",
    duracaoMin: 60,
    valorPadraoCentavos: 63_500,
    exigeEquipamento: true,
    tipoEquipamento: "Piezosurgery Mectron Touch",
  },
  {
    nome: "Piezosurgery + Stickybone + Membranas",
    familia: "Piezosurgery Mectron Touch",
    categoria: "ODONTOLOGIA",
    descricao:
      "Pacote promocional: produção de membranas e Stickybone, profissional para instrumentação cirúrgica e locação do Piezosurgery Mectron para 1 cirurgia/paciente.",
    duracaoMin: 90,
    valorPadraoCentavos: 93_500,
    exigeEquipamento: true,
    tipoEquipamento: "Piezosurgery Mectron Touch",
  },

  // ── Cobertura Fotográfica ───────────────────────────────────────────────
  {
    nome: "Cobertura Fotográfica Odontológica",
    familia: "Cobertura Fotográfica",
    categoria: "ODONTOLOGIA",
    descricao:
      "Profissional especialista em fotografia odontológica intra oral, disponível por 4 horas. Fotos tratadas em Photoshop e arquivo total das fotos produzidas; EPIs, iluminação, máquina fotográfica profissional e materiais estéreis inclusos. Adicional de deslocamento para cidades fora das regiões metropolitanas.",
    duracaoMin: 240,
    valorPadraoCentavos: 67_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: false,
  },

  // ── Ultrassom Micro Focado (Atria®) ─────────────────────────────────────
  {
    nome: "Ultrassom Atria® – Tratamento Facial",
    nomesAnteriores: ["Ultrassom Micro e Macrofocado – Atria®"],
    familia: "Ultrassom Micro Focado",
    categoria: "ESTETICA",
    descricao:
      "Por paciente, mínimo de 400 disparos (R$ 2,47 o disparo) = R$ 990,00; acima de 400, R$ 1,70 por disparo adicional. Acompanhado por biomédico esteta especialista Hemoderi.",
    duracaoMin: 60,
    valorPadraoCentavos: 99_000,
    exigeEquipamento: true,
    tipoEquipamento: "Atria Ultrassom",
    quantidade: { rotulo: "disparos", minima: 400, incluida: 400, adicionalCentavos: 170 },
  },
  {
    nome: "Ultrassom Atria® – Tratamento Corporal",
    familia: "Ultrassom Micro Focado",
    categoria: "ESTETICA",
    descricao:
      "Por paciente, mínimo de 900 disparos (R$ 2,00 o disparo) = R$ 1.800,00; acima de 900, R$ 1,70 por disparo adicional. Acompanhado por biomédico esteta especialista Hemoderi.",
    duracaoMin: 90,
    valorPadraoCentavos: 180_000,
    exigeEquipamento: true,
    tipoEquipamento: "Atria Ultrassom",
    quantidade: { rotulo: "disparos", minima: 900, incluida: 900, adicionalCentavos: 170 },
  },
  {
    nome: "Ultrassom Atria® – Facial 900 disparos (4 h)",
    familia: "Ultrassom Micro Focado",
    categoria: "ESTETICA",
    descricao:
      "Locação do equipamento por período de 4 horas, mínimo de 900 disparos a R$ 2,00. Disparo adicional R$ 1,70. Acompanhado por biomédico esteta especialista Hemoderi.",
    duracaoMin: 240,
    valorPadraoCentavos: 180_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "Atria Ultrassom",
    quantidade: { rotulo: "disparos", minima: 900, incluida: 900, adicionalCentavos: 170 },
  },
  {
    nome: "Ultrassom Atria® – Facial 1600 disparos (8 h)",
    familia: "Ultrassom Micro Focado",
    categoria: "ESTETICA",
    descricao:
      "Locação do equipamento por período de 8 horas, mínimo de 1600 disparos a R$ 2,00. Disparo adicional R$ 1,70. Acompanhado por biomédico esteta especialista Hemoderi.",
    duracaoMin: 480,
    valorPadraoCentavos: 320_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "Atria Ultrassom",
    quantidade: { rotulo: "disparos", minima: 1600, incluida: 1600, adicionalCentavos: 170 },
  },
  {
    nome: "Ultrassom Atria® – Facial 3000 disparos (8 h)",
    familia: "Ultrassom Micro Focado",
    categoria: "ESTETICA",
    descricao:
      "Locação do equipamento por período de 8 horas, a partir de 3000 disparos a R$ 1,86. Disparo adicional R$ 1,70. Acompanhado por biomédico esteta especialista Hemoderi.",
    duracaoMin: 480,
    valorPadraoCentavos: 558_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "Atria Ultrassom",
    quantidade: { rotulo: "disparos", minima: 3000, incluida: 3000, adicionalCentavos: 170 },
  },
  {
    nome: "Ultrassom Atria® – Facial 5000 disparos (12 h)",
    familia: "Ultrassom Micro Focado",
    categoria: "ESTETICA",
    descricao:
      "Locação do equipamento por período de 12 horas, a partir de 5000 disparos a R$ 1,79. Disparo adicional R$ 1,70. Acompanhado por biomédico esteta especialista Hemoderi.",
    duracaoMin: 720,
    valorPadraoCentavos: 895_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "Atria Ultrassom",
    quantidade: { rotulo: "disparos", minima: 5000, incluida: 5000, adicionalCentavos: 170 },
  },
  {
    nome: "Ultrassom Atria® – Facial 7000 disparos (12 h)",
    familia: "Ultrassom Micro Focado",
    categoria: "ESTETICA",
    descricao:
      "Locação do equipamento por período de 12 horas, a partir de 7000 disparos a R$ 1,70. Disparo adicional R$ 1,70. Acompanhado por biomédico esteta especialista Hemoderi.",
    duracaoMin: 720,
    valorPadraoCentavos: 1_190_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "Atria Ultrassom",
    quantidade: { rotulo: "disparos", minima: 7000, incluida: 7000, adicionalCentavos: 170 },
  },

  // ── Megaderme – Radiofrequência Microagulhada ───────────────────────────
  {
    nome: "Megaderme – Tratamento por paciente",
    nomesAnteriores: ["Megaderme® – Radiofrequência Microagulhada"],
    familia: "Megaderme – Radiofrequência Microagulhada",
    categoria: "ESTETICA",
    descricao:
      "Locação do Megaderme com ponteira Eletroderme RF. Inclui 1 spot com 40 agulhas (o mesmo spot faz corporal e facial na mesma sessão). Acompanhado por biomédico esteta especialista Hemoderi.",
    duracaoMin: 60,
    valorPadraoCentavos: 78_000,
    exigeEquipamento: true,
    tipoEquipamento: "Megaderme",
  },
  {
    nome: "Megaderme – Pacote 2 Pacientes",
    familia: "Megaderme – Radiofrequência Microagulhada",
    categoria: "ESTETICA",
    descricao: "Locação do Megaderme por 2 horas, 1 spot com 40 agulhas por paciente — R$ 700,00 por paciente.",
    duracaoMin: 120,
    valorPadraoCentavos: 140_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "Megaderme",
  },
  {
    nome: "Megaderme – Pacote 3 Pacientes",
    familia: "Megaderme – Radiofrequência Microagulhada",
    categoria: "ESTETICA",
    descricao: "Locação do Megaderme por 3 horas, 1 spot com 40 agulhas por paciente — R$ 670,00 por paciente.",
    duracaoMin: 180,
    valorPadraoCentavos: 200_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "Megaderme",
  },
  {
    nome: "Megaderme – Pacote 4 Pacientes",
    familia: "Megaderme – Radiofrequência Microagulhada",
    categoria: "ESTETICA",
    descricao: "Locação do Megaderme por 4 horas, 1 spot com 40 agulhas por paciente — R$ 650,00 por paciente.",
    duracaoMin: 240,
    valorPadraoCentavos: 260_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "Megaderme",
  },

  // ── Platinum Platform ────────────────────────────────────────────────────
  {
    nome: "Platinum Platform – Pacote 1 Paciente",
    nomesAnteriores: ["Platinum Platform"],
    familia: "Platinum Platform",
    categoria: "ESTETICA",
    descricao:
      "Valor por paciente: locação da Platinum Platform com ponteiras IPL, Er:Yag e Q-Switched, acompanhada por biomédico esteta especialista Hemoderi.",
    duracaoMin: 60,
    valorPadraoCentavos: 99_000,
    exigeEquipamento: true,
    tipoEquipamento: "Platinum Platform",
  },
  {
    nome: "Platinum Platform – Locação 4 Horas",
    familia: "Platinum Platform",
    categoria: "ESTETICA",
    descricao:
      "Valor por período, sem limite de pacientes: locação da Platinum Platform por 4 horas, com ponteiras IPL, Er:Yag e Q-Switched e biomédico esteta especialista Hemoderi.",
    duracaoMin: 240,
    valorPadraoCentavos: 150_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "Platinum Platform",
  },
  {
    nome: "Platinum Platform – Locação 8 Horas",
    familia: "Platinum Platform",
    categoria: "ESTETICA",
    descricao:
      "Valor por período, sem limite de pacientes: locação da Platinum Platform por 8 horas, com ponteiras IPL, Er:Yag e Q-Switched e biomédico esteta especialista Hemoderi.",
    duracaoMin: 480,
    valorPadraoCentavos: 199_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "Platinum Platform",
  },

  // ── Laser Therapy EC ─────────────────────────────────────────────────────
  {
    nome: "Laser Therapy EC + ILIB",
    familia: "Laser Therapy EC",
    categoria: "SAUDE",
    descricao:
      "Valor por paciente. Procedimento acompanhado por profissional com as orientações de uso do equipamento; acompanha ILIB.",
    duracaoMin: 60,
    valorPadraoCentavos: 30_000,
    exigeEquipamento: true,
    tipoEquipamento: "Laser Therapy EC + ILIB",
  },
  {
    nome: "Laser Therapy EC + ILIB (adicional a outro serviço)",
    familia: "Laser Therapy EC",
    categoria: "SAUDE",
    descricao:
      "Valor exclusivo para contratação junto com outro serviço Hemoderi no mesmo atendimento; acompanha ILIB.",
    duracaoMin: 30,
    valorPadraoCentavos: 10_000,
    exigeEquipamento: true,
    tipoEquipamento: "Laser Therapy EC + ILIB",
  },

  // ── Bisturi Elétrico ─────────────────────────────────────────────────────
  {
    nome: "Bisturi Elétrico – Por Cirurgia",
    nomesAnteriores: ["Bisturi Elétrico"],
    familia: "Bisturi Elétrico",
    categoria: "SAUDE",
    descricao:
      "Valor por cirurgia. Profissional Hemoderi entrega, testa e acompanha a cirurgia; inclusas as pontas do kit odontológico da EMAI.",
    duracaoMin: 60,
    valorPadraoCentavos: 50_000,
    exigeEquipamento: true,
    tipoEquipamento: "Bisturi Elétrico",
  },
  {
    nome: "Bisturi Elétrico – Diária (8 Horas)",
    familia: "Bisturi Elétrico",
    categoria: "SAUDE",
    descricao:
      "Valor para diária de até 8 horas, horários flexíveis. Profissional Hemoderi entrega, testa e retira ao final do dia.",
    duracaoMin: 480,
    valorPadraoCentavos: 75_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "Bisturi Elétrico",
  },

  // ── Motor de Implante ────────────────────────────────────────────────────
  {
    nome: "Motor de Implante – Por Cirurgia",
    nomesAnteriores: ["Motor de Implante"],
    familia: "Motor de Implante",
    categoria: "ODONTOLOGIA",
    descricao:
      "Valor por cirurgia. Profissional Hemoderi entrega, testa e acompanha a cirurgia. Não inclui contra-ângulo e peça reta.",
    duracaoMin: 90,
    valorPadraoCentavos: 50_000,
    exigeEquipamento: true,
    tipoEquipamento: "Motor de Implante",
  },
  {
    nome: "Motor de Implante – Diária (8 Horas)",
    familia: "Motor de Implante",
    categoria: "ODONTOLOGIA",
    descricao:
      "Valor para diária de até 8 horas, horários flexíveis. Profissional Hemoderi entrega, testa e retira ao final do dia.",
    duracaoMin: 480,
    valorPadraoCentavos: 75_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "Motor de Implante",
  },

  // ── PRF – Coleta e Produção ──────────────────────────────────────────────
  {
    nome: "Membranas – PRF",
    familia: "PRF – Coleta e Produção",
    categoria: "ODONTOLOGIA",
    descricao:
      "Produção de membranas (A-PRF, A-PRF+, Supermembrana e FLA), com aferição dos sinais vitais e coleta antes do início do procedimento. Sem PRF em fase líquida, sem Stickybone e sem acompanhamento do procedimento. Disponível nas regiões metropolitanas de São Paulo, Rio de Janeiro, Curitiba e Vila Velha.",
    duracaoMin: 30,
    valorPadraoCentavos: 35_000,
    exigeEquipamento: true,
    tipoEquipamento: "Centrífuga PRF",
    soAtendeEm: ["SP", "RJ", "PR", "ES"],
  },
  {
    nome: "Stickybone + Membranas",
    nomesAnteriores: ["Stickybone / PRF Block"],
    familia: "PRF – Coleta e Produção",
    categoria: "ODONTOLOGIA",
    descricao:
      "Produção de membranas (A-PRF, A-PRF+, Supermembrana e FLA), PRF em fase líquida e Stickybone personalizado (enxerto ósseo). Aferição dos sinais vitais e acompanhamento do início ao fim, com coleta e produção durante todo o procedimento. Não fornecemos biomaterial.",
    duracaoMin: 45,
    valorPadraoCentavos: 60_000,
    exigeEquipamento: true,
    tipoEquipamento: "Centrífuga PRF",
  },
  {
    nome: "PRF para Harmonização",
    familia: "PRF – Coleta e Produção",
    categoria: "ESTETICA",
    descricao:
      "Produção de I-PRF, I-PRF+, S-PRF ou PRP, por paciente/procedimento (sem aplicação). Produção de plasma gel + locação de equipamento: R$ 250,00. Produto disponível dentro da Grande São Paulo.",
    duracaoMin: 45,
    valorPadraoCentavos: 35_000,
    exigeEquipamento: true,
    tipoEquipamento: "Centrífuga PRF",
    soAtendeEm: ["SP"],
  },
  {
    nome: "PRF para Medicina",
    familia: "PRF – Coleta e Produção",
    categoria: "SAUDE",
    descricao:
      "Produção de membranas, PRP, PRF em fase líquida e manipulação de PRF Block. Atuação em consultórios e hospitais.",
    duracaoMin: 45,
    valorPadraoCentavos: 70_000,
    exigeEquipamento: true,
    tipoEquipamento: "Centrífuga PRF",
  },
  {
    nome: "I-PRF Day",
    familia: "PRF – Coleta e Produção",
    categoria: "SAUDE",
    descricao:
      "Produção de I-PRF, I-PRF+, S-PRF ou PRP por 4 horas, até 6 pessoas (sem aplicação). Produção de plasma gel + locação de equipamento: R$ 250,00. Valor para um raio de 150 km da cidade de São Paulo.",
    duracaoMin: 240,
    valorPadraoCentavos: 75_000,
    unidadeCobranca: "PERIODO",
    exigeEquipamento: true,
    tipoEquipamento: "Centrífuga PRF",
    soAtendeEm: ["SP"],
  },
];

/** O que a coluna `ufsIndisponiveis` guarda: o complemento de onde o serviço é atendido. */
export function ufsIndisponiveisDe(servico: DefinicaoServico): string[] {
  if (!servico.soAtendeEm) return [];
  return UFS.filter((uf) => !servico.soAtendeEm!.includes(uf));
}

/** Os campos de `Servico` que uma definição preenche — compartilhado entre criar e atualizar. */
export function dadosDoServico(servico: DefinicaoServico) {
  const { quantidade } = servico;
  return {
    nome: servico.nome,
    familia: servico.familia,
    categoria: servico.categoria,
    descricao: servico.descricao,
    duracaoMin: servico.duracaoMin,
    valorPadraoCentavos: servico.valorPadraoCentavos,
    exigeEquipamento: servico.exigeEquipamento,
    tipoEquipamento: servico.tipoEquipamento ?? null,
    unidadeCobranca: servico.unidadeCobranca ?? "PACIENTE",
    permiteQuantidade: Boolean(quantidade),
    rotuloQuantidade: quantidade?.rotulo ?? null,
    quantidadeMinima: quantidade?.minima ?? 1,
    quantidadeIncluida: quantidade?.incluida ?? null,
    valorAdicionalCentavos: quantidade?.adicionalCentavos ?? 0,
    ufsIndisponiveis: ufsIndisponiveisDe(servico),
  } as const;
}

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
      await prisma.servico.create({ data: dadosDoServico(servico) });
      servicosCriados++;
    }
  }

  return { equipamentosCriados, servicosCriados };
}
