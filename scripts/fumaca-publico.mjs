/**
 * Teste de fumaça do agendamento público — a vitrine de quem ainda não é
 * cliente e a triagem que transforma o pedido em agendamento.
 *
 * O caminho medido é o que traz cliente novo: a pessoa cai na raiz do site,
 * escolhe o procedimento pela família, escolhe dia e horário, só então se
 * identifica, e o pedido aparece na fila da equipe para virar agendamento
 * de verdade na esteira.
 *
 *   npm run fumaca:publico
 *   BASE_URL=https://... npm run fumaca:publico
 *
 * ATENÇÃO: cria uma solicitação real e a vincula à primeira clínica da
 * lista. É para ambiente de teste ou homologação.
 */

import { chromium } from "playwright";
const BASE = process.env.BASE_URL ?? "http://localhost:3003";
// Usado quando o Chromium não está no caminho padrão do Playwright.
const EXECUTAVEL = process.env.CHROMIUM_PATH;
let n = 0, f = 0;
function ok(nome, cond, extra = "") { n++; if (cond) console.log(`  ok  ${nome}`); else { f++; console.log(`FALHA ${nome} ${extra}`); } }

const nav = await chromium.launch(EXECUTAVEL ? { executablePath: EXECUTAVEL } : {});
const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => ok(`erro de JS: ${e.message.slice(0, 120)}`, false));

// ── A vitrine, sem login ────────────────────────────────────────────────────
await p.goto(`${BASE}/`);
await p.waitForTimeout(1500);
ok("a raiz leva à vitrine, não ao login", p.url().includes("/agendar"), p.url());
const vitrine = await p.innerText("body");
ok("agrupa por família", vitrine.includes("PRF") && vitrine.includes("Piezo"), vitrine.slice(0, 200));
ok("não pede login para ver o catálogo", !vitrine.toLowerCase().includes("senha"));
ok("oferece entrada para quem já é cliente", vitrine.includes("Já sou cliente"));

// passo 2 só aparece depois de escolher o serviço
ok("o passo do quando começa escondido", !vitrine.includes("2 · Quando"));
await p.locator('button[aria-pressed]:has-text("Membranas")').first().click();
await p.waitForTimeout(900);
ok("escolher o serviço abre o passo do quando", (await p.innerText("body")).includes("2 · Quando"));

// passo 3 só depois de data e horário
ok("o passo de identificação ainda não apareceu", !(await p.innerText("body")).includes("3 · Quem é você"));
// Amanhã no fuso de São Paulo: perto da meia-noite UTC os dois calendários
// discordam, e um teste que só passa em parte do dia mente sobre o app.
const amanha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
  .format(new Date(Date.now() + 86400000));
await p.fill('input[type="date"]', amanha);
await p.waitForTimeout(400);
await p.locator('button[aria-pressed]:has-text("14:00")').first().click();
await p.waitForTimeout(900);
ok("data e horário liberam a identificação", (await p.innerText("body")).includes("3 · Quem é você"));

// envia
const carimbo = Date.now();
await p.fill('input[name="solicitante"]', "Dra. Marina Teste");
await p.fill('input[name="telefone"]', `11 9${String(carimbo).slice(-8)}`);
await p.fill('input[name="clinicaNome"]', `Clínica Teste ${carimbo}`);
await p.fill('input[name="doutorNome"]', "Dra. Marina");
await p.locator('button:has-text("Enviar pedido de agendamento")').click();
await p.waitForTimeout(3500);
ok("o envio confirma sem pedir cadastro", (await p.innerText("body")).includes("Pedido recebido"), (await p.innerText("body")).slice(0, 200));

// mobile
const mob = await nav.newContext({ viewport: { width: 390, height: 800 } });
const pm = await mob.newPage();
await pm.goto(`${BASE}/agendar`);
await pm.waitForTimeout(1500);
const larg = await pm.evaluate(() => document.documentElement.scrollWidth);
ok("a vitrine não estoura a largura no celular", larg <= 390, `scrollWidth=${larg}`);
const alvo = await pm.locator('button[aria-pressed]').first().boundingBox();
ok("cartão de serviço tem alvo de toque confortável", alvo !== null && alvo.height >= 44, JSON.stringify(alvo));
await mob.close();

// ── A triagem, pela equipe ──────────────────────────────────────────────────
await p.goto(`${BASE}/login`);
await p.fill('input[name="email"]', "equipe@hemoderi.com.br");
await p.fill('input[name="senha"]', "hemoderi123");
await p.click('button[type="submit"]');
await p.waitForURL(/\/painel/, { timeout: 20000 });
await p.goto(`${BASE}/painel/solicitacoes`);
await p.waitForTimeout(1500);
const triagem = await p.innerText("body");
ok("o pedido do site chegou na triagem", triagem.includes(`Clínica Teste ${carimbo}`), triagem.slice(0, 300));
ok("mostra o que foi pedido", triagem.includes("Membranas"));
ok("mostra o doutor informado", triagem.includes("Dra. Marina"));

// vincula a uma clínica
await p.locator('select[aria-label="Clínica para vincular"]').first().selectOption({ index: 1 });
await p.locator('button:has-text("Virar agendamento")').first().click();
await p.waitForTimeout(3500);
const depois = await p.innerText("body");
// Escopado ao cartão da FILA: o nome continua aparecendo — e deve — na
// tabela de já tratados, então procurar na página inteira nunca provaria
// que saiu da fila.
const fila = p.locator("div.rounded-2xl", { hasText: "triagem" }).first();
const textoFila = await fila.innerText().catch(() => "");
ok("sai da fila depois de vinculado",
   !textoFila.includes(`Clínica Teste ${carimbo}`) || textoFila.includes("Nada esperando"),
   textoFila.slice(0, 200));
ok("aparece como tratado", depois.includes("virou agendamento"), depois.slice(0, 300));

// e virou agendamento de verdade na esteira
await p.goto(`${BASE}/painel/pedidos?filtro=todos`);
await p.waitForTimeout(1500);
ok("o agendamento existe na esteira", (await p.innerText("body")).includes("Dra. Marina"), "");

console.log(`\n${n - f}/${n} OK`);
await nav.close();
process.exit(f ? 1 : 0);
