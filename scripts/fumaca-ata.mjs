/**
 * Teste de fumaça das decisões da reunião de 14/09, no navegador.
 *
 * Cada verificação aqui corresponde a uma linha da ata: os quatro
 * indicadores do painel, a produtividade sem valor gerado, o código do
 * agendamento, a condição de pagamento na esteira, CEP e documento
 * conferidos, importação em lote, o portal sem escolha de profissional, a
 * urgência que vai para o WhatsApp e a disponibilidade por turno.
 *
 *   npm run fumaca:ata
 *   BASE_URL=https://... npm run fumaca:ata
 *
 * Precisa de pelo menos um agendamento na esteira — com a tela vazia, metade
 * destas verificações passa sem provar nada (foi assim que um erro de
 * runtime na esteira passou despercebido enquanto não havia pedido algum).
 *
 * ATENÇÃO: importa profissionais de verdade (e-mail com carimbo de tempo) e
 * grava condição de pagamento. É para ambiente de teste ou homologação.
 */

import { chromium } from "playwright";
const BASE = process.env.BASE_URL ?? "http://localhost:3003";
// Usado quando o Chromium não está no caminho padrão do Playwright.
const EXECUTAVEL = process.env.CHROMIUM_PATH;
let n = 0, f = 0;
function ok(nome, cond, extra = "") { n++; if (cond) console.log(`  ok  ${nome}`); else { f++; console.log(`FALHA ${nome} ${extra}`); } }

async function entrar(p, email, senha = "hemoderi123") {
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="senha"]', senha);
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/(painel|portal|profissional)/, { timeout: 20000 });
  await p.waitForTimeout(1200);
}

const nav = await chromium.launch(EXECUTAVEL ? { executablePath: EXECUTAVEL } : {});
const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => ok(`erro de JS: ${e.message.slice(0, 120)}`, false));

// ── Painel da equipe ────────────────────────────────────────────────────────
await entrar(p, "equipe@hemoderi.com.br");
const painel = await p.innerText("body");
ok("KPI de faturamento do mês", painel.includes("Faturamento do mês"));
ok("KPI de a receber", painel.includes("A receber"));
ok("KPI de agendados", painel.includes("Agendados"));
ok("não mostra mais o a pagar a profissionais", !painel.includes("A pagar a profissionais"));
ok("produtividade sem participação percentual", !painel.includes("Participação"));
ok("produtividade mostra o que foi executado", painel.includes("O que executou"));
ok("botão flutuante de WhatsApp", (await p.locator('a[aria-label*="WhatsApp"]').count()) > 0);

// ── Esteira ─────────────────────────────────────────────────────────────────
await p.goto(`${BASE}/painel/pedidos`);
await p.waitForTimeout(1200);
const esteira = await p.innerText("body");
ok("menu e título falam agendamento", esteira.includes("Esteira de agendamentos"));
ok("código do pedido no padrão ano-sequencial-clínica", /\d{4}-\d{4,}-[A-Z]/.test(esteira), esteira.slice(0, 200));
ok("condição de pagamento na linha", (await p.locator('select[aria-label="Condição de pagamento"]').count()) > 0);

// grava uma condição de pagamento
const seletor = p.locator('select[aria-label="Condição de pagamento"]').first();
if (await seletor.count()) {
  await seletor.selectOption("Faturado no mês");
  await p.waitForTimeout(2500);
  await p.reload();
  await p.waitForTimeout(1200);
  const v = await p.locator('select[aria-label="Condição de pagamento"]').first().inputValue();
  ok("condição de pagamento persiste", v === "Faturado no mês", v);
}

// ── Cadastro de clínica: CEP e CNPJ ─────────────────────────────────────────
await p.goto(`${BASE}/painel/clinicas`);
await p.waitForTimeout(1200);
ok("campo de CEP obrigatório", (await p.locator('input[name="cep"]').count()) > 0);
ok("número do endereço começa bloqueado", await p.locator('input[name="numero"]').isDisabled());
await p.fill('input[name="cnpj"]', "11222333000199");
await p.locator('input[name="cnpj"]').blur();
await p.waitForTimeout(400);
ok("CNPJ inválido é sinalizado", (await p.innerText("body")).includes("não confere"));
await p.fill('input[name="cnpj"]', "11222333000181");
await p.locator('input[name="cnpj"]').blur();
await p.waitForTimeout(400);
ok("CNPJ válido não é sinalizado", !(await p.innerText("body")).includes("não confere"));
ok("CNPJ ganha máscara", (await p.locator('input[name="cnpj"]').inputValue()) === "11.222.333/0001-81");

