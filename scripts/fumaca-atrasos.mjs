/**
 * Teste de fumaça do check-in com justificativa e do relatório de atrasos
 * (ata de 28/09).
 *
 * O que prova: quem chega depois do horário recebe o campo de justificativa
 * antes de confirmar (mas não fica preso a ele), o atraso aparece na esteira
 * para a central avisar a clínica, e o relatório lista o caso com a
 * justificativa ao lado — respeitando a tolerância.
 *
 *   npm run fumaca:atrasos
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3003";
const EXECUTAVEL = process.env.CHROMIUM_PATH;
const SENHA = "hemoderi123";
const PACIENTE_ATRASADO = "Paciente Atrasado";
const PACIENTE_NO_PRAZO = "Paciente No Prazo";

let passou = 0;
let falhou = 0;
function ok(nome, condicao, detalhe = "") {
  if (condicao) {
    passou++;
    console.log(`  ok  ${nome}`);
  } else {
    falhou++;
    console.log(`FALHA ${nome} ${detalhe}`);
  }
}

async function entrar(page, email) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="senha"]', SENHA);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
}

/** "HH:MM" de agora, deslocado, no fuso da operação. */
function horaRelativa(minutos) {
  const quando = new Date(Date.now() + minutos * 60_000);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(quando);
}

const prisma = new PrismaClient();
const nav = await chromium.launch(EXECUTAVEL ? { executablePath: EXECUTAVEL } : {});
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => ok(`erro de JS: ${e.message}`, false));

const limpar = () =>
  prisma.pedido.deleteMany({ where: { pacienteNome: { in: [PACIENTE_ATRASADO, PACIENTE_NO_PRAZO] } } });

