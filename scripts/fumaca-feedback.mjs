/**
 * Teste de fumaça do botão de feedback do pós-venda (ata de 28/09).
 *
 * O que prova: depois que o relatório é aprovado, o pós-venda vê um link de
 * WhatsApp que abre a conversa com a clínica (número certo) e uma mensagem
 * que avisa do relatório e pede avaliação — sem o nome de quem atendeu. E
 * que, sem telefone da clínica, o link não aparece em branco.
 *
 *   npm run fumaca:feedback
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3003";
const EXECUTAVEL = process.env.CHROMIUM_PATH;
const SENHA = "hemoderi123";
const PACIENTE = "Paciente Feedback";
const TELEFONE = "11987650000";

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

try {
  await limpar();

  const clinica = await prisma.clinica.findFirst({ where: { ativa: true }, select: { id: true, nome: true } });
  const servico = await prisma.servico.findFirst({ where: { ativo: true }, select: { id: true, nome: true, duracaoMin: true } });
  const profissional = await prisma.profissional.findFirst({ where: { ativo: true }, select: { id: true } });
  // Garante um telefone conhecido para conferir no link.
  await prisma.clinica.update({ where: { id: clinica.id }, data: { telefone: TELEFONE } });

  // Pedido REALIZADO com relatório JÁ aprovado — é o estado em que o botão de
  // feedback aparece.
  const pedido = await prisma.pedido.create({
    data: {
      numero: 980000 + (Date.now() % 15000),
      clinicaId: clinica.id,
      servicoId: servico.id,
      profissionalId: profissional.id,
      data: new Date(),
      horaInicio: "10:00",
      duracaoMin: servico.duracaoMin,
      status: "REALIZADO",
      pacienteNome: PACIENTE,
      valorServicoCentavos: 20_000,
      valorRepasseCentavos: 12_000,
      relatorio: {
        create: {
          profissionalId: profissional.id,
          compareceu: true,
          aprovadoEm: new Date(),
        },
      },
    },
    select: { id: true },
  });

  // ── O pós-venda vê o botão depois de aprovado ────────────────────────────
  await entrar(p, "posvenda@hemoderi.com.br");
  await p.goto(`${BASE}/painel/pedidos?filtro=fechados`);
  await p.waitForTimeout(1800);

  const cartao = p.locator("div.rounded-2xl").filter({ hasText: PACIENTE }).last();
  const link = cartao.locator('a:has-text("pedir feedback no WhatsApp")');
  ok("o botão de feedback aparece no pedido aprovado", (await link.count()) > 0);

  const href = (await link.count()) > 0 ? await link.getAttribute("href") : "";
  ok("o link vai para o WhatsApp da clínica", href.includes(`wa.me/55${TELEFONE}`), href.slice(0, 80));

  const texto = decodeURIComponent(href.split("text=")[1] ?? "");
  ok("a mensagem avisa do relatório", /relat[óo]rio/i.test(texto), texto.slice(0, 120));
  ok("a mensagem cita o serviço", texto.includes(servico.nome));
  ok("a mensagem não carrega o nome de quem atendeu", !/\bDr[a]?\.?\s|enfermeir/i.test(texto));

  // ── Sem telefone, o link não aparece em branco ───────────────────────────
  await prisma.clinica.update({ where: { id: clinica.id }, data: { telefone: null } });
  await p.reload();
  await p.waitForTimeout(1500);
  const cartaoSemTel = p.locator("div.rounded-2xl").filter({ hasText: PACIENTE }).last();
  ok(
    "sem telefone da clínica, o botão de feedback não aparece",
    (await cartaoSemTel.locator('a:has-text("pedir feedback no WhatsApp")').count()) === 0
  );

  // ── Antes de aprovar, não há o que pedir ─────────────────────────────────
  await prisma.clinica.update({ where: { id: clinica.id }, data: { telefone: TELEFONE } });
  await prisma.relatorioAtendimento.update({ where: { pedidoId: pedido.id }, data: { aprovadoEm: null } });
  await p.reload();
  await p.waitForTimeout(1500);
  const cartaoNaoAprovado = p.locator("div.rounded-2xl").filter({ hasText: PACIENTE }).last();
  ok(
    "relatório não aprovado ainda não oferece feedback",
    (await cartaoNaoAprovado.locator('a:has-text("pedir feedback no WhatsApp")').count()) === 0
  );
} finally {
  await nav.close();
  await limpar();
  await prisma.$disconnect();
}

console.log(`\n${passou}/${passou + falhou} OK`);
process.exit(falhou > 0 ? 1 : 0);
