/**
 * O descritivo de cada seção do catálogo institucional 2026 — revisão de
 * outubro (CAT_LOGO_HEMODERI_2026 - Out.26, curadoria do André) —, para a
 * vitrine do portal da clínica (pedido de 06/10): a foto da capa da seção e os
 * blocos "Serviços / Equipe / O que inclui / Principais indicações" como estão
 * no PDF. O preço NÃO está aqui — vem do cadastro de serviços e tabelas, para
 * não envelhecer em dois lugares.
 *
 * A chave é o nome exato da família (CATEGORIAS_DO_CATALOGO em lib/familia.ts).
 * As imagens são as fotos de capa de cada seção, extraídas do PDF para
 * public/catalogo/.
 */

export type BlocoDescritivo = {
  titulo: string;
  texto?: string;
  itens?: string[];
};

export type DescritivoDaFamilia = {
  /** Caminho em public/ — foto de capa da seção do catálogo. */
  imagem: string;
  legenda: string;
  blocos: BlocoDescritivo[];
  /** Observação de rodapé do PDF (validade de preço, deslocamento…). */
  observacao?: string;
};

const RAIO_150 = "Valores válidos para um raio de até 150 km de São Paulo.";

export const DESCRITIVO_DAS_FAMILIAS: Record<string, DescritivoDaFamilia> = {
  "AirFlow GBT Machine": {
    imagem: "/catalogo/airflow.webp",
    legenda: "Locação GBT Machine – AirFlow",
    blocos: [
      {
        titulo: "Guided Biofilm Therapy — Método GBT",
        texto:
          "É uma metodologia moderna, segura e minimamente invasiva para prevenção e manutenção da saúde bucal. O protocolo identifica e evidencia o biofilme, orienta o paciente e realiza sua remoção com AIRFLOW®, utilizando água aquecida e eritritol. O PIEZON® é aplicado somente quando necessário, proporcionando mais conforto, precisão e uma experiência superior ao paciente.",
      },
      {
        titulo: "O que inclui",
        itens: [
          "Locação do equipamento GBT Machine;",
          "Cirurgião-dentista com treinamento GBT para montar e orientar o primeiro paciente;",
          "Insumos: pó de eritritol, revelador de biofilme, ponta Perioflow e ponta PS;",
          "Instrumentais Hu-Friedy Group.",
        ],
      },
    ],
    observacao: `Quanto mais pacientes no mesmo atendimento, menor o valor por paciente. ${RAIO_150}`,
  },

  "LiteTouch™": {
    imagem: "/catalogo/litetouch.webp",
    legenda: "Locação de laser de alta potência LiteTouch™",
    blocos: [
      {
        titulo: "Serviços",
        texto:
          "Locação de equipamento LiteTouch + profissional com ampla experiência para realizar o procedimento no seu paciente.",
      },
      {
        titulo: "Equipe",
        texto:
          "Cirurgião-dentista habilitado, com experiência em adultos, crianças e pacientes com necessidades especiais. Lentes, facetas, coroas, cirurgias, cárie, ronco e dessensibilização.",
      },
      {
        titulo: "O que inclui",
        itens: [
          "Profissional cirurgião-dentista habilitado para operação do equipamento;",
          "Todos os insumos e instrumentais Hu-Friedy Group para a realização do procedimento;",
          "Logística do equipamento;",
          "Ponteiras para todas as especialidades;",
          "Montagem e desmontagem do equipamento seguindo normas de segurança;",
          "EPIs.",
        ],
      },
    ],
    observacao: `${RAIO_150} Atendemos os estados do RJ e PR, com deslocamento de R$ 500,00.`,
  },

  "Rotamix Sedação Consciente": {
    imagem: "/catalogo/sedacao.webp",
    legenda: "Locação de Sedação Consciente",
    blocos: [
      {
        titulo: "Serviços",
        texto: "Locação de equipamento Rotamix Morya com cilindros de oxigênio e óxido nitroso medicinais.",
      },
      {
        titulo: "Equipe",
        texto:
          "Cirurgião-dentista com experiência em atendimento a adultos e crianças a partir de 3 anos, habilitado em sedação consciente.",
      },
      {
        titulo: "O que inclui",
        itens: [
          "Cirurgião-dentista para a realização da sedação, durante todo o procedimento;",
          "5 opções de máscara;",
          "Locação do equipamento com os cilindros de oxigênio e óxido nitroso medicinal;",
          "Logística, montagem, desmontagem e assepsia do equipamento;",
          "Monitoramento dos sinais vitais durante todo o procedimento.",
        ],
      },
    ],
    observacao:
      "Valores para até 3 horas de atendimento; a hora adicional é de R$ 200,00, cobrada integralmente a partir do 16º minuto adicional. Atendimentos na Grande São Paulo e no interior até 150 km — consulte o deslocamento para distâncias maiores.",
  },

  "Piezosurgery Mectron Touch": {
    imagem: "/catalogo/piezosurgery.webp",
    legenda: "Locação de Piezosurgery Mectron Touch com pontas",
    blocos: [
      { titulo: "Serviços", texto: "Locação de equipamento Piezosurgery Mectron Touch com pontas inclusas." },
      {
        titulo: "Equipe",
        texto: "Profissionais com experiência em UTI e centro cirúrgico para instrumentar, com assepsia e biossegurança.",
      },
      {
        titulo: "O que inclui",
        itens: [
          "Profissional para instrumentação cirúrgica;",
          "Locação do equipamento com as pontas disponíveis, para 1 cirurgia/paciente;",
          "Seguro do equipamento;",
          "EPIs.",
        ],
      },
      {
        titulo: "Pacote promocional",
        texto: "Piezo + Stickybone + Membranas: inclui a produção de membranas e Stickybone.",
      },
    ],
    observacao: RAIO_150,
  },

  "Cobertura Fotográfica": {
    imagem: "/catalogo/fotografia.webp",
    legenda: "Profissional especialista em fotografia odontológica",
    blocos: [
      {
        titulo: "Serviços",
        texto: "Cobertura fotográfica profissional, especialista em fotografia odontológica intraoral.",
      },
      {
        titulo: "Equipe",
        texto: "Especialistas em fotografia odontológica: pacientes, cirurgias, planejamentos, congressos, indústria e aulas.",
      },
      {
        titulo: "O que inclui",
        itens: [
          "Contratação do profissional e deslocamento;",
          "Profissional disponível por 4 horas;",
          "Máquina fotográfica profissional, iluminação, materiais estéreis e EPIs;",
          "Fotos tratadas em Photoshop e arquivo completo.",
        ],
      },
    ],
    observacao: RAIO_150,
  },

  "Ultrassom Micro Focado": {
    imagem: "/catalogo/ultrassom.webp",
    legenda: "Locação de Ultrassom Microfocado — Atria®",
    blocos: [
      {
        titulo: "Serviços",
        texto: "Equipamento Atria® + logística + profissional experiente para montagem e regulagem.",
      },
      {
        titulo: "Equipe",
        texto: "Especialista que instrumenta o equipamento e orienta os protocolos do fabricante e as melhores práticas.",
      },
      {
        titulo: "O que inclui",
        itens: [
          "Profissional biomédico esteta ou dentista especialista;",
          "Todos os insumos, EPIs e logística do equipamento;",
          "2 handpieces;",
          "Insumos carregados nas profundidades: Atria Pen 1,5 mm, 3 mm e 4,5 mm · Atria Scan Microfocado 1,5 mm, 2 mm, 3 mm e 4,5 mm · Atria Scan Macrofocado 6 mm, 9 mm e 13 mm;",
          "Montagem e desmontagem do equipamento seguindo normas de segurança.",
        ],
      },
    ],
    observacao: `Cancelamento com menos de 48 h: 50% do valor. ${RAIO_150}`,
  },

  "Megaderme – Radiofrequência Microagulhada": {
    imagem: "/catalogo/megaderme.webp",
    legenda: "Locação Megaderme — microagulhamento com radiofrequência fracionada",
    blocos: [
      {
        titulo: "Serviços",
        texto: "Equipamento Megaderme® + logística + profissional experiente para montagem e regulagem.",
      },
      {
        titulo: "Equipe",
        texto: "Especialista que instrumenta o equipamento e orienta os protocolos do fabricante e as melhores práticas.",
      },
      {
        titulo: "O que inclui",
        itens: [
          "Profissional biomédico esteta;",
          "Todos os insumos e EPIs;",
          "Logística do equipamento;",
          "1 handpiece Eletroderme RF;",
          "Insumos individuais e estéreis por paciente — 1 spot com 40 agulhas por paciente (corporal e facial na mesma sessão);",
          "Montagem e desmontagem do equipamento seguindo normas de segurança.",
        ],
      },
      {
        titulo: "Principais indicações — Eletroderme RF",
        itens: [
          "Tratamento de estrias;",
          "Tratamento de melasma;",
          "Cicatrizes: de acne, de queimadura e cirúrgicas;",
          "Skin tightening para regiões de face e pescoço;",
          "Resurfacing: redução de rugas em face e pescoço;",
          "Poros dilatados — melhora da textura da pele.",
        ],
      },
    ],
    observacao: `Nos pacotes, a locação é de 2 h (2 pacientes), 3 h (3 pacientes) ou 4 h (4 pacientes). ${RAIO_150}`,
  },

  "Platinum Platform": {
    imagem: "/catalogo/platinum.webp",
    legenda: "Locação Plataforma Platinum",
    blocos: [
      {
        titulo: "Luz Intensa Pulsada — principais indicações",
        itens: [
          "Acne ativa;",
          "Estímulo de colágeno e rejuvenescimento;",
          "Hemangiomas planos — manchas vinho do Porto;",
          "Lesões pigmentadas benignas;",
          "Poiquilodermia e rosácea;",
          "Olheiras.",
        ],
      },
      {
        titulo: "Q-Switched — principais indicações",
        itens: [
          "Hollywood Peel;",
          "Laser toning;",
          "Melasma;",
          "Olheiras;",
          "Remoção de tatuagens claras;",
          "Remoção de tatuagens escuras.",
        ],
      },
      {
        titulo: "Erbium — principais indicações",
        itens: ["Cicatrizes de acne;", "Drug delivery;", "Estrias;", "Rejuvenescimento."],
      },
      {
        titulo: "O que inclui",
        itens: [
          "Plataforma Platinum com ponteiras IPL, Er:YAG e Q-Switched;",
          "Procedimento acompanhado por biomédico esteta especialista Hemoderi.",
        ],
      },
    ],
    observacao: `Nas locações de 4 e 8 horas, sem limite de pacientes. ${RAIO_150}`,
  },

  "Laser Therapy EC": {
    imagem: "/catalogo/laser-therapy.webp",
    legenda: "Locação Laser Therapy EC + ILIB",
    blocos: [
      {
        titulo: "O que inclui",
        itens: [
          "Terapia fotodinâmica com ILIB;",
          "Procedimento acompanhado por profissional, com orientações de uso do equipamento.",
        ],
      },
      {
        titulo: "Combine e economize",
        texto: "Valor de adicional exclusivo na contratação junto com outro serviço Hemoderi.",
      },
    ],
    observacao: RAIO_150,
  },

  "Laser CO2 Fracionado": {
    imagem: "/catalogo/co2-fracionado.webp",
    legenda: "Locação CO2 Fracionado com Microcoring — Fraxion SmartGR",
    blocos: [
      {
        titulo: "Serviços",
        texto: "Equipamento Fraxion SmartGR + logística + profissional experiente para montagem e regulagem.",
      },
      {
        titulo: "Equipe",
        texto: "Especialista que instrumenta o equipamento e orienta os protocolos do fabricante e as melhores práticas.",
      },
      {
        titulo: "O que inclui",
        itens: [
          "Profissional biomédico esteta ou dentista especialista;",
          "Todos os insumos e EPIs;",
          "Logística do equipamento;",
          "Ponteiras fracionadas, cirúrgicas e íntimas;",
          "Montagem e desmontagem seguindo normas de segurança.",
        ],
      },
      {
        titulo: "CO2 Day — modalidades",
        itens: [
          "Essencial: sua equipe opera — montamos, testamos e deixamos tudo pronto (4, 6 ou 8 horas);",
          "Assistido: tudo do Essencial + profissional Hemoderi na sala (4, 6 ou 8 horas);",
          "CO2 Curso: valor por paciente, desconto exclusivo para o serviço CO2 Fracionado.",
        ],
      },
    ],
    observacao: RAIO_150,
  },

  "Bisturi Elétrico": {
    imagem: "/catalogo/bisturi.webp",
    legenda: "Locação de Bisturi Elétrico",
    blocos: [
      {
        titulo: "Serviços",
        texto: "Bisturi elétrico + logística + profissional experiente para montagem e regulagem.",
      },
      {
        titulo: "Equipe",
        texto:
          "Organizamos a logística, conferimos o equipamento e auxiliamos na montagem. O procedimento é do cirurgião.",
      },
      {
        titulo: "O que inclui",
        itens: [
          "Unidade de eletrocirurgia;",
          "Caneta porta-eletrodos e cabos;",
          "Pedal ou acionamento compatível;",
          "Eletrodos conforme a configuração contratada;",
          "Logística de entrega e retirada;",
          "Conferência funcional e montagem segura.",
        ],
      },
      {
        titulo: "Principais indicações",
        itens: [
          "Incisões e excisões em tecidos moles;",
          "Gengivectomia e gengivoplastia;",
          "Frenectomia e remoção de lesões benignas;",
          "Acesso e recontorno do tecido gengival;",
          "Coagulação e controle de sangramento;",
          "Cirurgias periodontais e peri-implantares.",
        ],
      },
    ],
    observacao: `Por cirurgia: o profissional acompanha a cirurgia, com as pontas do kit odontológico EMAI inclusas. Diária (até 8 horas): retirada ao final do dia, com horários flexíveis. Em todos, entrega e teste do equipamento por profissional Hemoderi. ${RAIO_150}`,
  },

  "Motor de Implante": {
    imagem: "/catalogo/motor-implante.webp",
    legenda: "Locação de Motor de Implante",
    blocos: [
      {
        titulo: "Serviços",
        texto: "Motor de implante + logística + profissional experiente para montagem e regulagem.",
      },
      {
        titulo: "Equipe",
        texto:
          "Organizamos a logística, conferimos o equipamento e auxiliamos na montagem. O procedimento é do cirurgião.",
      },
      {
        titulo: "O que inclui",
        itens: [
          "Unidade de controle e micromotor;",
          "Pedal e suporte para irrigação;",
          "Contra-ângulo e acessórios conforme contratação;",
          "Logística de entrega e retirada;",
          "Conferência funcional antes do atendimento;",
          "Montagem e desmontagem com segurança.",
        ],
      },
    ],
    observacao: `Por cirurgia: o profissional acompanha a cirurgia; não inclui contra-ângulo e peça reta. Diária (até 8 horas): retirada ao final do dia, com horários flexíveis. Em todos, entrega e teste do equipamento por profissional Hemoderi. Não garantimos a marca do motor que será enviada. ${RAIO_150}`,
  },

  "PRF – Coleta e Produção": {
    imagem: "/catalogo/prf.webp",
    legenda: "PRF — produzimos no protocolo de sua preferência",
    blocos: [
      {
        titulo: "O que está incluso ao escolher um serviço Hemoderi",
        itens: [
          "1. Contratação e deslocamento do profissional;",
          "2. Materiais de coleta (tubos, escalpe, luvas, garrote, stopblood e álcool 70%);",
          "3. Materiais e instrumentos para manipulação dos concentrados sanguíneos: centrífuga, PRF Box estéril e placa de Petri estéril;",
          "4. Acompanhamento e suporte do início ao fim do procedimento, com coletas ilimitadas;",
          "5. Produção de mais de 11 produtos personalizados para cirurgia e HOF, entre eles membranas, supermembrana, Stickybone/PRF Block e plasma gel.",
        ],
      },
      {
        titulo: "PRF fase líquida — I-PRF, I-PRF+, Fibrin, S-PRF, PRP*",
        itens: [
          "Fibrina rica em plaquetas — injetável;",
          "Coleta em tubo sem aditivo (tampa branca);",
          "Centrifugação.",
        ],
      },
      {
        titulo: "Membranas, coágulos e plugs — L-PRF, A-PRF, A-PRF+, Fibrin",
        itens: [
          "Fibrina rica em plaquetas e leucócitos;",
          "Separação do coágulo de PRF com buffy coat;",
          "Centrifugação;",
          "Desidratação em PRF Box estéril;",
          "Coleta em tubo seco com ativador de coágulo (tampa vermelha).",
        ],
      },
      {
        titulo: "Stickybone / PRF Block",
        itens: [
          "Stickybone 1ª geração (membrana de L-PRF picada);",
          "Stickybone 2ª geração (membrana de L-PRF inteira);",
          "Stickybone 3.0 (I-PRF + exsudato);",
          "Stickybone 4.0 (técnica de PomSwing).",
        ],
      },
      {
        titulo: "P.A.D. — Protocolo Antidesperdício",
        texto:
          "Com a experiência de mais de 3.000 procedimentos, desenvolvemos um protocolo para evitar o desperdício de biomateriais: confirmação do procedimento; planejamento cirúrgico presencial; planejamento de coleta de tubos validado com o cirurgião; coleta e centrifugação na quantidade que o cirurgião deseja; personalização de espessura, formato, altura e técnica do Stickybone; Stickybone feito só com a confirmação do enxerto pelo cirurgião; produção fracionada conforme as embalagens de biomateriais; e produção ilimitada — sem adicional para novas coletas e produção de PRF no mesmo procedimento. Acompanhamos do início ao fim.",
      },
    ],
    observacao:
      "*Para produção de PRP utilizamos o tubo de tampa azul, com anticoagulante. Cada protocolo tem sua variável de força G e tempo específicos. Personalizamos tamanho, espessura e formato. Não fornecemos biomaterial para o Stickybone: ele deve ser fornecido pelo cirurgião. Acompanhamento não disponível no serviço Membranas. Valores válidos para um raio de até 150 km de São Paulo; Membranas nas regiões metropolitanas de SP, RJ, Curitiba e Vila Velha.",
  },
};

export function descritivoDaFamilia(familia: string): DescritivoDaFamilia | null {
  return DESCRITIVO_DAS_FAMILIAS[familia] ?? null;
}