try {
  await limpar();

  const profissional = await prisma.profissional.findFirst({
    where: { ativo: true, usuarios: { some: { email: "ana@exemplo.com.br" } } },
    select: { id: true },
  });
  const clinica = await prisma.clinica.findFirst({ where: { ativa: true }, select: { id: true } });
  const servico = await prisma.servico.findFirst({
    where: { ativo: true },
    select: { id: true, duracaoMin: true },
  });

  // `Pedido.data` é o DIA à meia-noite UTC (lib/data.ts, hojeUTC), não um
  // instante: a agenda do profissional compara `data: hoje` por igualdade, e
  // um `new Date()` cru nunca casa.
  const [ano, mes, dia] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(new Date())
    .split("-")
    .map(Number);
  const hoje = new Date(Date.UTC(ano, mes - 1, dia));

  const base = {
    clinicaId: clinica.id,
    servicoId: servico.id,
    profissionalId: profissional.id,
    data: hoje,
    duracaoMin: servico.duracaoMin,
    status: "ALOCADO",
    aceitoEm: new Date(),
    valorServicoCentavos: 20_000,
    valorRepasseCentavos: 12_000,
  };

  // Um combinado já vencido e outro para agora — é o par que prova a régua.
  //
  // O vencido é "00:00" e não "agora menos 90 minutos": subtrair de agora
  // atravessa a meia-noite na madrugada, e o agendamento cairia no dia
  // anterior enquanto a tela mostra só os de hoje. Meia-noite de hoje está no
  // passado em qualquer hora do dia — exceto nos primeiros minutos depois
  // dela, que é a única janela em que este teste não vale.
  const HORA_ATRASADA = "00:00";
  await prisma.pedido.create({
    data: { ...base, numero: 950000 + (Date.now() % 40000), horaInicio: HORA_ATRASADA, pacienteNome: PACIENTE_ATRASADO },
  });
  const HORA_NO_PRAZO = horaRelativa(0);
  await prisma.pedido.create({
    data: { ...base, numero: 960000 + (Date.now() % 30000), horaInicio: HORA_NO_PRAZO, pacienteNome: PACIENTE_NO_PRAZO },
  });

  // ── O profissional registra a chegada ────────────────────────────────────
  await entrar(p, "ana@exemplo.com.br");
  await p.goto(`${BASE}/profissional`);
  await p.waitForTimeout(2000);

  // A tela do profissional não mostra o nome do paciente (é sigilo, por
  // decisão da operação), então o que identifica cada atendimento aqui é o
  // horário combinado — que é justamente o que este teste controla.
  const cartaoPorHora = (hora) =>
    p.locator("div.border-b").filter({ hasText: hora }).filter({ has: p.locator("button") }).last();
  const cartaoAtrasado = cartaoPorHora(HORA_ATRASADA);
  const cartaoNoPrazo = cartaoPorHora(HORA_NO_PRAZO);

  // Quem está no horário confirma direto, sem justificar nada.
  await cartaoNoPrazo.locator('button:has-text("Cheguei no local")').click();
  await p.waitForTimeout(1000);
  ok(
    "chegada no horário não pede justificativa",
    (await cartaoNoPrazo.locator("textarea").count()) === 0
  );
  await p.waitForTimeout(7000);

  // Quem passou do horário abre o campo antes de confirmar.
  await cartaoAtrasado.locator('button:has-text("Cheguei no local")').click();
  await p.waitForTimeout(800);
  ok("chegada atrasada pede justificativa", (await cartaoAtrasado.locator("textarea").count()) === 1);
  await cartaoAtrasado.locator("textarea").fill("Elevador de serviço parado no prédio.");
  await cartaoAtrasado.locator('button:has-text("Confirmar chegada")').click();
  // O check-in busca localização antes de gravar (teto de 4s).
  await p.waitForTimeout(9000);

  const atrasado = await prisma.pedido.findFirst({
    where: { pacienteNome: PACIENTE_ATRASADO },
    select: { checkinEm: true, checkinJustificativa: true },
  });
  ok("a chegada atrasada foi registrada", atrasado?.checkinEm != null);
  ok(
    "a justificativa foi gravada",
    atrasado?.checkinJustificativa === "Elevador de serviço parado no prédio.",
    String(atrasado?.checkinJustificativa)
  );

  const noPrazo = await prisma.pedido.findFirst({
    where: { pacienteNome: PACIENTE_NO_PRAZO },
    select: { checkinEm: true, checkinJustificativa: true },
  });
  ok("a chegada no horário foi registrada", noPrazo?.checkinEm != null);
  ok("chegada no horário não guarda justificativa", noPrazo?.checkinJustificativa === null);

  // ── A central vê o atraso na esteira ────────────────────────────────────
  await entrar(p, "equipe@hemoderi.com.br");
  await p.goto(`${BASE}/painel/pedidos?filtro=alocados`);
  await p.waitForTimeout(1800);
  const esteira = await p.innerText("body");
  ok("a esteira mostra o atraso", /de atraso/.test(esteira), esteira.slice(0, 300));
  ok("a esteira mostra a justificativa junto", esteira.includes("Elevador de serviço parado"));

  // ── O relatório de atrasos ──────────────────────────────────────────────
  await p.goto(`${BASE}/painel/profissionais/atrasos`);
  await p.waitForTimeout(1800);
  const relatorio = await p.innerText("body");
  ok("o relatório de atrasos abre", relatorio.includes("Atrasos de chegada"), relatorio.slice(0, 200));
  ok("o atraso aparece no relatório", relatorio.includes("Elevador de serviço parado"));
  // A tolerância é a regra que decide quem entra aqui — precisa estar escrita
  // na tela, senão quem lê não sabe o que o número significa.
  ok("o relatório diz qual é a tolerância", /tolerância de \d+/.test(relatorio));
  await p.goto(`${BASE}/painel/profissionais`);
  await p.waitForTimeout(1500);
  ok(
    "Profissionais tem o link do relatório",
    (await p.locator('a:has-text("Atrasos de chegada")').count()) > 0
  );
} finally {
  await nav.close();
  await limpar();
  await prisma.$disconnect();
}

console.log(`\n${passou}/${passou + falhou} OK`);
process.exit(falhou > 0 ? 1 : 0);
