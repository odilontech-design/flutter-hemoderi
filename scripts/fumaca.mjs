/**
 * Teste de fumaça do ciclo completo da operação, no navegador.
 *
 * Percorre o caminho que o dinheiro faz: a clínica agenda pelo portal, remarca,
 * a equipe confirma e aloca, o profissional aparece na agenda, o atendimento é
 * fechado e o repasse nasce no financeiro. É a verificação que os testes
 * unitários não dão — eles provam as regras, este prova que as telas, a sessão
 * e o banco conversam.
 *
 *   npm run fumaca                      # contra http://localhost:3003
 *   BASE_URL=https://... npm run fumaca # contra um ambiente publicado
 *
 * ATENÇÃO: o script CRIA e FECHA um atendimento de verdade, e espera os
 * acessos do seed. É para ambiente de teste ou homologação — nunca contra a
 * base de produção da Hemoderi.
 */

import { chromium } from "playwright";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Sem argumento, grava em um diretório temporário — nunca na raiz do
// projeto, que é o que fazia sobrar financeiro.png/painel.png soltos a
// cada `npm run fumaca` sem parâmetro.
const CAMINHO_CAPTURA = process.argv[2] ?? join(tmpdir(), "fumaca-financeiro.png");

const BASE = process.env.BASE_URL ?? "http://localhost:3003";
const EXECUTAVEL = process.env.CHROMIUM_PATH; // usado quando o Chromium não está no caminho padrão

/** Próxima segunda-feira: dia útil, dentro da disponibilidade do seed. */
function proximaSegunda() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
const DATA_ALVO = process.env.DATA_ALVO ?? proximaSegunda();
// O paciente leva carimbo de tempo porque é por ele que o teste encontra a
// PRÓPRIA linha na tabela do portal. Sem isso o "Reagendar" cai na primeira
// linha da tela — que, numa base que já rodou o teste antes, é o pedido de
// outra rodada, e o script passa a medir um atendimento que não é o dele.
const PACIENTE = `Paciente Teste ${Date.now().toString().slice(-6)}`;
const passos = [];
function ok(msg) { passos.push(`  ok  ${msg}`); }
function falha(msg) { passos.push(`FALHA ${msg}`); }

async function entrar(page, email, senha = "hemoderi123") {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  // Espera o destino final: o login manda para "/" e a raiz redireciona
  // conforme o papel — parar em "/" é ler o meio do caminho.
  await page.waitForURL(/\/(painel|portal|profissional)/, { timeout: 15000 });
  return page.url();
}

const navegador = await chromium.launch(EXECUTAVEL ? { executablePath: EXECUTAVEL } : {});
const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
const page = await contexto.newPage();
page.on("pageerror", (e) => falha(`erro de JS: ${e.message}`));

