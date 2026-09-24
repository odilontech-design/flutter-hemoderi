/**
 * Teste de fumaça do agendamento público — a vitrine de quem ainda não é
 * cliente e a triagem que transforma o pedido em agendamento.
 *
 * O caminho medido é o que traz cliente novo: a pessoa cai na raiz do site,
 * escolhe o procedimento pela família, escolhe dia e horário, se identifica
 * com cadastro completo (CEP, endereço, e-mail — ata de 21/09), e o pedido
 * aparece na fila da equipe já com a clínica resolvida, pronto para virar
 * agendamento de verdade na esteira.
 *
 *   npm run fumaca:publico
 *   BASE_URL=https://... npm run fumaca:publico
 *
 * ATENÇÃO: cria uma clínica, uma solicitação e um agendamento de teste no
 * banco, e apaga tudo no fim. É para ambiente de teste ou homologação.
 */

import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3003";
// Usado quando o Chromium não está no caminho padrão do Playwright.
const EXECUTAVEL = process.env.CHROMIUM_PATH;
const carimbo = Date.now();
const NOME_CLINICA = `Clínica Teste ${carimbo}`;

const prisma = new PrismaClient();
let n = 0, f = 0;
function ok(nome, cond, extra = "") { n++; if (cond) console.log(`  ok  ${nome}`); else { f++; console.log(`FALHA ${nome} ${extra}`); } }

async function limpar() {
  const clinica = await prisma.clinica.findFirst({ where: { nome: NOME_CLINICA } });
  if (clinica) {
    await prisma.solicitacaoPublica.deleteMany({ where: { clinicaId: clinica.id } });
    await prisma.pedido.deleteMany({ where: { clinicaId: clinica.id } });
    await prisma.usuario.deleteMany({ where: { clinicaId: clinica.id } });
    await prisma.precoClinica.deleteMany({ where: { clinicaId: clinica.id } });
    await prisma.clinica.delete({ where: { id: clinica.id } });
  }
}

const nav = await chromium.launch(EXECUTAVEL ? { executablePath: EXECUTAVEL } : {});

