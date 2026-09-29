/**
 * Teste de fumaça do módulo de disponibilidade da logística (ata de 28/09).
 *
 * O que prova: a logística abre a grade e vê o estado certo de cada
 * profissional (livre / ocupado / ausente / não declarou), a tela é da
 * logística (o comercial não a alcança), e o menu só a oferece a quem aloca.
 *
 *   npm run fumaca:disponibilidade
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3003";
const EXECUTAVEL = process.env.CHROMIUM_PATH;
const SENHA = "hemoderi123";
const PACIENTE = "Paciente Disponibilidade";

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

// Amanhã, no fuso da operação, como dia truncado em UTC — o mesmo formato de
// Pedido.data e de Disponibilidade (via diaSemana).
const [ano, mes, dia] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
  .format(new Date(Date.now() + 86400000))
  .split("-")
  .map(Number);
const amanha = new Date(Date.UTC(ano, mes - 1, dia));
const diaSemana = amanha.getUTCDay();

const limpar = async () => {
  await prisma.pedido.deleteMany({ where: { pacienteNome: PACIENTE } });
  await prisma.disponibilidade.deleteMany({ where: { profissional: { nome: "Ana (comercial)" } } });
};

try {
  // O profissional ligado à conta ana@exemplo.com.br é a cobaia da grade.
  const profissional = await prisma.profissional.findFirst({
    where: { ativo: true, usuarios: { some: { email: "ana@exemplo.com.br" } } },
    select: { id: true, nome: true },
  });
  const clinica = await prisma.clinica.findFirst({ where: { ativa: true }, select: { id: true } });
  const servico = await prisma.servico.findFirst({ where: { ativo: true }, select: { id: true, duracaoMin: true } });

  await limpar();

  // Declara a manhã de amanhã (livre) e deixa a tarde sem declaração...
  await prisma.disponibilidade.create({
    data: { profissionalId: profissional.id, diaSemana, horaInicio: "08:00", horaFim: "12:00" },
  });
  // ...e também a tarde, mas com um atendimento ocupando (fica "ocupado").
  await prisma.disponibilidade.create({
    data: { profissionalId: profissional.id, diaSemana, horaInicio: "13:00", horaFim: "18:00" },
  });
  await prisma.pedido.create({
    data: {
      numero: 970000 + (Date.now() % 20000),
      clinicaId: clinica.id,
      servicoId: servico.id,
      profissionalId: profissional.id,
      data: amanha,
      horaInicio: "14:00",
      duracaoMin: servico.duracaoMin,
      status: "ALOCADO",
      pacienteNome: PACIENTE,
      valorServicoCentavos: 10_000,
      valorRepasseCentavos: 6_000,
    },
  });

  // ── A logística abre a grade ─────────────────────────────────────────────
  await entrar(p, "logistica@hemoderi.com.br");
  await p.goto(`${BASE}/painel/disponibilidade`);
  await p.waitForTimeout(1800);
  const corpo = await p.innerText("body");
  ok("a grade de disponibilidade abre", corpo.includes("Disponibilidade da equipe"), corpo.slice(0, 200));
  ok("a legenda explica os estados", corpo.includes("Livre") && corpo.includes("Ausente"));

  const linha = p.locator("tr").filter({ hasText: profissional.nome }).last();
  const marcasAmanha = await linha.locator('span[title]').allInnerTexts();
  const titulos = await linha.locator('span[title]').evaluateAll((els) => els.map((e) => e.getAttribute("title")));
  ok(
    "a manhã declarada aparece como livre",
    titulos.some((t) => t?.startsWith("Livre")),
    JSON.stringify(titulos)
  );
  ok(
    "a tarde com atendimento aparece como ocupada",
    titulos.some((t) => t?.startsWith("Ocupado")),
    JSON.stringify(marcasAmanha)
  );

  // ── A tela é da logística: o comercial não a alcança ─────────────────────
  await entrar(p, "comercial@hemoderi.com.br");
  await p.goto(`${BASE}/painel/disponibilidade`);
  await p.waitForTimeout(1800);
  ok(
    "o comercial é redirecionado para fora da grade",
    !p.url().includes("/disponibilidade"),
    p.url()
  );
  ok(
    "o menu do comercial não oferece Disponibilidade",
    (await p.locator('a[href="/painel/disponibilidade"]').count()) === 0
  );

  // ── O menu da logística oferece ──────────────────────────────────────────
  await entrar(p, "logistica@hemoderi.com.br");
  await p.goto(`${BASE}/painel`);
  await p.waitForTimeout(1500);
  ok(
    "o menu da logística oferece Disponibilidade",
    (await p.locator('a[href="/painel/disponibilidade"]').count()) > 0
  );
} finally {
  await nav.close();
  await limpar();
  await prisma.$disconnect();
}

console.log(`\n${passou}/${passou + falhou} OK`);
process.exit(falhou > 0 ? 1 : 0);
