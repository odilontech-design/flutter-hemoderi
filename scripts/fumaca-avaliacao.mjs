/**
 * Teste de fumaça da avaliação, no navegador.
 *
 * Cobre o ciclo que a clínica percorre: o atendimento realizado cai na fila de
 * avaliação, as estrelas gravam a nota, o histórico passa a mostrá-la, e a
 * equipe enxerga a nota e o comentário no painel. Verifica também a
 * imutabilidade (ata de 21/09 — "os clientes não devem ter a capacidade de
 * alterar avaliações enviadas"), o escopo — clínica não avalia pedido de
 * outra — e o alvo de toque da estrela no celular, que é onde a nota errada
 * nasce.
 *
 *   npm run fumaca:avaliacao
 *   BASE_URL=https://... npm run fumaca:avaliacao
 *
 * ATENÇÃO: cria duas clínicas, um profissional e um atendimento realizado de
 * teste, e apaga tudo no fim. É para ambiente de teste ou homologação.
 */

import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3003";
// Usado quando o Chromium não está no caminho padrão do Playwright.
const EXECUTAVEL = process.env.CHROMIUM_PATH;
const SENHA = process.env.SENHA_PADRAO ?? "hemoderi123";
const EQUIPE = process.env.EMAIL_EQUIPE ?? "equipe@hemoderi.com.br";
const COMENTARIO = `Profissional pontual (fumaça ${new Date().toISOString().slice(11, 19)}).`;
const NUMERO_TESTE = 990600;

const prisma = new PrismaClient();
let passos = 0;
let falhas = 0;
function ok(nome, condicao, extra = "") {
  passos++;
  if (condicao) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.log(`FALHA ${nome} ${extra}`);
  }
}

async function entrar(pagina, email) {
  await pagina.goto(`${BASE}/login`);
  await pagina.fill('input[name="email"]', email);
  await pagina.fill('input[name="senha"]', SENHA);
  await pagina.click('button[type="submit"]');
  await pagina.waitForURL(/\/(painel|portal|profissional)/, { timeout: 20000 });
  await pagina.waitForTimeout(1500);
  return pagina.url();
}

async function limpar() {
  const pedido = await prisma.pedido.findFirst({ where: { numero: NUMERO_TESTE } });
  if (pedido) {
    await prisma.avaliacao.deleteMany({ where: { pedidoId: pedido.id } });
    await prisma.pedido.delete({ where: { id: pedido.id } });
  }
  await prisma.usuario.deleteMany({ where: { email: { in: ["fumaca.avaliacao.a@exemplo.com.br", "fumaca.avaliacao.b@exemplo.com.br"] } } });
  await prisma.clinica.deleteMany({ where: { slug: { in: ["fumaca-avaliacao-a", "fumaca-avaliacao-b"] } } });
  await prisma.profissional.deleteMany({ where: { email: "fumaca.avaliacao.prof@exemplo.com.br" } });
}

async function montarCenario() {
  await limpar();
  const bcrypt = (await import("bcryptjs")).default;
  const senhaHash = await bcrypt.hash(SENHA, 10);

  const servico = await prisma.servico.findFirst({ where: { ativo: true } });
  if (!servico) throw new Error("Catálogo vazio — rode `npm run db:seed` antes.");

  const clinicaA = await prisma.clinica.create({
    data: { nome: "Clínica da Fumaça A", slug: "fumaca-avaliacao-a", telefone: "5511900000001" },
  });
  const clinicaB = await prisma.clinica.create({
    data: { nome: "Clínica da Fumaça B", slug: "fumaca-avaliacao-b", telefone: "5511900000002" },
  });
  await prisma.usuario.createMany({
    data: [
      { nome: "Recepção A", email: "fumaca.avaliacao.a@exemplo.com.br", senhaHash, papel: "CLINICA", clinicaId: clinicaA.id },
      { nome: "Recepção B", email: "fumaca.avaliacao.b@exemplo.com.br", senhaHash, papel: "CLINICA", clinicaId: clinicaB.id },
    ],
  });
  const profissional = await prisma.profissional.create({
    data: { nome: "Profissional da Fumaça", email: "fumaca.avaliacao.prof@exemplo.com.br", chavePix: "fumaca.avaliacao.prof@exemplo.com.br" },
  });
  const pedido = await prisma.pedido.create({
    data: {
      numero: NUMERO_TESTE,
      clinicaId: clinicaA.id,
      servicoId: servico.id,
      profissionalId: profissional.id,
      data: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
      horaInicio: "10:00",
      duracaoMin: servico.duracaoMin,
      status: "REALIZADO",
      valorServicoCentavos: servico.valorPadraoCentavos,
    },
  });
  return { clinicaA, clinicaB, pedido };
}

function mediaNoPainel(pagina) {
  return pagina.locator("div.rounded-2xl", { hasText: "Média que você deu" }).first().innerText();
}