// ── Importação em lote ──────────────────────────────────────────────────────
await p.goto(`${BASE}/painel/profissionais`);
await p.waitForTimeout(1200);
ok("botão de importar planilha", (await p.locator('button:has-text("Importar planilha")').count()) > 0);
await p.locator('button:has-text("Importar planilha")').click();
await p.waitForTimeout(500);
const carimbo = Date.now();
await p.fill('textarea[name="planilha"]', `Nome\tSobrenome\tE-mail\nMARIA\tDA SILVA\tmaria.${carimbo}@exemplo.com\nJoao\tSouza\tjoao.${carimbo}@exemplo.com\nsem email aqui`);
await p.locator('button:has-text("Importar e gerar acessos")').click();
await p.waitForTimeout(4000);
const depois = await p.innerText("body");
ok("importou os dois válidos", depois.includes("2 profissional(is) importado(s)"), depois.slice(0, 300));
ok("nome em caixa alta virou legível", depois.includes("Maria da Silva"), "");
ok("linha sem e-mail virou problema apontado", depois.includes("sem e-mail"));
ok("senhas provisórias aparecem", (await p.locator(".font-mono").count()) >= 2);

// ── Portal da clínica ───────────────────────────────────────────────────────
await ctx.clearCookies();
await entrar(p, "clinica-santa-rita@exemplo.com.br");
await p.goto(`${BASE}/portal/agendar`);
await p.waitForTimeout(1500);
ok("seleção de profissional está oculta", (await p.locator('select[name="profissionalId"]').count()) === 0);
ok("campo do doutor é obrigatório", (await p.locator('input[name="doutorNome"][required]').count()) > 0);

// urgência: data de hoje dispara a saída pelo WhatsApp
// "Hoje" tem de ser o hoje de São Paulo, não o de UTC. Depois das 21h em BRT
// o dia UTC já virou, e a tela — que só avisa quando até o ÚLTIMO horário do
// dia cai dentro da antecedência — corretamente não mostra urgência para o
// dia seguinte. O teste passaria de manhã e falharia de madrugada, que é a
// pior espécie de teste instável: o que acusa o app por causa do relógio.
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
await p.fill('input[name="data"]', hoje);
await p.waitForTimeout(800);
const comUrgencia = await p.innerText("body");
ok("data urgente avisa e oferece o WhatsApp", comUrgencia.includes("Falar com a central no WhatsApp"), comUrgencia.slice(0, 200));

// ── Portal do profissional ──────────────────────────────────────────────────
await ctx.clearCookies();
await entrar(p, "ana@exemplo.com.br");
await p.goto(`${BASE}/profissional/disponibilidade`);
await p.waitForTimeout(1200);
ok("disponibilidade por turno", (await p.locator('select[name="turno"]').count()) > 0);
// Escopado ao cartão da semana: o cartão de AUSÊNCIAS legitimamente pede
// hora, e contar a página inteira media a coisa errada.
const cartaoSemana = p.locator("div", { has: p.locator('select[name="turno"]') }).last();
ok("o cartão da semana não pede mais hora digitada",
   (await cartaoSemana.locator('input[type="time"]').count()) === 0);
const turnos = await p.locator('select[name="turno"]').innerText();
ok("oferece dia inteiro", turnos.includes("Dia inteiro"), turnos);

await p.goto(`${BASE}/profissional`);
await p.waitForTimeout(1200);
const prof = await p.innerText("body");
ok("portal explica quando a clínica aparece", prof.includes("aparece") && prof.includes("antes do atendimento"), prof.slice(0, 200));

const mob = await nav.newContext({ viewport: { width: 390, height: 800 } });
const pm = await mob.newPage();
await entrar(pm, "equipe@hemoderi.com.br");
const largura = await pm.evaluate(() => document.documentElement.scrollWidth);
ok("painel não estoura a largura no celular", largura <= 390, `scrollWidth=${largura}`);
await mob.close();

console.log(`\n${n - f}/${n} OK`);
await nav.close();
process.exit(f ? 1 : 0);
