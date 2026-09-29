/**
 * Teste de fumaça da precificação por praça e do catálogo do portal
 * (ata de 28/09), no navegador.
 *
 * Prova a coisa que só aparece ponta a ponta: a equipe cria uma praça com o
 * estado da clínica, define um preço nela, e a clínica — em outra sessão, em
 * outra tela — passa a ver esse número no catálogo dela.
 *
 *   npm run fumaca:preco
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
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="senha"]', SENHA);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
}

const prisma = new PrismaClient();

/**
 * Praça de teste é estado reservado: enquanto uma existir segurando SP,
 * nenhuma outra pode nascer com SP. Por isso a limpeza roda ANTES também —
 * uma rodada interrompida no meio deixaria a próxima sem como criar a sua, e
 * o teste passaria a falhar por causa do próprio histórico, não do app.
 */
async function limpar() {
  await prisma.regiaoPreco.deleteMany({ where: { nome: { contains: "Teste " } } });
}

await limpar();

const nav = await chromium.launch(EXECUTAVEL ? { executablePath: EXECUTAVEL } : {});
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => ok(`erro de JS: ${e.message}`, false));

try {
  const carimbo = Date.now();
  const NOME_PRACA = `Praça Teste ${carimbo}`;

  // ── A equipe cria a praça e precifica ─────────────────────────────────────
  await entrar(p, "equipe@hemoderi.com.br");
  await p.goto(`${BASE}/painel/catalogo/regioes`);
  await p.waitForTimeout(1200);
  ok("tela de preço por praça abriu", (await p.innerText("body")).includes("Preço por praça"));

  await p.fill('input[name="nome"]', NOME_PRACA);
  // A clínica do seed é de SP — é a UF que faz a praça valer para ela.
  await p.locator('button[aria-pressed]:has-text("SP")').first().click();
  await p.locator('button:has-text("Criar praça")').click();
  await p.waitForTimeout(2500);
  const comPraca = await p.innerText("body");
  ok("praça criada aparece na lista", comPraca.includes(NOME_PRACA), comPraca.slice(0, 200));

  // Sem preço definido, a praça nasce toda "usa a tabela".
  ok("serviço começa usando a tabela", comPraca.includes("usa a tabela"));

  // O cartão da praça recém-criada: o div mais interno que tem ao mesmo tempo
  // o nome dela e os botões de preço. Só o nome casaria com a página inteira;
  // só o botão casaria com qualquer praça já existente no banco.
  const cartaoPraca = p
    .locator("div.rounded-2xl")
    .filter({ hasText: NOME_PRACA })
    .filter({ has: p.locator('button:has-text("usa a tabela")') })
    .last();
  await cartaoPraca.locator('button:has-text("usa a tabela")').first().click();
  await p.waitForTimeout(400);
  await p.locator('input[inputmode="decimal"]').first().fill("1234,56");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(2500);
  ok("preço da praça foi gravado", (await p.innerText("body")).includes("1.234,56"));

  // Uma UF só pode estar em uma praça: a segunda tentativa é recusada.
  await p.fill('input[name="nome"]', `Outra ${carimbo}`);
  await p.locator('button[aria-pressed]:has-text("SP")').first().click();
  await p.locator('button:has-text("Criar praça")').click();
  await p.waitForTimeout(2000);
  ok(
    "UF repetida em outra praça é recusada",
    (await p.innerText("body")).includes("Cada UF pertence a uma praça só"),
    (await p.innerText("body")).slice(0, 200)
  );

  // ── A clínica vê o preço da praça dela ───────────────────────────────────
  await ctx.clearCookies();
  await entrar(p, "clinica-santa-rita@exemplo.com.br");
  await p.goto(`${BASE}/portal/catalogo`);
  await p.waitForTimeout(1500);
  const catalogo = await p.innerText("body");
  ok("catálogo do portal abriu", catalogo.includes("Catálogo"), catalogo.slice(0, 200));
  ok("catálogo agrupa por família", catalogo.includes("PRF"));
  ok(
    "o preço da praça chega na clínica do estado",
    catalogo.includes("1.234,56"),
    catalogo.slice(0, 400)
  );
  ok("catálogo oferece agendar", catalogo.includes("agendar"));

  // O catálogo não é cadastro: a clínica não edita nada por aqui.
  ok(
    "clínica não edita o catálogo",
    (await p.locator('input[inputmode="decimal"]').count()) === 0
  );

} finally {
  await nav.close();
  await limpar();
  await prisma.$disconnect();
}

console.log(`\n${passou}/${passou + falhou} OK`);
process.exit(falhou > 0 ? 1 : 0);
