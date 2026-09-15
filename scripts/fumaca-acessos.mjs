/**
 * Teste de fumaça da gestão de acesso, no navegador.
 *
 * Percorre o ciclo inteiro de uma credencial: a equipe cadastra um
 * profissional, gera o acesso dele, a senha sorteada entra uma única vez e
 * obriga a troca, a senha escolhida passa a valer, a equipe redefine, suspende
 * e devolve. É a verificação que os testes unitários não dão — eles provam o
 * sorteio da senha, este prova que as guardas, a sessão e as telas concordam
 * entre si.
 *
 *   npm run fumaca:acessos
 *   BASE_URL=https://... npm run fumaca:acessos
 *
 * ATENÇÃO: CRIA um profissional e um acesso de verdade (nome e e-mail com
 * carimbo de tempo, para não colidir com execuções anteriores) e os deixa no
 * banco ao final. É para ambiente de teste ou homologação — nunca contra a
 * base de produção da Hemoderi.
 */

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3003";
// Usado quando o Chromium não está no caminho padrão do Playwright.
const EXECUTAVEL = process.env.CHROMIUM_PATH;
const EQUIPE = {
  email: process.env.EMAIL_EQUIPE ?? "equipe@hemoderi.com.br",
  senha: process.env.SENHA_EQUIPE ?? "hemoderi123",
};
// Carimbo de tempo no nome e no e-mail: sem isso, a segunda execução esbarra
// no cadastro que a primeira deixou e o teste passa a testar o lixo anterior.
const NOVO_EMAIL = `teste.acesso.${Date.now()}@exemplo.com.br`;
const NOVO_NOME = `Teste Acesso ${Date.now()}`;

let passos = 0, falhas = 0;
function ok(nome, condicao, extra = "") {
  passos++;
  if (condicao) console.log(`  OK   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome} ${extra}`); }
}

async function entrar(pagina, email, senha) {
  await pagina.goto(`${BASE}/login`);
  await pagina.fill('input[name="email"]', email);
  await pagina.fill('input[name="senha"]', senha);
  await pagina.click('button[type="submit"]');
  // A raiz redireciona no servidor; parar em "/" significa que o redirect
  // ainda está no ar, não que o login falhou.
  for (let i = 0; i < 30; i++) {
    await pagina.waitForTimeout(500);
    const u = new URL(pagina.url()).pathname;
    if (u !== "/" && u !== "/login") break;
    if (u === "/login" && i > 6) break;
  }
  await pagina.waitForLoadState("networkidle").catch(() => {});
  return pagina.url();
}

async function sair(contexto) {
  await contexto.clearCookies();
}

const navegador = await chromium.launch(EXECUTAVEL ? { executablePath: EXECUTAVEL } : {});
const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
const pagina = await contexto.newPage();
pagina.on("dialog", (d) => d.accept());

// 1. equipe entra
let url = await entrar(pagina, EQUIPE.email, EQUIPE.senha);
ok("equipe entra e cai no painel", url.includes("/painel"), url);

// 2. cadastra profissional novo
await pagina.goto(`${BASE}/painel/profissionais`);
const form = pagina.locator('form:has(button:text("Cadastrar profissional"))');
await form.locator('input[name="nome"]').fill(NOVO_NOME);
await form.locator('input[name="email"]').fill(NOVO_EMAIL);
await form.locator('button[type="submit"]').click();
await pagina.waitForTimeout(2000);
const linha = pagina.locator("tr", { hasText: NOVO_NOME }).first();
ok("profissional novo aparece na lista", await linha.count() > 0);
ok("nasce sem acesso", (await linha.innerText()).includes("sem acesso"), await linha.innerText());

// 3. gerar acesso e capturar a senha
await linha.getByRole("button", { name: "Gerar acesso" }).click();
await pagina.waitForSelector("text=Senha provisória", { timeout: 10000 });
const senhaGerada = (await pagina.locator(".font-mono").first().innerText()).trim();
ok("senha gerada no formato ditável", /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(senhaGerada), senhaGerada);
await pagina.getByRole("button", { name: "Fechar" }).click();
await pagina.reload();
const linha2 = pagina.locator("tr", { hasText: NOVO_NOME }).first();
ok("lista passa a mostrar senha provisória", (await linha2.innerText()).includes("senha provisória"), await linha2.innerText());