try {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => ok(`erro de JS: ${e.message.slice(0, 120)}`, false));

  // ── A vitrine, sem login ──────────────────────────────────────────────────
  await p.goto(`${BASE}/`);
  await p.waitForTimeout(1500);
  ok("a raiz leva à vitrine, não ao login", p.url().includes("/agendar"), p.url());
  const vitrine = await p.innerText("body");
  ok("agrupa por família", vitrine.includes("PRF") && vitrine.includes("Piezo"), vitrine.slice(0, 200));
  ok("não pede login para ver o catálogo", !vitrine.toLowerCase().includes("senha"));
  ok("oferece entrada para quem já é cliente", vitrine.includes("Já sou cliente"));

  // passo 2 só aparece depois de escolher o serviço
  ok("o passo do quando começa escondido", !vitrine.includes("2 · Quando"));
  // "PRF" é família (equipamento), não procedimento — precisa abrir o grupo
  // antes de escolher um item dentro dele (lib/familia.ts). Depois de aberto,
  // "Membranas" só existe como nome de procedimento dentro do grupo — nenhum
  // chip de família se chama assim, então o texto já desambigua sozinho.
  await p.locator('button[aria-expanded]:has-text("PRF")').first().click();
  await p.waitForTimeout(600);
  await p.locator('button:has-text("Membranas")').first().click();
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
  await p.fill('input[name="solicitante"]', "Dra. Marina Teste");
  await p.fill('input[name="telefone"]', `11 9${String(carimbo).slice(-8)}`);
  await p.fill('input[name="clinicaNome"]', NOME_CLINICA);
  await p.fill('input[name="email"]', `clinica.teste.${carimbo}@exemplo.com.br`);
  await p.fill('input[name="doutorNome"]', "Dra. Marina");

  // CEP (ata de 21/09 + item rápido de CPF/CNPJ, ambos com endereço
  // obrigatório). Sem rede para o serviço de CEP aqui, o preenchimento cai no
  // caminho manual (ver CamposEndereco.tsx) — é esse caminho que este teste
  // prova, e é o único disponível neste ambiente de qualquer forma.
  await p.fill('input[name="cep"]', "01310-100");
  await p.locator('input[name="cep"]').blur();
  await p.waitForTimeout(2500);
  await p.fill('input[name="endereco"]', "Avenida Paulista");
  await p.fill('input[name="numero"]', "1000");
  await p.fill('input[name="bairro"]', "Bela Vista");
  await p.fill('input[name="cidade"]', "São Paulo");
  await p.fill('input[name="uf"]', "SP");

  await p.locator('button:has-text("Enviar pedido de agendamento")').click();
  await p.waitForTimeout(3500);
  ok("o envio confirma sem pedir cadastro", (await p.innerText("body")).includes("Recebemos seu agendamento"), (await p.innerText("body")).slice(0, 200));

  // mobile
  const mob = await nav.newContext({ viewport: { width: 390, height: 800 } });
  const pm = await mob.newPage();
  await pm.goto(`${BASE}/agendar`);
  await pm.waitForTimeout(1500);
  const larg = await pm.evaluate(() => document.documentElement.scrollWidth);
  ok("a vitrine não estoura a largura no celular", larg <= 390, `scrollWidth=${larg}`);
  const alvo = await pm.locator('button[aria-expanded]').first().boundingBox();
  ok("cartão de família tem alvo de toque confortável", alvo !== null && alvo.height >= 44, JSON.stringify(alvo));
  await mob.close();

  // ── A triagem, pela equipe ────────────────────────────────────────────────
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', "equipe@hemoderi.com.br");
  await p.fill('input[name="senha"]', "hemoderi123");
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/painel/, { timeout: 20000 });
  await p.goto(`${BASE}/painel/solicitacoes`);
  await p.waitForTimeout(1500);
  const triagem = await p.innerText("body");
  ok("o pedido do site chegou na triagem", triagem.includes(NOME_CLINICA), triagem.slice(0, 300));
  ok("mostra o que foi pedido", triagem.includes("Membranas"));
  ok("mostra o doutor informado", triagem.includes("Dra. Marina"));

  // confirma — a clínica já veio resolvida do cadastro feito na hora (ata de
  // 21/09), então não sobra escolha de clínica para a equipe aqui: só
  // confirmar. Escopado ao CARTÃO desta solicitação (pelo nome da clínica de
  // teste), nunca ".first()" solto: outra solicitação pendente na fila (de
  // uso real ou de uma execução anterior) tomaria o clique no lugar dela.
  const cartaoDesteTeste = p.locator("div.border-b.border-gray-100", { hasText: NOME_CLINICA }).first();
  await cartaoDesteTeste.locator('button:has-text("Confirmar e agendar")').click();
  await p.waitForTimeout(3500);
  const depois = await p.innerText("body");
  // Escopado ao cartão da FILA: o nome continua aparecendo — e deve — na
  // tabela de já tratados, então procurar na página inteira nunca provaria
  // que saiu da fila.
  const fila = p.locator("div.rounded-2xl", { hasText: "triagem" }).first();
  const textoFila = await fila.innerText().catch(() => "");
  ok("sai da fila depois de vinculado",
     !textoFila.includes(NOME_CLINICA) || textoFila.includes("Nada esperando"),
     textoFila.slice(0, 200));
  ok("aparece como tratado", depois.includes("virou agendamento"), depois.slice(0, 300));

  // e virou agendamento de verdade na esteira
  await p.goto(`${BASE}/painel/pedidos?filtro=todos`);
  await p.waitForTimeout(1500);
  ok("o agendamento existe na esteira", (await p.innerText("body")).includes("Dra. Marina"), "");
} catch (erro) {
  f++;
  console.log(`FALHA ${erro instanceof Error ? erro.message : String(erro)}`);
} finally {
  await limpar();
  await nav.close();
  await prisma.$disconnect();
}

console.log(`\n${n - f}/${n} OK`);
process.exit(f ? 1 : 0);
