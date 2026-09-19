/**
 * Dados de demonstração.
 *
 * Serve para apresentar o sistema com as telas cheias — painel com números,
 * esteira com trabalho parado, agenda com gente ocupada e livre, financeiro
 * com mês fechado — sem esperar a operação real acontecer.
 *
 * Duas regras que valem para tudo aqui:
 *
 *   1. TODO registro criado tem id começando em "demo-". A limpeza apaga
 *      exatamente isso, e não precisa adivinhar nada nem chegar perto de um
 *      dado real. Se um dia esta operação estiver rodando de verdade, tirar a
 *      demonstração de cena é uma operação segura e completa.
 *   2. Nada de catálogo é alterado. Os serviços e os equipamentos reais
 *      continuam como estão. O preço da demonstração entra como PREÇO
 *      NEGOCIADO das clínicas de demonstração (PrecoClinica) — que é onde
 *      um valor por clínica vive de verdade no modelo da Hemoderi, mesmo
 *      agora que o catálogo tem preço de tabela real por trás.
 */

import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { hojeUTC, isoDeData, somarDias } from "./data";

const PREFIXO = "demo-";

/** Senha dos acessos de demonstração — dita em voz alta numa reunião. */
export const SENHA_DEMO = "hemoderi-demo-2026";

/**
 * Sorteio determinístico (mulberry32). A demonstração precisa ser a MESMA
 * toda vez que for montada: número que muda a cada recriação faz quem está
 * apresentando descobrir a tela na frente do cliente.
 */
