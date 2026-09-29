/**
 * Teste de fumaça da esteira separada por setor (ata de 28/09).
 *
 * O que prova: cada perfil abre na PRÓPRIA fila (Ana na triagem, Joyce na
 * alocação, Stephanie na conferência, o responsável no que está parado), as
 * outras etapas continuam alcançáveis por todos, e a confirmação — que era
 * livre para qualquer conta interna — passou a ser da triagem.
 *
 *   npm run fumaca:esteiras
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3003";
const EXECUTAVEL = process.env.CHROMIUM_PATH;
const SENHA = "hemoderi123";

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

/** Em qual etapa a esteira abriu — o chip selecionado é o de fundo bordô. */
async function etapaAberta(page) {
  await page.goto(`${BASE}/painel/pedidos`);
  await page.waitForTimeout(1500);
  return (await page.locator("a.bg-bordo.text-white.rounded-full").first().innerText()).trim();
}

const prisma = new PrismaClient();
const nav = await chromium.launch(EXECUTAVEL ? { executablePath: EXECUTAVEL } : {});
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => ok(`erro de JS: ${e.message}`, false));

try {
  // Um pedido em cada ponta da esteira, para as filas não estarem vazias.
  const clinica = await prisma.clinica.findFirst({ where: { ativa: true }, select: { id: true } });
  const servico = await prisma.servico.findFirst({ where: { ativo: true }, select: { id: true, duracaoMin: true } });
  const carimbo = Date.now();
  const solicitado = await prisma.pedido.create({
    data: {
      numero: 900000 + (carimbo % 90000),
      clinicaId: clinica.id,
      servicoId: servico.id,
      data: new Date(Date.now() + 7 * 86400000),
      horaInicio: "09:00",
      duracaoMin: servico.duracaoMin,
      status: "SOLICITADO",
      doutorNome: "Dra. Esteira",
      valorServicoCentavos: 10_000,
    },
    select: { id: true },
  });

  // ── Cada setor abre na própria fila ──────────────────────────────────────
  await entrar(p, "comercial@hemoderi.com.br");
  ok("comercial abre na triagem", (await etapaAberta(p)).startsWith("Para confirmar"), await etapaAberta(p));

  await entrar(p, "logistica@hemoderi.com.br");
  ok("logística abre na fila de alocar", (await etapaAberta(p)).startsWith("Para alocar"), await etapaAberta(p));

  await entrar(p, "posvenda@hemoderi.com.br");
  ok("pós-venda abre na conferência", (await etapaAberta(p)).startsWith("Para conferir"), await etapaAberta(p));

  await entrar(p, "equipe@hemoderi.com.br");
  ok("responsável abre no que está parado", (await etapaAberta(p)).startsWith("Parados"), await etapaAberta(p));

  // ── As outras etapas continuam alcançáveis ───────────────────────────────
  await entrar(p, "logistica@hemoderi.com.br");
  await p.goto(`${BASE}/painel/pedidos?filtro=triagem`);
  await p.waitForTimeout(1500);
  const naTriagem = await p.innerText("body");
  ok("logística alcança a triagem quando precisa", naTriagem.includes("Para confirmar"));
  ok(
    "a etapa da pessoa é sinalizada como a fila dela",
    (await p.goto(`${BASE}/painel/pedidos?filtro=alocar`)) &&
      (await p.waitForTimeout(1200), (await p.innerText("body")).includes("esta é a sua fila"))
  );

  // A contagem por fila aparece no chip.
  ok("o chip mostra o tamanho da fila", /Para confirmar\s*·\s*\d+/.test(await p.innerText("body")), naTriagem.slice(0, 200));

  // ── A triagem virou trabalho do comercial ────────────────────────────────
  await p.goto(`${BASE}/painel/pedidos?filtro=triagem`);
  await p.waitForTimeout(1500);
  const cartao = p.locator("div.rounded-2xl").filter({ hasText: "Dra. Esteira" }).last();
  await cartao.locator('button:has-text("Confirmar")').first().click();
  await p.waitForTimeout(2500);
  ok(
    "logística não confirma agendamento — é da triagem",
    (await p.innerText("body")).includes("A triagem é do comercial"),
    (await p.innerText("body")).slice(0, 300)
  );

  const depoisDaLogistica = await prisma.pedido.findUnique({
    where: { id: solicitado.id },
    select: { status: true },
  });
  ok("o pedido continua solicitado depois da recusa", depoisDaLogistica.status === "SOLICITADO");

  await entrar(p, "comercial@hemoderi.com.br");
  await p.goto(`${BASE}/painel/pedidos?filtro=triagem`);
  await p.waitForTimeout(1500);
  const cartaoComercial = p.locator("div.rounded-2xl").filter({ hasText: "Dra. Esteira" }).last();
  await cartaoComercial.locator('button:has-text("Confirmar")').first().click();
  await p.waitForTimeout(3000);
  const depoisDoComercial = await prisma.pedido.findUnique({
    where: { id: solicitado.id },
    select: { status: true },
  });
  ok("o comercial confirma e o pedido passa para a logística", depoisDoComercial.status === "CONFIRMADO", depoisDoComercial.status);

  // ── Cancelamento é só de Ana, André e Naiara (ata de 28/09) ──────────────
  // O pedido está CONFIRMADO (não-terminal), então o botão de cancelar existe
  // para quem pode. O comercial (Ana) já está logado nesta tela.
  await p.goto(`${BASE}/painel/pedidos?filtro=todos`);
  await p.waitForTimeout(1500);
  ok(
    "o comercial vê o botão de cancelar",
    (await p.locator('button:has-text("Cancelar")').count()) > 0
  );

  await entrar(p, "posvenda@hemoderi.com.br");
  await p.goto(`${BASE}/painel/pedidos?filtro=todos`);
  await p.waitForTimeout(1500);
  ok(
    "o pós-venda não vê o botão de cancelar",
    (await p.locator('button:has-text("Cancelar")').count()) === 0
  );

  await entrar(p, "equipe@hemoderi.com.br");
  await p.goto(`${BASE}/painel/pedidos?filtro=todos`);
  await p.waitForTimeout(1500);
  ok(
    "o responsável (André, Naiara) vê o botão de cancelar",
    (await p.locator('button:has-text("Cancelar")').count()) > 0
  );
} finally {
  await nav.close();
  await prisma.pedido.deleteMany({ where: { doutorNome: "Dra. Esteira" } });
  await prisma.$disconnect();
}

console.log(`\n${passou}/${passou + falhou} OK`);
process.exit(falhou > 0 ? 1 : 0);
