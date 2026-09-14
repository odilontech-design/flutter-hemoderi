/**
 * Teste de fumaça da avaliação, no navegador.
 *
 * Cobre o ciclo que a clínica percorre: o atendimento realizado cai na fila de
 * avaliação, as estrelas gravam a nota, o histórico passa a mostrá-la, a
 * clínica corrige o que errou, e a equipe enxerga a nota e o comentário no
 * painel. Verifica também o escopo — clínica não avalia pedido de outra — e o
 * alvo de toque da estrela no celular, que é onde a nota errada nasce.
 *
 *   npm run fumaca:avaliacao
 *   BASE_URL=https://... npm run fumaca:avaliacao
 *
 * É re-executável de propósito: parte tanto de um atendimento ainda sem nota
 * (usa a fila de pendentes) quanto de um já avaliado (usa "Alterar"). Um teste
 * que só passa na primeira execução é um teste que ninguém roda duas vezes.
 *
 * ATENÇÃO: grava avaliação de verdade no atendimento realizado da clínica de
 * exemplo. É para ambiente de teste ou homologação.
 */

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3003";
// Usado quando o Chromium não está no caminho padrão do Playwright.
const EXECUTAVEL = process.env.CHROMIUM_PATH;
const CLINICA = process.env.EMAIL_CLINICA ?? "clinica-santa-rita@exemplo.com.br";
const OUTRA_CLINICA = process.env.EMAIL_OUTRA_CLINICA ?? "instituto-vida-plena@exemplo.com.br";
const EQUIPE = process.env.EMAIL_EQUIPE ?? "equipe@hemoderi.com.br";
const SENHA = process.env.SENHA_PADRAO ?? "hemoderi123";
const COMENTARIO = `Profissional pontual (fumaça ${new Date().toISOString().slice(11, 19)}).`;

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

/**
 * Abre um formulário de avaliação, venha de onde vier.
 *
 * Ancorar no formulário (e não na linha da tabela) é o que mantém o teste
 * estável: o seletor do Playwright é vivo, e ao abrir o formulário a linha
 * deixa de conter o botão que a identificava.
 */
async function abrirFormulario(pagina) {
  const pendente = pagina.locator("form", { has: pagina.locator('button:has-text("Enviar avaliação")') });
  if (await pendente.count()) return pendente.first();

  await pagina.locator('button:has-text("Alterar")').first().click();
  await pagina.waitForTimeout(800);
  return pagina.locator("form", { has: pagina.locator('button:has-text("Salvar alteração")') }).first();
}

async function avaliar(pagina, nota, comentario) {
  const formulario = await abrirFormulario(pagina);
  await formulario.locator(`button[aria-label^="${nota} de 5"]`).click();
  if (comentario !== undefined) await formulario.locator("textarea").fill(comentario);
  await formulario.locator('button[type="submit"]').click();
  await pagina.waitForTimeout(3000);
}

function mediaNoPainel(pagina) {
  return pagina.locator("div.rounded-2xl", { hasText: "Média que você deu" }).first().innerText();
}

const navegador = await chromium.launch(EXECUTAVEL ? { executablePath: EXECUTAVEL } : {});
const contexto = await navegador.newContext({ viewport: { width: 1280, height: 950 } });
const pagina = await contexto.newPage();
pagina.on("pageerror", (erro) => ok(`erro de JS: ${erro.message}`, false));

try {
  // ── 1. A clínica avalia ───────────────────────────────────────────────────
  await entrar(pagina, CLINICA);
  const temOndeAvaliar =
    (await pagina.locator('button:has-text("Enviar avaliação")').count()) > 0 ||
    (await pagina.locator('button:has-text("Alterar")').count()) > 0;
  ok("existe atendimento realizado para avaliar", temOndeAvaliar);
  if (!temOndeAvaliar) throw new Error("sem atendimento REALIZADO na clínica de exemplo — rode o seed");

  await avaliar(pagina, 4, COMENTARIO);
  // Recarrega antes de conferir o histórico: com o formulário aberto as
  // estrelas são cinco botões separados, e o que se quer ver aqui é o
  // desenho da nota já gravada, na linha fechada.
  await pagina.reload();
  await pagina.waitForTimeout(1200);
  ok("nota 4 gravada e visível no histórico", (await pagina.innerText("body")).includes("★★★★"));
  ok("média da clínica vira 4,0", (await mediaNoPainel(pagina)).includes("4,0"), await mediaNoPainel(pagina));
  ok("fila de pendentes esvazia", (await pagina.locator("text=Como foi o atendimento?").count()) === 0);

  // ── 2. A equipe enxerga a nota e o comentário ─────────────────────────────
  await contexto.clearCookies();
  await entrar(pagina, EQUIPE);
  const painel = await pagina.innerText("body");
  ok("painel mostra o comentário da clínica", painel.includes(COMENTARIO.slice(0, 22)));
  ok("painel mostra a média geral", painel.includes("Média geral"));

  await pagina.goto(`${BASE}/painel/profissionais`);
  await pagina.waitForTimeout(1000);
  ok("lista de profissionais mostra a nota", (await pagina.innerText("body")).includes("4,0"));

  // ── 3. A clínica corrige o que errou ──────────────────────────────────────
  await contexto.clearCookies();
  await entrar(pagina, CLINICA);
  await avaliar(pagina, 2);
  ok("clínica corrige a própria nota", (await mediaNoPainel(pagina)).includes("2,0"), await mediaNoPainel(pagina));

  // ── 4. Escopo: pedido da clínica é só dela ────────────────────────────────
  await contexto.clearCookies();
  await entrar(pagina, OUTRA_CLINICA);
  ok(
    "outra clínica não vê o atendimento alheio",
    !(await pagina.innerText("body")).includes(COMENTARIO.slice(0, 22))
  );

  // ── 5. Celular: a estrela precisa ser clicável com o dedo ─────────────────
  const celular = await navegador.newContext({ viewport: { width: 390, height: 800 } });
  const pc = await celular.newPage();
  await entrar(pc, CLINICA);
  const largura = await pc.evaluate(() => document.documentElement.scrollWidth);
  ok("portal não estoura a largura no celular", largura <= 390, `scrollWidth=${largura}`);

  const formulario = await abrirFormulario(pc);
  const alvo = await formulario.locator('button[aria-label^="5 de 5"]').boundingBox();
  ok("estrela tem alvo de toque de 40px", alvo !== null && alvo.height >= 40, JSON.stringify(alvo));

  // As estrelas não podem se mexer sozinhas: o rótulo muda a cada hover, e se
  // isso re-largar o container elas oscilam e ficam impossíveis de acertar.
  const antes = await formulario.locator('button[aria-label^="3 de 5"]').boundingBox();
  await formulario.locator('button[aria-label^="1 de 5"]').hover();
  await pc.waitForTimeout(400);
  const depois = await formulario.locator('button[aria-label^="3 de 5"]').boundingBox();
  ok("estrela não se desloca com o hover", antes.x === depois.x, `${antes.x} → ${depois.x}`);
  await celular.close();
} catch (erro) {
  falhas++;
  console.log(`FALHA ${erro instanceof Error ? erro.message : String(erro)}`);
}

console.log(`\n${passos - falhas}/${passos} OK`);
await navegador.close();
process.exit(falhas ? 1 : 0);
