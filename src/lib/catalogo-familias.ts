/**
 * O descritivo de cada seção do catálogo institucional 2026 (PDF), para a
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

const GRANDE_SP =
  "Valores válidos para a Grande São Paulo. Procedimentos num raio acima de 150 km de São Paulo têm taxa de deslocamento de R$ 200,00.";

export const DESCRITIVO_DAS_FAMILIAS: Record<string, DescritivoDaFamilia> = {
  "AirFlow GBT Machine": {
    imagem: "/catalogo/airflow.webp",
    legenda: "GBT Machine – AirFlow",
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
          "1 profissional cirurgião-dentista com treinamento na metodologia GBT;",
          "Insumos: Airflow Prophylaxis Powder (pó de eritritol), revelador Biofilm Discloser, ponta Perioflow descartável e ponta ultrassônica PS.",
        ],
      },
    ],
    observacao: GRANDE_SP,
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
          "Cirurgião-dentista habilitado, com treinamento completo e experiência com adultos, crianças e pacientes com necessidades especiais. Atendemos remoção de lentes, facetas e coroas, procedimentos cirúrgicos e dessensibilização dentária.",
      },
      {
        titulo: "O que inclui",
        itens: [
          "Profissional cirurgião-dentista habilitado para operação do equipamento e assistente;",
          "Todos os insumos e instrumentais para a realização do procedimento;",
          "Logística do equipamento;",
          "Ponteiras para todas as especialidades;",
          "Montagem e desmontagem do equipamento seguindo normas de segurança;",
          "EPIs.",
        ],
      },
    ],
    observacao: GRANDE_SP,
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
          "Cirurgião-dentista para a realização da sedação;",
          "5 opções de máscara;",
          "Locação do equipamento com os cilindros;",
          "Logística, montagem, desmontagem e assepsia do equipamento;",
          "Monitoramento dos sinais vitais durante todo o procedimento.",
        ],
      },
    ],
    observacao:
      "Atendimentos na Grande São Paulo e no interior até 150 km. Consulte o deslocamento para distâncias acima de 150 km da cidade de São Paulo.",
  },

  "Piezosurgery Mectron Touch": {
    imagem: "/catalogo/piezosurgery.webp",
    legenda: "Locação de equipamento de Piezo com pontas",
    blocos: [
      { titulo: "Serviços", texto: "Locação de equipamento Piezosurgery Mectron Touch com pontas inclusas." },
      {
        titulo: "Equipe",
        texto:
          "Profissionais da saúde com experiência em UTI e centro cirúrgico para fazer a instrumentação do equipamento, mantendo todas as melhores práticas de assepsia e biossegurança.",
      },
      {
        titulo: "O que inclui",
        itens: [
          "Profissional para instrumentação;",
          "Locação do equipamento com as pontas disponíveis;",
          "Seguro do equipamento;",
          "EPIs.",
        ],
      },
    ],
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
        texto:
          "Profissionais especializados em fotografia odontológica. Captura e tratamento de imagens de pacientes, cirurgias, planejamentos, congressos, indústria de implantes, equipamentos, instrumentais e aulas.",
      },
      {
        titulo: "O que inclui",
        itens: [
          "Contratação do profissional e deslocamento;",
          "Máquina fotográfica profissional;",
          "Materiais estéreis e EPIs;",
          "Tratamento das fotos.",
        ],
      },
    ],
    observacao: "Adicional de deslocamento para cidades fora das regiões metropolitanas.",
  },

  "Ultrassom Micro Focado": {
    imagem: "/catalogo/ultrassom.webp",
    legenda: "Locação de Ultrassom Micro e Macro Focado — Atria®",
    blocos: [
      {
        titulo: "Serviços",
        texto:
          "Locação de equipamento Atria® + logística + profissional com ampla experiência para acompanhar a montagem e a regulagem do equipamento.",
      },
      {
        titulo: "Equipe",
        texto:
          "Biomédico esteta especialista. O profissional irá instrumentar o equipamento, fornecer os protocolos indicados pelo fabricante e orientar as melhores práticas.",
      },
      {
        titulo: "O que inclui",
        itens: [
          "Profissional biomédico esteta;",
          "Todos os insumos e EPIs;",
          "Logística do equipamento;",
          "2 handpieces;",
          "Insumos carregados nas profundidades: Atria Pen 1,5 mm, 3 mm e 4,5 mm · Atria Scan Microfocado 1,5 mm, 2 mm, 3 mm e 4,5 mm · Atria Scan Macrofocado 6 mm, 9 mm e 13 mm;",
          "Montagem e desmontagem do equipamento seguindo normas de segurança.",
        ],
      },
    ],
    observacao: GRANDE_SP,
  },

  "Megaderme – Radiofrequência Microagulhada": {
    imagem: "/catalogo/megaderme.webp",
    legenda: "Locação Megaderme — microagulhamento com radiofrequência fracionada",
    blocos: [
      {
        titulo: "Serviços",
        texto:
          "Locação de equipamento Megaderme® + logística + profissional com ampla experiência para acompanhar a montagem e a regulagem do equipamento.",
      },
      {
        titulo: "Equipe",
        texto:
          "Biomédico esteta especialista. O profissional irá instrumentar o equipamento, fornecer os protocolos indicados pelo fabricante e orientar as melhores práticas.",
      },
      {
        titulo: "O que inclui",
        itens: [
          "Profissional biomédico esteta;",
          "Todos os insumos e EPIs;",
          "Logística do equipamento;",
          "1 handpiece Eletroderme RF;",
          "Insumos individuais e estéreis por paciente;",
          "Montagem e desmontagem do equipamento seguindo normas de segurança.",
        ],
      },
      {
        titulo: "Principais indicações — Eletroderme RF",
        itens: [
          "Tratamento de estrias;",
          "Tratamento de melasma;",
          "Cicatrizes: de acne, de queimadura e cirúrgica;",
          "Skin tightening para regiões de face e pescoço;",
          "Resurfacing: redução de rugas em face e pescoço;",
          "Poros dilatados — melhora da textura da pele.",
        ],
      },
    ],
    observacao: GRANDE_SP,
  },

  "Platinum Platform": {
    imagem: "/catalogo/platinum.webp",
    legenda: "Locação Platinum Platform",
    blocos: [
      {
        titulo: "Luz Intensa Pulsada — principais indicações",
        itens: [
          "Acne ativa;",
          "Estímulo de colágeno e rejuvenescimento;",
          "Hemangiomas planos — manchas vinho do porto;",
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
          "Locação do equipamento Platinum Platform com ponteiras IPL, Er:YAG e Q-Switched;",
          "Procedimento acompanhado por biomédico esteta especialista Hemoderi.",
        ],
      },
    ],
    observacao: GRANDE_SP,
  },

  "Laser Therapy EC": {
    imagem: "/catalogo/laser-therapy.webp",
    legenda: "Locação Laser Therapy EC + ILIB",
    blocos: [
      {
        titulo: "O que inclui",
        itens: [
          "Locação do Laser Therapy EC;",
          "Procedimento acompanhado por profissional, com as orientações de uso do equipamento;",
          "Acompanha ILIB.",
        ],
      },
      {
        titulo: "Adicional",
        texto: "Valor exclusivo para contratação junto com outro serviço Hemoderi.",
      },
    ],
    observacao: GRANDE_SP,
  },

  "Bisturi Elétrico": {
    imagem: "/catalogo/bisturi.webp",
    legenda: "Locação de Bisturi Elétrico",
    blocos: [
      {
        titulo: "Serviços",
        texto:
          "Locação de bisturi elétrico + logística + profissional com ampla experiência para acompanhar a montagem e a regulagem do equipamento.",
      },
      {
        titulo: "Equipe",
        texto:
          "A equipe Hemoderi organiza a logística, confere o equipamento e auxilia na montagem. O procedimento permanece sob responsabilidade do cirurgião.",
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
    observacao: GRANDE_SP,
  },

  "Motor de Implante": {
    imagem: "/catalogo/motor-implante.webp",
    legenda: "Locação de Motor de Implante",
    blocos: [
      {
        titulo: "Serviços",
        texto:
          "Locação de motor de implante + logística + profissional com ampla experiência para acompanhar a montagem e a regulagem do equipamento.",
      },
      {
        titulo: "Equipe",
        texto:
          "A equipe Hemoderi organiza a logística, confere o equipamento e auxilia na montagem. O procedimento permanece sob responsabilidade do cirurgião.",
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
    observacao: `Não garantimos a marca do motor que será enviada. ${GRANDE_SP}`,
  },

  "PRF – Coleta e Produção": {
    imagem: "/catalogo/prf.webp",
    legenda: "PRF — produzimos no protocolo de sua preferência",
    blocos: [
      {
        titulo: "O que está incluso ao escolher um serviço Hemoderi",
        itens: [
          "1. Contratação e deslocamento do profissional;",
          "2. Materiais de coleta (tubos, escape, luvas, garrote, stopblood e álcool 70%);",
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
        titulo: "P.A.D. — Protocolo Anti Desperdício",
        texto:
          "Com a experiência de mais de 3.000 procedimentos, desenvolvemos um protocolo para evitar o desperdício de biomateriais em suas cirurgias: confirmação do procedimento, planejamento cirúrgico presencial, planejamento de coleta de tubos validado com o cirurgião e produção de membranas, supermembranas, plugs e I-PRF na quantidade que o cirurgião deseja para cada procedimento. Acompanhamos o procedimento do início ao fim.",
      },
    ],
    observacao:
      "*Para produção de PRP utilizamos o tubo de tampa azul, com anticoagulante. Cada protocolo tem sua variável de força G e tempo específicos. Personalizamos tamanho, espessura e formato. Não fornecemos biomaterial para o Stickybone: ele deve ser fornecido pelo cirurgião. Acompanhamento não disponível no serviço Membranas.",
  },
};

export function descritivoDaFamilia(familia: string): DescritivoDaFamilia | null {
  return DESCRITIVO_DAS_FAMILIAS[familia] ?? null;
}