// 4. o profissional entra com a senha gerada
await sair(contexto);
url = await entrar(pagina, NOVO_EMAIL, senhaGerada);
ok("senha gerada entra e cai em /trocar-senha", url.includes("/trocar-senha"), url);

// 5. não consegue escapar para o portal
await pagina.goto(`${BASE}/profissional`);
await pagina.waitForTimeout(1500);
ok("tentar ir ao portal volta para /trocar-senha", pagina.url().includes("/trocar-senha"), pagina.url());

// 6. senha atual errada é recusada
await pagina.fill('input[name="atual"]', "senha-errada-mesmo");
await pagina.fill('input[name="nova"]', "senha-nova-do-teste");
await pagina.fill('input[name="confirmacao"]', "senha-nova-do-teste");
await pagina.click('button[type="submit"]');
await pagina.waitForTimeout(2000);
ok("senha atual errada é recusada", (await pagina.content()).includes("senha atual não confere"));

// 7. confirmação divergente é recusada
await pagina.fill('input[name="atual"]', senhaGerada);
await pagina.fill('input[name="nova"]', "senha-nova-do-teste");
await pagina.fill('input[name="confirmacao"]', "outra-coisa-qualquer");
await pagina.click('button[type="submit"]');
await pagina.waitForTimeout(2000);
ok("confirmação divergente é recusada", (await pagina.content()).includes("confirmação não confere"));

// 8. troca válida
await pagina.fill('input[name="atual"]', senhaGerada);
await pagina.fill('input[name="nova"]', "senha-nova-do-teste");
await pagina.fill('input[name="confirmacao"]', "senha-nova-do-teste");
await pagina.click('button[type="submit"]');
await pagina.waitForTimeout(3500);
ok("troca válida leva ao portal do profissional", pagina.url().includes("/profissional"), pagina.url());

// 9. a senha gerada morreu
await sair(contexto);
url = await entrar(pagina, NOVO_EMAIL, senhaGerada);
ok("senha gerada não serve mais depois da troca", url.includes("/login"), url);

// 10. a senha escolhida entra direto
url = await entrar(pagina, NOVO_EMAIL, "senha-nova-do-teste");
ok("senha escolhida entra direto no portal", url.includes("/profissional"), url);

// 11. equipe redefine a senha
await sair(contexto);
await entrar(pagina, EQUIPE.email, EQUIPE.senha);
await pagina.goto(`${BASE}/painel/acessos`);
const linhaAcesso = pagina.locator("tr", { hasText: NOVO_EMAIL }).first();
ok("acesso aparece com senha própria", (await linhaAcesso.innerText()).includes("trocada em"), await linhaAcesso.innerText());
await linhaAcesso.getByRole("button", { name: "Redefinir senha" }).click();
await pagina.waitForSelector("text=Senha redefinida", { timeout: 10000 });
const senhaNova = (await pagina.locator(".font-mono").first().innerText()).trim();
ok("redefinição devolve senha nova e diferente", /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(senhaNova) && senhaNova !== senhaGerada, senhaNova);
await pagina.getByRole("button", { name: "Fechar" }).click();

// 12. a senha escolhida pelo dono morreu na redefinição
await sair(contexto);
url = await entrar(pagina, NOVO_EMAIL, "senha-nova-do-teste");
ok("senha antiga para de funcionar após redefinir", url.includes("/login"), url);
url = await entrar(pagina, NOVO_EMAIL, senhaNova);
ok("senha redefinida entra e força troca de novo", url.includes("/trocar-senha"), url);

// 13. suspensão corta na hora — com a aba do profissional aberta
const abaProf = pagina;
await sair(contexto);
await entrar(abaProf, EQUIPE.email, EQUIPE.senha);
await abaProf.goto(`${BASE}/painel/acessos`);
const linhaSuspender = abaProf.locator("tr", { hasText: NOVO_EMAIL }).first();
await linhaSuspender.getByRole("button", { name: "Suspender" }).click();
await abaProf.waitForTimeout(2500);
await abaProf.reload();
const linhaSuspensa = abaProf.locator("tr", { hasText: NOVO_EMAIL }).first();
ok("lista mostra o acesso suspenso", (await linhaSuspensa.innerText()).includes("Suspenso em"), await linhaSuspensa.innerText());