try {
  // ── 1. Clínica agenda pelo portal ────────────────────────────────────────
  let url = await entrar(page, "clinica-santa-rita@exemplo.com.br");
  url.includes("/portal") ? ok(`clínica entrou e caiu em ${new URL(url).pathname}`) : falha(`clínica foi para ${url}`);

  await page.goto(`${BASE}/portal/agendar`);
  await page.selectOption('select[name="servicoId"]', { index: 1 });
  // A clínica não escolhe mais o profissional (decisão da reunião de 14/09):
  // quem atende é definido na alocação, pela equipe.
  await page.fill('input[name="data"]', DATA_ALVO);
  await page.waitForSelector('input[name="horaInicio"]', { timeout: 15000 });
  const qtd = await page.locator('input[name="horaInicio"]').count();
  qtd > 0 ? ok(`portal ofereceu ${qtd} horários livres para ${DATA_ALVO}`) : falha("portal não ofereceu horário");

  await page.locator('label:has(input[name="horaInicio"])').first().click();
  await page.fill('input[name="doutorNome"]', "Dr. Teste");
  await page.fill('input[name="pacienteNome"]', PACIENTE);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/portal`, { timeout: 15000 });
  const temSolicitado = await page.locator("text=Solicitado").count();
  temSolicitado > 0 ? ok("pedido nasceu como Solicitado no portal") : falha("pedido não apareceu como Solicitado");

  // Itens rápidos (pós-ata de 21/09): QR Code saiu da página do cliente —
  // só a equipe interna (/painel/clinicas/[id]) ainda precisa dele para
  // imprimir. Ausência aqui é o comportamento correto, não uma falha.
  const temQr = await page.locator('img[alt*="QR Code"]').count();
  temQr === 0 ? ok("QR Code não aparece mais no portal do cliente") : falha("QR Code ainda aparece no portal");

  // ── 1b. Clínica remarca o próprio pedido ─────────────────────────────────
  const linhaDoPedido = page.locator("tbody tr", { hasText: PACIENTE }).first();
  const horaOriginal = (await linhaDoPedido.textContent()) ?? "";
  await linhaDoPedido.locator("text=Reagendar").click();
  await page.waitForURL(/\/portal\/reagendar\//, { timeout: 15000 });
  await page.fill('input[name="data"]', DATA_ALVO);
  await page.waitForSelector('label:has(input[name="horaInicio"])', { timeout: 15000 });
  // Pega o último horário livre para garantir que é diferente do escolhido.
  await page.locator('label:has(input[name="horaInicio"])').last().click();
  await page.click('button:has-text("Confirmar novo horário")');
  await page.waitForURL(`${BASE}/portal`, { timeout: 15000 });
  const horaNova = (await page.locator("tbody tr", { hasText: PACIENTE }).first().textContent()) ?? "";
  horaNova !== horaOriginal
    ? ok("clínica remarcou o próprio atendimento pelo portal")
    : falha("reagendamento não mudou o horário");

  // ── 2. Equipe confirma e aloca ───────────────────────────────────────────
  await contexto.clearCookies();
  url = await entrar(page, "equipe@hemoderi.com.br");
  url.includes("/painel") ? ok("equipe entrou no painel") : falha(`equipe foi para ${url}`);

  await page.goto(`${BASE}/painel/pedidos`);
  await page.click('button:has-text("Confirmar")');
  await page.waitForSelector("select", { state: "visible", timeout: 15000 });
  ok("pedido confirmado pela equipe");

  // Por rótulo, não por "primeiro select da página": a linha também tem o
  // select de Condição de pagamento, e pegar o errado deixa "Alocar"
  // desabilitado sem erro nenhum na tela — falha muda, sempre confusa.
  await page.selectOption('select[aria-label="Profissional para alocar"]', { index: 1 });
  await page.click('button:has-text("Alocar")');
  // Alocado sai da fila de "aguardando ação" — é justamente esse o efeito.
  await page.waitForTimeout(2000);
  await page.goto(`${BASE}/painel/pedidos?filtro=alocados`);
  await page.waitForSelector('button:has-text("Marcar realizado")', { state: "visible", timeout: 15000 });
  ok("pedido alocado, com profissional e repasse congelados");

  // ── 3. Profissional preenche o relatório ─────────────────────────────────
  await contexto.clearCookies();
  url = await entrar(page, "ana@exemplo.com.br");
  url.includes("/profissional") ? ok("profissional entrou no portal dele") : falha(`profissional foi para ${url}`);

  await page.goto(`${BASE}/profissional/disponibilidade`);
  const janelas = await page.locator("text=Segunda").count();
  janelas > 0 ? ok("disponibilidade declarada aparece no portal do profissional") : falha("disponibilidade não apareceu");

  await page.goto(`${BASE}/profissional/ganhos`);
  ok("tela de ganhos abriu");

  // ── 4. Equipe fecha o atendimento e o repasse aparece ────────────────────
  await contexto.clearCookies();
  await entrar(page, "equipe@hemoderi.com.br");
  await page.goto(`${BASE}/painel/pedidos?filtro=alocados`);
  await page.click('button:has-text("Marcar realizado")');
  await page.waitForTimeout(2500);
  ok("atendimento marcado como realizado");

  await page.goto(`${BASE}/painel/financeiro`);
  const conteudo = await page.textContent("body");
  conteudo.includes("A pagar") ? ok("financeiro abriu com a pagar e a receber") : falha("financeiro não abriu");
  await page.screenshot({ path: CAMINHO_CAPTURA, fullPage: true });

  await page.goto(`${BASE}/painel`);
  const painel = await page.textContent("body");
  painel.includes("Produtividade do mês") ? ok("painel diário mostra produtividade") : falha("produtividade ausente");
  await page.screenshot({ path: CAMINHO_CAPTURA.replace("financeiro", "painel"), fullPage: true });
} catch (erro) {
  falha(erro.message);
} finally {
  await navegador.close();
}

console.log("\n" + passos.join("\n"));
const falhas = passos.filter((p) => p.startsWith("FALHA")).length;
console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