function sorteio(semente: number) {
  let estado = semente;
  return () => {
    estado |= 0;
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLINICAS = [
  { nome: "Clínica Santa Helena Odontologia", slug: "santa-helena", salas: 10, bairro: "Moema", cidade: "São Paulo", uf: "SP", cnpj: "18.472.905/0001-34", telefone: "5511988120044" },
  { nome: "Instituto Bonfim Saúde Integrada", slug: "instituto-bonfim", salas: 4, bairro: "Pinheiros", cidade: "São Paulo", uf: "SP", cnpj: "24.109.663/0001-07", telefone: "5511987554321" },
  { nome: "Odontocenter Vila Mariana", slug: "odontocenter-vila-mariana", salas: 6, bairro: "Vila Mariana", cidade: "São Paulo", uf: "SP", cnpj: "31.556.220/0001-88", telefone: "5511986443210" },
  { nome: "Reviva Estética Avançada", slug: "reviva-estetica", salas: 3, bairro: "Jardins", cidade: "São Paulo", uf: "SP", cnpj: "40.882.117/0001-52", telefone: "5511985332109" },
  { nome: "Núcleo Odontológico Ipiranga", slug: "nucleo-ipiranga", salas: 2, bairro: "Ipiranga", cidade: "São Paulo", uf: "SP", cnpj: "27.634.009/0001-16", telefone: "5511984221098" },
];

const PROFISSIONAIS = [
  { nome: "Ana Beatriz Ribeiro", conselho: "COREN-SP", especialidade: "Enfermagem — PRF", repasse: 65 },
  { nome: "Bruno Tavares Lima", conselho: "CRO-SP", especialidade: "Cirurgia oral", repasse: null },
  { nome: "Camila Nogueira Alves", conselho: "COREN-SP", especialidade: "Enfermagem — coleta", repasse: 60 },
  { nome: "Diego Martins Fonseca", conselho: "CRO-SP", especialidade: "Implantodontia", repasse: 70 },
  { nome: "Eduarda Pires Campos", conselho: "CRBM-SP", especialidade: "Biomedicina estética", repasse: 62 },
  { nome: "Felipe Andrade Rocha", conselho: "CRO-SP", especialidade: "Periodontia", repasse: null },
  { nome: "Gabriela Souza Martins", conselho: "COREN-SP", especialidade: "Enfermagem — PRF", repasse: 65 },
  { nome: "Henrique Barros Teixeira", conselho: "CRM-SP", especialidade: "Sedação consciente", repasse: 55 },
  { nome: "Isabela Moreira Duarte", conselho: "CRBM-SP", especialidade: "Biomedicina estética", repasse: 62 },
  { nome: "João Pedro Vasconcelos", conselho: "CRO-SP", especialidade: "Cirurgia oral", repasse: null },
  { nome: "Karina Lopes Figueiredo", conselho: "COREN-SP", especialidade: "Enfermagem — coleta", repasse: 60 },
  { nome: "Leandro Cardoso Pinto", conselho: "CRO-SP", especialidade: "Implantodontia", repasse: 68 },
  { nome: "Mariana Esteves Brandão", conselho: "CRBM-SP", especialidade: "Estética avançada", repasse: 62 },
  { nome: "Nelson Rodrigues Prado", conselho: "CRO-SP", especialidade: "Laser terapêutico", repasse: null },
  { nome: "Olívia Fernandes Cruz", conselho: "COREN-SP", especialidade: "Enfermagem — PRF", repasse: 65 },
  { nome: "Paulo Henrique Xavier", conselho: "CRM-SP", especialidade: "Sedação consciente", repasse: 55 },
  { nome: "Renata Coelho Assunção", conselho: "CRBM-SP", especialidade: "Biomedicina estética", repasse: 62 },
  { nome: "Sérgio Almeida Bastos", conselho: "CRO-SP", especialidade: "Periodontia", repasse: null },
  { nome: "Tatiana Ramos Siqueira", conselho: "COREN-SP", especialidade: "Enfermagem — coleta", repasse: 60 },
  { nome: "Vitor Hugo Peixoto", conselho: "CRO-SP", especialidade: "Cirurgia oral", repasse: 66 },
  { nome: "Wanda Lira Monteiro", conselho: "CRBM-SP", especialidade: "Estética avançada", repasse: 62 },
  { nome: "Yasmin Carvalho Neves", conselho: "COREN-SP", especialidade: "Enfermagem — PRF", repasse: 65 },
];

/** Pacientes identificados só pelo primeiro nome e inicial — como manda a Cláusula 8. */
const PACIENTES = [
  "Marcos A.", "Juliana P.", "Rafael T.", "Beatriz M.", "Carlos E.", "Larissa S.",
  "Rodrigo F.", "Patrícia L.", "Thiago N.", "Vanessa R.", "André C.", "Simone D.",
  "Gustavo H.", "Aline B.", "Márcio V.", "Cristina O.", "Fábio G.", "Luciana Q.",
];

const HORARIOS = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

export type ResumoDemo = {
  clinicas: number;
  profissionais: number;
  pedidos: number;
  relatorios: number;
  repasses: number;
  faturas: number;
  avaliacoes: number;
  acessos: number;
};

/** Quanto de demonstração existe agora no banco. */
export async function estadoDemo(prisma: PrismaClient): Promise<ResumoDemo> {
  const onde = { id: { startsWith: PREFIXO } };
  const [clinicas, profissionais, pedidos, relatorios, repasses, faturas, avaliacoes, acessos] =
    await Promise.all([
      prisma.clinica.count({ where: onde }),
      prisma.profissional.count({ where: onde }),
      prisma.pedido.count({ where: onde }),
      prisma.relatorioAtendimento.count({ where: onde }),
      prisma.repasse.count({ where: onde }),
      prisma.fatura.count({ where: onde }),
      prisma.avaliacao.count({ where: onde }),
      prisma.usuario.count({ where: onde }),
    ]);
  return { clinicas, profissionais, pedidos, relatorios, repasses, faturas, avaliacoes, acessos };
}

/**
 * Apaga tudo que a demonstração criou — e só isso.
 *
 * A ordem respeita as chaves estrangeiras que NÃO são cascata: pedido aponta
 * para fatura, clínica e profissional sem cascata, então ele sai primeiro.
 * O que é cascata (relatório, repasse, mensagem, preço, disponibilidade)
 * cairia junto, mas sai explicitamente: apagar por engano o que não é
 * "demo-" é o erro que não se desfaz.
 */
export async function limparDemo(prisma: PrismaClient): Promise<ResumoDemo> {
  const antes = await estadoDemo(prisma);
  const onde = { id: { startsWith: PREFIXO } };

  await prisma.repasse.deleteMany({ where: onde });
  await prisma.avaliacao.deleteMany({ where: onde });
  await prisma.relatorioAtendimento.deleteMany({ where: onde });
  await prisma.mensagemWhatsapp.deleteMany({ where: onde });
  await prisma.pedido.deleteMany({ where: onde });
  await prisma.fatura.deleteMany({ where: onde });
  await prisma.usuario.deleteMany({ where: onde });
  await prisma.precoClinica.deleteMany({ where: onde });
  await prisma.disponibilidade.deleteMany({ where: onde });
  await prisma.bloqueio.deleteMany({ where: onde });
  await prisma.regraRepasse.deleteMany({ where: onde });
  await prisma.profissional.deleteMany({ where: onde });
  await prisma.clinica.deleteMany({ where: onde });

  return antes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures do seed de desenvolvimento (prisma/seed.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Os quatro cadastros fictícios que `prisma/seed.ts` cria para navegar em
 * desenvolvimento — Clínica Santa Rita, Instituto Vida Plena, Ana Ribeiro e
 * Bruno Tavares. O seed não deveria rodar contra produção, mas se rodou (ou
 * se algum ambiente foi montado a partir de um dump que os carregava), esta
 * limpeza os tira por identificador exato — slug e e-mail, nunca por nome —
 * do mesmo jeito que `limparDemo` tira o que tem prefixo "demo-".
 */
const SLUGS_FIXTURE_SEED = ["clinica-santa-rita", "instituto-vida-plena"];
const EMAILS_PROFISSIONAL_FIXTURE_SEED = ["ana@exemplo.com.br", "bruno@exemplo.com.br"];

export type ResumoFixturesSeed = { clinicas: number; profissionais: number; pedidos: number };

async function idsFixtureSeed(prisma: PrismaClient) {
  const [clinicas, profissionais] = await Promise.all([
    prisma.clinica.findMany({ where: { slug: { in: SLUGS_FIXTURE_SEED } }, select: { id: true } }),
    prisma.profissional.findMany({
      where: { email: { in: EMAILS_PROFISSIONAL_FIXTURE_SEED } },
      select: { id: true },
    }),
  ]);
  return { clinicaIds: clinicas.map((c) => c.id), profissionalIds: profissionais.map((p) => p.id) };
}

/** Quanto dos quatro cadastros do seed existe agora no banco. */
export async function estadoFixturesSeed(prisma: PrismaClient): Promise<ResumoFixturesSeed> {
  const { clinicaIds, profissionalIds } = await idsFixtureSeed(prisma);
  const pedidos =
    clinicaIds.length || profissionalIds.length
      ? await prisma.pedido.count({
          where: { OR: [{ clinicaId: { in: clinicaIds } }, { profissionalId: { in: profissionalIds } }] },
        })
      : 0;
  return { clinicas: clinicaIds.length, profissionais: profissionalIds.length, pedidos };
}

/**
 * Apaga só esses quatro cadastros, se existirem — idempotente, sem efeito se
 * já tiverem sido removidos.
 *
 * Ordem curta porque a maior parte do schema já cascateia a partir de
 * Profissional e Clínica (usuário, disponibilidade, agenda, preço
 * negociado). O que fica de fora da cascata — Pedido e Fatura, ambos com
 * chave obrigatória para Clínica — sai primeiro; o resto de um pedido
 * (relatório, avaliação, repasse, mensagem) cascateia dele.
 */
export async function limparFixturesSeed(prisma: PrismaClient): Promise<ResumoFixturesSeed> {
  const antes = await estadoFixturesSeed(prisma);
  const { clinicaIds, profissionalIds } = await idsFixtureSeed(prisma);
  if (clinicaIds.length === 0 && profissionalIds.length === 0) return antes;

  await prisma.pedido.deleteMany({
    where: { OR: [{ clinicaId: { in: clinicaIds } }, { profissionalId: { in: profissionalIds } }] },
  });
  await prisma.fatura.deleteMany({ where: { clinicaId: { in: clinicaIds } } });
  await prisma.profissional.deleteMany({ where: { id: { in: profissionalIds } } });
  await prisma.clinica.deleteMany({ where: { id: { in: clinicaIds } } });

  return antes;
}

const COMENTARIOS: Record<"bom" | "medio" | "ruim", string[]> = {
  bom: [
    "Pontual e muito atenciosa com a paciente. Pode mandar sempre.",
    "Excelente. A equipe da clínica elogiou o cuidado no preparo da sala.",
    "Chegou antes do horário e deixou tudo organizado. Sem nenhuma queixa.",
    "Profissional ótima, paciente pediu para remarcar com a mesma pessoa.",
  ],
  medio: [
    "Atendimento correto, mas atrasou uns 15 minutos e não avisou.",
    "Tudo certo no procedimento. Faltou passar as orientações por escrito.",
    "Dentro do esperado. Nada a reclamar, nada que se destacasse.",
  ],
  ruim: [
    "Chegou 40 minutos atrasada e a paciente foi embora antes.",
    "Precisamos remarcar. Combinar melhor o horário da próxima.",
  ],
};

/** Comentário coerente com a nota — elogio sob duas estrelas denuncia a demo. */
function comentarioPara(nota: number, i: number): string {
  const faixa = nota >= 4 ? "bom" : nota === 3 ? "medio" : "ruim";
  const lista = COMENTARIOS[faixa];
  return lista[i % lista.length];
}

/**
 * Monta a demonstração do zero. Limpa a anterior antes, para poder rodar de
 * novo sem duplicar e para que o resultado seja sempre o mesmo.
 */
export async function montarDemo(prisma: PrismaClient): Promise<ResumoDemo> {
  await limparDemo(prisma);

  const servicos = await prisma.servico.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, duracaoMin: true, categoria: true, exigeEquipamento: true },
  });
  if (servicos.length === 0) {
    throw new Error("O catálogo de serviços está vazio — rode /api/setup antes.");
  }

  const aleatorio = sorteio(20260913);
  const hoje = hojeUTC();
  const senhaHash = await bcrypt.hash(SENHA_DEMO, 10);

  // ── Clínicas ──────────────────────────────────────────────────────────────
  await prisma.clinica.createMany({
    data: CLINICAS.map((c, i) => ({
      id: `${PREFIXO}clinica-${i}`,
      nome: c.nome,
      slug: c.slug,
      cnpj: c.cnpj,
      telefone: c.telefone,
      email: `contato@${c.slug}.com.br`,
      endereco: `Rua das Acácias, ${100 + i * 37}`,
      bairro: c.bairro,
      cidade: c.cidade,
      uf: c.uf,
      salas: c.salas,
    })),
  });

  // ── Profissionais ─────────────────────────────────────────────────────────
  await prisma.profissional.createMany({
    data: PROFISSIONAIS.map((p, i) => ({
      id: `${PREFIXO}prof-${i}`,
      nome: p.nome,
      cpf: `${String(100 + i).padStart(3, "0")}.${String(400 + i)}.${String(700 + i)}-0${i % 10}`,
      telefone: `55119${String(70000000 + i * 1117).slice(0, 8)}`,
      email: `${p.nome.split(" ")[0].toLowerCase()}.${i}@demo.hemoderi.com.br`,
      conselho: p.conselho,
      registro: String(120000 + i * 733),
      especialidade: p.especialidade,
      chavePix: `${p.nome.split(" ")[0].toLowerCase()}.${i}@demo.hemoderi.com.br`,
      repassePercentPadrao: p.repasse,
    })),
  });

  // ── Disponibilidade semanal ───────────────────────────────────────────────
  // Cada profissional declara 3 a 5 dias, manhã e/ou tarde. É o que faz a
  // agenda mostrar "quem está livre" em vez de uma lista de nomes sem
  // expediente.
  const disponibilidades: { id: string; profissionalId: string; diaSemana: number; horaInicio: string; horaFim: string }[] = [];
  PROFISSIONAIS.forEach((_, i) => {
    const diasDaSemana = [1, 2, 3, 4, 5].filter(() => aleatorio() > 0.25);
    const dias = diasDaSemana.length >= 3 ? diasDaSemana : [1, 3, 5];
    dias.forEach((dia) => {
      disponibilidades.push({
        id: `${PREFIXO}disp-${i}-${dia}-m`,
        profissionalId: `${PREFIXO}prof-${i}`,
        diaSemana: dia,
        horaInicio: "08:00",
        horaFim: "12:00",
      });
      if (aleatorio() > 0.3) {
        disponibilidades.push({
          id: `${PREFIXO}disp-${i}-${dia}-t`,
          profissionalId: `${PREFIXO}prof-${i}`,
          diaSemana: dia,
          horaInicio: "13:00",
          horaFim: "18:00",
        });
      }
    });
  });
  await prisma.disponibilidade.createMany({ data: disponibilidades });

  // ── Ausências pontuais ────────────────────────────────────────────────────
  await prisma.bloqueio.createMany({
    data: [
      { id: `${PREFIXO}bloq-0`, profissionalId: `${PREFIXO}prof-3`, data: somarDias(hoje, 2), motivo: "Congresso de implantodontia" },
      { id: `${PREFIXO}bloq-1`, profissionalId: `${PREFIXO}prof-7`, data: somarDias(hoje, 1), horaInicio: "13:00", horaFim: "18:00", motivo: "Compromisso pessoal" },
      { id: `${PREFIXO}bloq-2`, profissionalId: `${PREFIXO}prof-11`, data: somarDias(hoje, 5), motivo: "Férias" },
    ],
  });

  // ── Preço negociado por clínica ───────────────────────────────────────────
  // O catálogo real fica intocado (valor de tabela continua zerado, como
  // combinado). O preço da demonstração entra aqui, que é onde ele vive de
  // verdade: cada clínica paga o seu.
  const precoBase = (categoria: string) =>
    categoria === "ODONTOLOGIA" ? 48000 : categoria === "ESTETICA" ? 62000 : 39000;
  const precos: { id: string; clinicaId: string; servicoId: string; valorCentavos: number }[] = [];
  CLINICAS.forEach((_, ci) => {
    servicos.forEach((s, si) => {
      // Cada clínica negocia a sua faixa: a maior (Santa Helena) paga menos
      // por volume, a menor paga mais. É o que a tela de preço por clínica
      // existe para mostrar.
      const ajuste = 1 + (ci - 2) * 0.06;
      precos.push({
        id: `${PREFIXO}preco-${ci}-${si}`,
        clinicaId: `${PREFIXO}clinica-${ci}`,
        servicoId: s.id,
        valorCentavos: Math.round((precoBase(s.categoria) * ajuste) / 100) * 100,
      });
    });
  });
  await prisma.precoClinica.createMany({ data: precos });
  const precoDe = new Map(precos.map((p) => [`${p.clinicaId}|${p.servicoId}`, p.valorCentavos]));

  // ── Pedidos ───────────────────────────────────────────────────────────────
  // Espalhados de 45 dias atrás até 21 dias à frente. O passado alimenta
  // financeiro, produtividade e ganhos; o futuro alimenta agenda e esteira.
  type NovoPedido = {
    id: string;
    numero: number;
    clinicaId: string;
    servicoId: string;
    profissionalId: string | null;
    data: Date;
    horaInicio: string;
    duracaoMin: number;
    status: "SOLICITADO" | "CONFIRMADO" | "ALOCADO" | "REALIZADO" | "FALTOU" | "CANCELADO";
    origem: "INTERNO" | "PORTAL_CLINICA";
    valorServicoCentavos: number;
    valorRepasseCentavos: number;
    pacienteNome: string;
    observacoes?: string;
  };

  const pedidos: NovoPedido[] = [];
  let numero = 9000;

  for (let deslocamento = -45; deslocamento <= 21; deslocamento++) {
    const data = somarDias(hoje, deslocamento);
    const diaSemana = data.getUTCDay();
    const passado = deslocamento < 0;
    const hojeMesmo = deslocamento === 0;

    // Domingo a operação não atende — MENOS hoje. A tela "Hoje" é a primeira
    // que alguém abre numa apresentação, e ela não pode depender do dia da
    // semana em que a apresentação caiu: demonstração com o painel do dia
    // vazio não demonstra nada.
    if (diaSemana === 0 && !hojeMesmo) continue;

    // Sábado rende menos; dia útil rende de 2 a 5. Hoje rende sempre o
    // suficiente para a agenda do dia ter o que mostrar.
    const quantos = hojeMesmo
      ? 5 + Math.floor(aleatorio() * 3)
      : diaSemana === 6
        ? 1 + Math.floor(aleatorio() * 2)
        : 2 + Math.floor(aleatorio() * 4);

    for (let i = 0; i < quantos; i++) {
      const ci = Math.floor(aleatorio() * CLINICAS.length);
      const si = Math.floor(aleatorio() * servicos.length);
      const pi = Math.floor(aleatorio() * PROFISSIONAIS.length);
      const servico = servicos[si];
      const clinicaId = `${PREFIXO}clinica-${ci}`;
      const valor = precoDe.get(`${clinicaId}|${servico.id}`) ?? 45000;

      // Uma parte do que está à frente ainda não tem profissional: é a fila
      // de trabalho que a esteira existe para mostrar.
      const semProfissional = !passado && !hojeMesmo && aleatorio() < 0.12;
      const sorte = aleatorio();

      let status: NovoPedido["status"];
      if (passado) status = sorte < 0.82 ? "REALIZADO" : sorte < 0.92 ? "FALTOU" : "CANCELADO";
      else if (hojeMesmo) status = sorte < 0.7 ? "ALOCADO" : "CONFIRMADO";
      else if (semProfissional) status = sorte < 0.5 ? "SOLICITADO" : "CONFIRMADO";
      else status = sorte < 0.45 ? "ALOCADO" : sorte < 0.8 ? "CONFIRMADO" : "SOLICITADO";

      const repassePercent = PROFISSIONAIS[pi].repasse ?? 60;
      const alocado = !semProfissional;

      pedidos.push({
        id: `${PREFIXO}pedido-${numero}`,
        numero: numero++,
        clinicaId,
        servicoId: servico.id,
        profissionalId: alocado ? `${PREFIXO}prof-${pi}` : null,
        data,
        horaInicio: HORARIOS[Math.floor(aleatorio() * HORARIOS.length)],
        duracaoMin: servico.duracaoMin,
        status,
        origem: aleatorio() < 0.4 ? "PORTAL_CLINICA" : "INTERNO",
        valorServicoCentavos: valor,
        valorRepasseCentavos:
          alocado && status !== "SOLICITADO" ? Math.round((valor * repassePercent) / 100) : 0,
        pacienteNome: PACIENTES[Math.floor(aleatorio() * PACIENTES.length)],
      });
    }
  }
  await prisma.pedido.createMany({ data: pedidos });

  // ── Relatórios dos atendimentos fechados ──────────────────────────────────
  // Parte deles com coordenada: é o que faz o selo "local confirmado"
  // aparecer na esteira.
  const fechados = pedidos.filter((p) => p.status === "REALIZADO" || p.status === "FALTOU");
  await prisma.relatorioAtendimento.createMany({
    data: fechados.map((p, i) => {
      const comLocal = i % 3 !== 0;
      return {
        id: `${PREFIXO}relatorio-${p.numero}`,
        pedidoId: p.id,
        profissionalId: p.profissionalId!,
        compareceu: p.status === "REALIZADO",
        inicioReal: p.horaInicio,
        quantidade: 1,
        intercorrencia: i % 17 === 0,
        // Coordenadas espalhadas pela zona sul de São Paulo, perto de onde as
        // clínicas da demonstração ficam.
        latitude: comLocal ? -23.58 - (i % 7) * 0.004 : null,
        longitude: comLocal ? -46.66 - (i % 5) * 0.005 : null,
        precisaoMetros: comLocal ? 12 + (i % 9) : null,
      };
    }),
  });

  // ── Repasses dos realizados ───────────────────────────────────────────────
  const realizados = pedidos.filter((p) => p.status === "REALIZADO" && p.profissionalId);
  await prisma.repasse.createMany({
    data: realizados.map((p) => {
      const competencia = isoDeData(p.data).slice(0, 7);
      const mesPassado = competencia < isoDeData(hoje).slice(0, 7);
      return {
        id: `${PREFIXO}repasse-${p.numero}`,
        pedidoId: p.id,
        profissionalId: p.profissionalId!,
        competencia,
        valorCentavos: p.valorRepasseCentavos,
        // O mês fechado já foi pago; o mês corrente ainda está pendente — é
        // a diferença que a tela "a pagar" mostra.
        status: mesPassado ? "PAGO" : "PENDENTE",
        pagoEm: mesPassado ? somarDias(hoje, -5) : null,
      };
    }),
  });

  // ── Avaliações das clínicas ───────────────────────────────────────────────
  // Nem todo atendimento é avaliado, e é assim mesmo na operação real: uma
  // demonstração em que 100% tem nota esconde justamente a fila de pendentes
  // que o portal da clínica mostra. Nota alta na maioria, com algumas médias e
  // uma ruim — a média que só tem cinco estrelas não informa nada.
  const avaliaveis = realizados.filter(() => aleatorio() < 0.7);
  await prisma.avaliacao.createMany({
    data: avaliaveis.map((p, i) => {
      const sorte = aleatorio();
      const nota = sorte < 0.55 ? 5 : sorte < 0.82 ? 4 : sorte < 0.94 ? 3 : sorte < 0.98 ? 2 : 1;
      return {
        id: `${PREFIXO}avaliacao-${p.numero}`,
        pedidoId: p.id,
        profissionalId: p.profissionalId!,
        clinicaId: p.clinicaId,
        nota,
        // Comentário só em parte delas, e escolhido pela faixa da nota: um
        // elogio embaixo de duas estrelas é o detalhe que faz a demonstração
        // parecer inventada.
        comentario: i % 3 === 0 ? comentarioPara(nota, i) : null,
        criadaEm: somarDias(p.data, 1),
      };
    }),
  });

  // ── Uma competência já faturada ───────────────────────────────────────────
  // Dá o que mostrar na aba de faturas e deixa a conta "a receber" com
  // história, não só com o mês em aberto.
  const mesPassado = isoDeData(somarDias(hoje, -40)).slice(0, 7);
  const faturaveis = pedidos.filter(
    (p) => p.status === "REALIZADO" && isoDeData(p.data).slice(0, 7) === mesPassado
  );
  const porClinica = new Map<string, typeof faturaveis>();
  for (const p of faturaveis) {
    const lista = porClinica.get(p.clinicaId);
    if (lista) lista.push(p);
    else porClinica.set(p.clinicaId, [p]);
  }

  let numeroFatura = 900;
  // Parte já paga, parte ainda em aberto: é a diferença entre "faturei" e
  // "recebi", e é o número que o painel mostra como "a receber de clínicas".
  // Com tudo pago, esse cartão fica zerado e a conversa sobre inadimplência
  // não tem onde acontecer.
  const faturas = Array.from(porClinica.entries()).map(([clinicaId, lista], i) => {
    const paga = i % 5 !== 0 && i % 5 !== 3;
    return {
      id: `${PREFIXO}fatura-${clinicaId}`,
      numero: numeroFatura++,
      clinicaId,
      competencia: mesPassado,
      valorCentavos: lista.reduce((soma, p) => soma + p.valorServicoCentavos, 0),
      vencimento: paga ? somarDias(hoje, -5) : somarDias(hoje, 8),
      status: paga ? ("PAGA" as const) : ("ABERTA" as const),
      pagaEm: paga ? somarDias(hoje, -3) : null,
    };
  });
  if (faturas.length > 0) {
    await prisma.fatura.createMany({ data: faturas });
    for (const [clinicaId, lista] of porClinica.entries()) {
      await prisma.pedido.updateMany({
        where: { id: { in: lista.map((p) => p.id) } },
        data: { faturaId: `${PREFIXO}fatura-${clinicaId}` },
      });
    }
  }

  // ── Acessos para mostrar os três portais ao vivo ──────────────────────────
  await prisma.usuario.createMany({
    data: [
      {
        id: `${PREFIXO}user-clinica`,
        nome: "Recepção Santa Helena",
        email: "clinica@demo.hemoderi.com.br",
        senhaHash,
        papel: "CLINICA",
        clinicaId: `${PREFIXO}clinica-0`,
      },
      {
        id: `${PREFIXO}user-prof`,
        nome: PROFISSIONAIS[0].nome,
        email: "profissional@demo.hemoderi.com.br",
        senhaHash,
        papel: "PROFISSIONAL",
        profissionalId: `${PREFIXO}prof-0`,
      },
      {
        id: `${PREFIXO}user-equipe`,
        nome: "Equipe Hemoderi (demonstração)",
        email: "equipe@demo.hemoderi.com.br",
        senhaHash,
        papel: "INTERNO",
      },
    ],
  });

  return estadoDemo(prisma);
}