await sair(contexto);
url = await entrar(abaProf, NOVO_EMAIL, senhaNova);
ok("acesso suspenso não entra", url.includes("/login"), url);

// 14. equipe não se suspende sozinha
await entrar(pagina, EQUIPE.email, EQUIPE.senha);
await pagina.goto(`${BASE}/painel/acessos`);
const minhaLinha = pagina.locator("tr", { hasText: EQUIPE.email }).first();
ok("a própria linha não oferece Suspender", await minhaLinha.getByRole("button", { name: "Suspender" }).count() === 0);
ok("a própria linha é marcada como (você)", (await minhaLinha.innerText()).includes("(você)"));

// 15. reativar devolve o acesso
const linhaReativar = pagina.locator("tr", { hasText: NOVO_EMAIL }).first();
await linhaReativar.getByRole("button", { name: "Reativar" }).click();
await pagina.waitForTimeout(2500);
await sair(contexto);
url = await entrar(pagina, NOVO_EMAIL, senhaNova);
ok("reativar devolve o acesso", url.includes("/trocar-senha"), url);

// 16. mobile: a senha cabe na tela de 390px
const mobile = await navegador.newContext({ viewport: { width: 390, height: 780 } });
const pm = await mobile.newPage();
pm.on("dialog", (d) => d.accept());
await entrar(pm, EQUIPE.email, EQUIPE.senha);
await pm.goto(`${BASE}/painel/acessos`);
const larguraCorpo = await pm.evaluate(() => document.documentElement.scrollWidth);
ok("painel de acessos não estoura a largura no celular", larguraCorpo <= 390, `scrollWidth=${larguraCorpo}`);
await mobile.close();

// ── Perfil interno: Atendente vê menos que Responsável ──────────────────────
// Decisão da reunião de 14/09: "as meninas" operam a esteira, mas repasse e
// gestão de acesso são coisa de quem responde pela operação. O seed já traz
// um Atendente pronto (fixture, não criado por este teste) — assim a conta
// existe mesmo que a criação de acesso interno pela tela venha a falhar.
await sair(contexto);
url = await entrar(pagina, "atendente@hemoderi.com.br", "hemoderi123");
ok("atendente entra e cai no painel", url.includes("/painel"), url);

const menuAtendente = await pagina.innerText("body");
ok("menu do atendente não mostra Financeiro", !menuAtendente.includes("Financeiro"));
ok("menu do atendente não mostra Acessos", !/\bAcessos\b/.test(menuAtendente));

await pagina.goto(`${BASE}/painel/financeiro`);
await pagina.waitForTimeout(1200);
ok("atendente é barrado de /painel/financeiro", pagina.url().endsWith("/painel"), pagina.url());

await pagina.goto(`${BASE}/painel/acessos`);
await pagina.waitForTimeout(1200);
ok("atendente é barrado de /painel/acessos", pagina.url().endsWith("/painel"), pagina.url());

// O responsável continua vendo as duas telas e pode alternar o perfil de
// quem é atendente — a mudança que a ata pediu ser possível a qualquer hora,
// não só na criação do acesso.
await sair(contexto);
await entrar(pagina, EQUIPE.email, EQUIPE.senha);
await pagina.goto(`${BASE}/painel/acessos`);
const menuResponsavel = await pagina.innerText("body");
ok("menu do responsável mostra Financeiro e Acessos", menuResponsavel.includes("Financeiro") && /\bAcessos\b/.test(menuResponsavel));

const linhaAtendente = pagina.locator("tr", { hasText: "atendente@hemoderi.com.br" }).first();
ok("linha do atendente mostra o seletor de perfil", (await linhaAtendente.locator('select[aria-label="Perfil do acesso interno"]').count()) > 0);

console.log(`\n${passos - falhas}/${passos} OK`);
await navegador.close();
process.exit(falhas ? 1 : 0);