const navegador = await chromium.launch(EXECUTAVEL ? { executablePath: EXECUTAVEL } : {});

try {
  await montarCenario();

  // ── 1. Celular: a estrela precisa ser clicável com o dedo ─────────────────
  // Antes de avaliar, porque depois disso o formulário some (avaliação
  // definitiva) e não haveria mais estrela para medir.
  const celular = await navegador.newContext({ viewport: { width: 390, height: 800 } });
  const pc = await celular.newPage();
  await entrar(pc, "fumaca.avaliacao.a@exemplo.com.br");
  const largura = await pc.evaluate(() => document.documentElement.scrollWidth);
  ok("portal não estoura a largura no celular", largura <= 390, `scrollWidth=${largura}`);

  const formularioMobile = pc.locator("form", { has: pc.locator('button:has-text("Enviar avaliação")') }).first();
  const alvo = await formularioMobile.locator('button[aria-label^="5 de 5"]').boundingBox();
  ok("estrela tem alvo de toque de 40px", alvo !== null && alvo.height >= 40, JSON.stringify(alvo));

  // As estrelas não podem se mexer sozinhas: o rótulo muda a cada hover, e se
  // isso re-largar o container elas oscilam e ficam impossíveis de acertar.
  const antes = await formularioMobile.locator('button[aria-label^="3 de 5"]').boundingBox();
  await formularioMobile.locator('button[aria-label^="1 de 5"]').hover();
  await pc.waitForTimeout(400);
  const depois = await formularioMobile.locator('button[aria-label^="3 de 5"]').boundingBox();
  ok("estrela não se desloca com o hover", antes.x === depois.x, `${antes.x} → ${depois.x}`);
  await celular.close();

  // ── 2. A clínica avalia ────────────────────────────────────────────────────
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 950 } });
  const pagina = await contexto.newPage();
  pagina.on("pageerror", (erro) => ok(`erro de JS: ${erro.message}`, false));

  await entrar(pagina, "fumaca.avaliacao.a@exemplo.com.br");
  ok("existe atendimento realizado para avaliar", (await pagina.locator('button:has-text("Enviar avaliação")').count()) > 0);

  const formulario = pagina.locator("form", { has: pagina.locator('button:has-text("Enviar avaliação")') }).first();
  await formulario.locator('button[aria-label^="4 de 5"]').click();
  await formulario.locator("textarea").fill(COMENTARIO);
  await formulario.locator('button[type="submit"]').click();
  await pagina.waitForTimeout(3000);

  // Recarrega antes de conferir o histórico: com o formulário aberto as
  // estrelas são cinco botões separados, e o que se quer ver aqui é o
  // desenho da nota já gravada, na linha fechada.
  await pagina.reload();
  await pagina.waitForTimeout(1200);
  ok("nota 4 gravada e visível no histórico", (await pagina.innerText("body")).includes("★★★★"));
  ok("média da clínica vira 4,0", (await mediaNoPainel(pagina)).includes("4,0"), await mediaNoPainel(pagina));
  ok("fila de pendentes esvazia", (await pagina.locator("text=Como foi o atendimento?").count()) === 0);

  // Definitiva (ata de 21/09): nenhum jeito de reabrir o formulário depois de
  // avaliado — nem "Avaliar", nem "Alterar", nem o próprio "Enviar avaliação".
  ok("não sobra nenhum jeito de reenviar a avaliação",
    (await pagina.locator('button:has-text("Avaliar")').count()) === 0 &&
    (await pagina.locator('button:has-text("Alterar")').count()) === 0 &&
    (await pagina.locator('button:has-text("Enviar avaliação")').count()) === 0);

  // ── 3. A equipe enxerga a nota e o comentário ─────────────────────────────
  await contexto.clearCookies();
  await entrar(pagina, EQUIPE);
  const painel = await pagina.innerText("body");
  ok("painel mostra o comentário da clínica", painel.includes(COMENTARIO.slice(0, 22)));
  ok("painel mostra a média geral", painel.includes("Média geral"));

  await pagina.goto(`${BASE}/painel/profissionais`);
  await pagina.waitForTimeout(1000);
  ok("lista de profissionais mostra a nota", (await pagina.innerText("body")).includes("4,0"));

  // ── 4. Escopo: pedido da clínica é só dela ────────────────────────────────
  await contexto.clearCookies();
  await entrar(pagina, "fumaca.avaliacao.b@exemplo.com.br");
  ok(
    "outra clínica não vê o atendimento alheio",
    !(await pagina.innerText("body")).includes(COMENTARIO.slice(0, 22))
  );
} catch (erro) {
  falhas++;
  console.log(`FALHA ${erro instanceof Error ? erro.message : String(erro)}`);
} finally {
  await limpar();
  await navegador.close();
  await prisma.$disconnect();
}

console.log(`\n${passos - falhas}/${passos} OK`);
process.exit(falhas ? 1 : 0);
