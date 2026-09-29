/**
 * Teste de fumaça do aviso de fila (ata de 28/09).
 *
 * O que prova: o aviso aparece para quem tem fila própria quando há trabalho
 * parado nela, some depois de lido (e não volta ao recarregar), leva para a
 * fila certa, e NÃO incomoda quem supervisiona a operação inteira.
 *
 *   npm run fumaca:avisos
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3003";
const EXECUTAVEL = process.env.CHROMIUM_PATH;
const SENHA = "hemoderi123";
const DOUTOR = "Dra. Aviso";

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

try {
  await prisma.pedido.deleteMany({ where: { doutorNome: DOUTOR } });

  // Um pedido confirmado e sem profissional: é a fila da logística.
  const clinica = await prisma.clinica.findFirst({ where: { ativa: true }, select: { id: true } });
  const servico = await prisma.servico.findFirst({
    where: { ativo: true },
    select: { id: true, duracaoMin: true },
  });
  await prisma.pedido.create({
    data: {
      numero: 910000 + (Date.now() % 80000),
      clinicaId: clinica.id,
      servicoId: servico.id,
      data: new Date(Date.now() + 9 * 86400000),
      horaInicio: "11:00",
      duracaoMin: servico.duracaoMin,
      status: "CONFIRMADO",
      doutorNome: DOUTOR,
      valorServicoCentavos: 10_000,
    },
  });

  // ── Quem tem fila própria é avisado ──────────────────────────────────────
  await entrar(p, "logistica@hemoderi.com.br");
  await p.goto(`${BASE}/painel`);
  await p.waitForTimeout(3000);
  const aviso = p.locator('[role="status"]');
  ok("a logística é avisada do que espera alocação", (await aviso.count()) > 0);
  const textoAviso = (await aviso.count()) > 0 ? await aviso.innerText() : "";
  ok("o aviso nomeia a fila", textoAviso.includes("Para alocar"), textoAviso);

  // ── O aviso leva para a fila certa ───────────────────────────────────────
  await aviso.locator('a:has-text("Ver a fila")').click();
  await p.waitForTimeout(2000);
  ok("o aviso leva para a fila de alocação", p.url().includes("filtro=alocar"), p.url());
  ok("o aviso some depois de usado", (await p.locator('[role="status"]').count()) === 0);

  // ── Não volta a incomodar depois de lido ─────────────────────────────────
  await p.goto(`${BASE}/painel`);
  await p.waitForTimeout(3000);
  ok(
    "o mesmo aviso não reaparece ao recarregar",
    (await p.locator('[role="status"]').count()) === 0
  );

  // ── Quem supervisiona não recebe "trabalho seu" ──────────────────────────
  await entrar(p, "equipe@hemoderi.com.br");
  await p.goto(`${BASE}/painel`);
  await p.waitForTimeout(3000);
  ok(
    "responsável não recebe aviso de fila própria",
    (await p.locator('[role="status"]').count()) === 0
  );

  // ── Trabalho novo volta a avisar ─────────────────────────────────────────
  await prisma.pedido.create({
    data: {
      numero: 920000 + (Date.now() % 70000),
      clinicaId: clinica.id,
      servicoId: servico.id,
      data: new Date(Date.now() + 10 * 86400000),
      horaInicio: "15:00",
      duracaoMin: servico.duracaoMin,
      status: "CONFIRMADO",
      doutorNome: DOUTOR,
      valorServicoCentavos: 10_000,
    },
  });
  await entrar(p, "logistica@hemoderi.com.br");
  await p.goto(`${BASE}/painel`);
  await p.waitForTimeout(3000);
  ok(
    "trabalho novo depois do último lido avisa de novo",
    (await p.locator('[role="status"]').count()) > 0
  );
} finally {
  await nav.close();
  await prisma.pedido.deleteMany({ where: { doutorNome: DOUTOR } });
  await prisma.$disconnect();
}

console.log(`\n${passou}/${passou + falhou} OK`);
process.exit(falhou > 0 ? 1 : 0);
