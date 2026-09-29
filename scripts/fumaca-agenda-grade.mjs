/**
 * Teste de fumaça da agenda no formato Google Agenda (ata de 28/09).
 *
 * O que prova: a visão de período (vários dias) desenha uma grade com faixa
 * de horas na vertical, uma coluna por dia, e cada atendimento como um bloco
 * posicionado pelo horário — clicável para o pedido. A visão de um dia segue
 * agrupada por profissional (não foi trocada).
 *
 *   npm run fumaca:agenda-grade
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3003";
const EXECUTAVEL = process.env.CHROMIUM_PATH;
const SENHA = "hemoderi123";
const PACIENTE = "Paciente Grade";

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

const prisma = new PrismaClient();
const nav = await chromium.launch(EXECUTAVEL ? { executablePath: EXECUTAVEL } : {});
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => ok(`erro de JS: ${e.message}`, false));

const limpar = () => prisma.pedido.deleteMany({ where: { pacienteNome: PACIENTE } });

// Segunda-feira desta semana, em UTC truncado — dia estável para ancorar a
// URL da agenda (?data=...&dias=7) sem depender de quando o teste roda.
function segundaDesteBloco() {
  const [ano, mes, dia] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(new Date())
    .split("-")
    .map(Number);
  const hoje = new Date(Date.UTC(ano, mes - 1, dia));
  const diaSemana = hoje.getUTCDay(); // 0=dom
  const recuo = (diaSemana + 6) % 7; // volta até segunda
  return new Date(hoje.getTime() - recuo * 86400000);
}

try {
  await limpar();

  const clinica = await prisma.clinica.findFirst({ where: { ativa: true }, select: { id: true, nome: true } });
  const servico = await prisma.servico.findFirst({ where: { ativo: true }, select: { id: true, duracaoMin: true } });
  const profissional = await prisma.profissional.findFirst({ where: { ativo: true }, select: { id: true } });

  const segunda = segundaDesteBloco();
  const segundaISO = segunda.toISOString().slice(0, 10);
  // Dois atendimentos em dias diferentes da semana, em horários diferentes.
  await prisma.pedido.create({
    data: {
      numero: 990000 + (Date.now() % 9000),
      clinicaId: clinica.id,
      servicoId: servico.id,
      profissionalId: profissional.id,
      data: segunda,
      horaInicio: "09:00",
      duracaoMin: 60,
      status: "ALOCADO",
      pacienteNome: PACIENTE,
      valorServicoCentavos: 10_000,
      valorRepasseCentavos: 6_000,
    },
  });
  await prisma.pedido.create({
    data: {
      numero: 991000 + (Date.now() % 8000),
      clinicaId: clinica.id,
      servicoId: servico.id,
      data: new Date(segunda.getTime() + 2 * 86400000), // quarta
      horaInicio: "15:00",
      duracaoMin: 120,
      status: "CONFIRMADO",
      pacienteNome: PACIENTE,
      valorServicoCentavos: 10_000,
    },
  });

  await entrar(p, "equipe@hemoderi.com.br");
  await p.goto(`${BASE}/painel/agenda?data=${segundaISO}&dias=7`);
  await p.waitForTimeout(2000);

  const corpo = await p.innerText("body");
  ok("a faixa de horas aparece na lateral", corpo.includes("09h") && corpo.includes("15h"), corpo.slice(0, 120));

  // Os blocos são links posicionados por estilo (top absoluto).
  const blocos = p.locator('a[href^="/painel/pedidos/"]').filter({ hasText: clinica.nome });
  const qtd = await blocos.count();
  ok("os atendimentos viram blocos na grade", qtd >= 2, `encontrados ${qtd}`);

  const estilo = qtd > 0 ? await blocos.first().getAttribute("style") : "";
  ok("os blocos são posicionados por horário (top/height)", /top:\s*\d/.test(estilo) && /height:/.test(estilo), estilo);

  ok("o bloco leva ao pedido ao clicar", (await blocos.first().getAttribute("href"))?.startsWith("/painel/pedidos/"));

  await p.screenshot({ path: "/tmp/agenda-grade.png", fullPage: true });

  // ── A visão de um dia continua por profissional ──────────────────────────
  await p.goto(`${BASE}/painel/agenda?data=${segundaISO}&dias=1`);
  await p.waitForTimeout(1500);
  const umDia = await p.innerText("body");
  ok(
    "a visão de um dia segue agrupada por profissional",
    umDia.includes("sem disponibilidade declarada") || umDia.includes("ausência marcada") || umDia.includes("Livre."),
    umDia.slice(0, 160)
  );
} finally {
  await nav.close();
  await limpar();
  await prisma.$disconnect();
}

console.log(`\n${passou}/${passou + falhou} OK`);
process.exit(falhou > 0 ? 1 : 0);
