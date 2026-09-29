/**
 * Teste de fumaça da tela de integração PipeDrive (ata de 28/09).
 *
 * O que prova: uma sincronização falha vira pendência visível na tela do
 * responsável; reprocessar sem as chaves configuradas mantém a pendência com
 * um motivo claro (não some em silêncio); um sucesso posterior tira a
 * pendência da lista; e a tela é restrita ao responsável.
 *
 *   npm run fumaca:integracoes
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3003";
const EXECUTAVEL = process.env.CHROMIUM_PATH;
const SENHA = "hemoderi123";
const PACIENTE = "Paciente Integracao";

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

const limpar = async () => {
  const pedidos = await prisma.pedido.findMany({ where: { pacienteNome: PACIENTE }, select: { id: true } });
  const ids = pedidos.map((x) => x.id);
  if (ids.length) await prisma.sincronizacaoExterna.deleteMany({ where: { entidadeId: { in: ids } } });
  await prisma.pedido.deleteMany({ where: { pacienteNome: PACIENTE } });
};

try {
  await limpar();

  const clinica = await prisma.clinica.findFirst({ where: { ativa: true }, select: { id: true } });
  const servico = await prisma.servico.findFirst({ where: { ativo: true }, select: { id: true, duracaoMin: true } });

  const pedido = await prisma.pedido.create({
    data: {
      numero: 993000 + (Date.now() % 6000),
      clinicaId: clinica.id,
      servicoId: servico.id,
      data: new Date(),
      horaInicio: "10:00",
      duracaoMin: servico.duracaoMin,
      status: "CONFIRMADO",
      pacienteNome: PACIENTE,
      valorServicoCentavos: 20_000,
    },
    select: { id: true },
  });
  // Uma tentativa de criar-negócio que falhou (integração não configurada) —
  // é a "falha no registro" que a ata mandou tornar visível.
  await prisma.sincronizacaoExterna.create({
    data: {
      sistema: "PIPEDRIVE",
      entidade: "Pedido",
      entidadeId: pedido.id,
      acao: "criar-negocio",
      sucesso: false,
      erro: "Integração não configurada.",
    },
  });

  // A linha do MEU pedido, localizada pelo link do id — a tela mostra
  // pendências de todos os pedidos, e outros testes deixam as suas.
  const minhaLinha = () =>
    p.locator("tr").filter({ has: p.locator(`a[href="/painel/pedidos/${pedido.id}"]`) });

  // ── A pendência aparece para o responsável ───────────────────────────────
  await entrar(p, "equipe@hemoderi.com.br");
  await p.goto(`${BASE}/painel/integracoes`);
  await p.waitForTimeout(1800);
  const corpo = await p.innerText("body");
  ok("a tela de integração abre", corpo.includes("Integração PipeDrive"), corpo.slice(0, 160));
  ok("a falha do meu pedido aparece como pendência", (await minhaLinha().count()) > 0);
  ok("a pendência mostra o motivo", (await minhaLinha().innerText()).includes("Integração não configurada"));

  // ── Reprocessar sem sincronizar de verdade mantém a pendência ────────────
  await minhaLinha().first().locator('button:has-text("tentar de novo")').click();
  await p.waitForTimeout(3000);
  const tentativas = await prisma.sincronizacaoExterna.count({ where: { entidadeId: pedido.id } });
  ok("reprocessar registra nova tentativa", tentativas >= 2, `tentativas=${tentativas}`);
  await p.reload();
  await p.waitForTimeout(1500);
  ok("a pendência do meu pedido continua na lista", (await minhaLinha().count()) > 0);

  // ── Um sucesso posterior tira a pendência ────────────────────────────────
  await prisma.sincronizacaoExterna.create({
    data: {
      sistema: "PIPEDRIVE",
      entidade: "Pedido",
      entidadeId: pedido.id,
      acao: "criar-negocio",
      sucesso: true,
      referencia: "999",
    },
  });
  await p.reload();
  await p.waitForTimeout(1500);
  ok("sucesso posterior tira a pendência do meu pedido da lista", (await minhaLinha().count()) === 0);

  // ── A tela é do responsável ──────────────────────────────────────────────
  await entrar(p, "logistica@hemoderi.com.br");
  await p.goto(`${BASE}/painel/integracoes`);
  await p.waitForTimeout(1800);
  ok("a logística é barrada da tela de integração", !p.url().includes("/integracoes"), p.url());
  ok(
    "o menu da logística não oferece Integração",
    (await p.locator('a[href="/painel/integracoes"]').count()) === 0
  );
} finally {
  await nav.close();
  await limpar();
  await prisma.$disconnect();
}

console.log(`\n${passou}/${passou + falhou} OK`);
process.exit(falhou > 0 ? 1 : 0);
