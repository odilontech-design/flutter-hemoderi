/**
 * A corrente inteira do atendimento, no navegador — a "simulação ponta a
 * ponta" que a reunião de 21/09 pediu:
 *
 *   logística aloca → profissional aceita → check-in na chegada →
 *   relatório com sinais vitais → pós-venda confere os três itens →
 *   repasse liberado
 *
 * E o outro caminho: recusa antes do aceite devolve o atendimento à fila e
 * fica registrada; depois do aceite a recusa some da tela (sair do caso
 * passa a ser decisão da logística).
 *
 *   npm run fumaca:aceite
 *
 * Precisa do seed rodado (`npm run db:seed`): usa as contas de perfil que
 * nascem lá — logistica@ e posvenda@hemoderi.com.br.
 *
 * ATENÇÃO: cria clínica, profissional e agendamento de teste no banco, e
 * apaga tudo no fim. É para ambiente de desenvolvimento ou homologação.
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3003";
const EXECUTAVEL = process.env.CHROMIUM_PATH;
const SENHA = "hemoderi123";
const NUMERO_TESTE = 990001;

const prisma = new PrismaClient();
let falhas = 0;
function ok(nome, cond, extra = "") {
  if (cond) console.log(`  ok  ${nome}`);
  else {
    falhas++;
    console.log(`FALHA ${nome} ${extra}`);
  }
}

async function limpar() {
  const pedido = await prisma.pedido.findFirst({ where: { numero: NUMERO_TESTE } });
  if (pedido) {
    await prisma.relatorioAtendimento.deleteMany({ where: { pedidoId: pedido.id } });
    await prisma.repasse.deleteMany({ where: { pedidoId: pedido.id } });
    await prisma.mensagemWhatsapp.deleteMany({ where: { pedidoId: pedido.id } });
    await prisma.recusaAtendimento.deleteMany({ where: { pedidoId: pedido.id } });
    await prisma.pedido.delete({ where: { id: pedido.id } });
  }
  await prisma.usuario.deleteMany({ where: { email: "fumaca.prof@exemplo.com.br" } });
  await prisma.profissional.deleteMany({ where: { email: "fumaca.prof@exemplo.com.br" } });
  await prisma.clinica.deleteMany({ where: { slug: "fumaca-aceite" } });
}

async function montarCenario() {
  await limpar();
  const senhaHash = await bcrypt.hash(SENHA, 10);

  const servico = await prisma.servico.findFirst({ where: { ativo: true } });
  if (!servico) throw new Error("Catálogo vazio — rode `npm run db:seed` antes.");

  const clinica = await prisma.clinica.create({
    data: { nome: "Clínica da Fumaça", slug: "fumaca-aceite", telefone: "5511900000000" },
  });
  const profissional = await prisma.profissional.create({
    data: {
      nome: "Profissional da Fumaça",
      email: "fumaca.prof@exemplo.com.br",
      chavePix: "fumaca.prof@exemplo.com.br",
    },
  });
  await prisma.usuario.create({
    data: {
      nome: profissional.nome,
      email: profissional.email,
      senhaHash,
      papel: "PROFISSIONAL",
      profissionalId: profissional.id,
    },
  });
  const pedido = await prisma.pedido.create({
    data: {
      numero: NUMERO_TESTE,
      clinicaId: clinica.id,
      servicoId: servico.id,
      data: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
      horaInicio: "10:00",
      duracaoMin: servico.duracaoMin,
      status: "CONFIRMADO",
      valorServicoCentavos: servico.valorPadraoCentavos,
    },
  });
  return { pedido, profissional };
}

const nav = await chromium.launch(EXECUTAVEL ? { executablePath: EXECUTAVEL } : {});

async function entrar(email) {
  const ctx = await nav.newContext({
    viewport: { width: 1280, height: 950 },
    permissions: ["geolocation"],
    geolocation: { latitude: -23.5617, longitude: -46.6559 },
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => ok(`erro de JS: ${e.message.slice(0, 120)}`, false));
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="senha"]', SENHA);
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/(painel|portal|profissional)/, { timeout: 20000 });
  await p.waitForTimeout(800);
  return p;
}

try {
  const { pedido, profissional } = await montarCenario();

  // ── Logística aloca ───────────────────────────────────────────────────────
  const logistica = await entrar("logistica@hemoderi.com.br");
  await logistica.goto(`${BASE}/painel/pedidos?filtro=todos`);
  await logistica.waitForTimeout(800);
  ok("logística vê o seletor de alocar", (await logistica.locator('select[aria-label="Profissional para alocar"]').count()) > 0);
  ok("logística não vê o botão de cancelar", (await logistica.locator('button:has-text("Cancelar")').count()) === 0);

  await logistica
    .locator('select[aria-label="Profissional para alocar"]')
    .first()
    .selectOption({ label: profissional.nome });
  await logistica.locator('button:has-text("Alocar")').first().click();
  await logistica.waitForTimeout(2500);
  await logistica.reload();
  await logistica.waitForTimeout(1000);
  ok("esteira mostra que falta o aceite", (await logistica.innerText("body")).includes("aguardando aceite"));

  // ── Recusa antes do aceite ────────────────────────────────────────────────
  let prof = await entrar("fumaca.prof@exemplo.com.br");
  ok("profissional recebe o pedido de confirmação", (await prof.innerText("body")).includes("esperando sua confirmação"));

  await prof.locator('button:has-text("Não consigo atender")').first().click();
  await prof.waitForTimeout(400);
  ok("recusa exige motivo", await prof.locator('button:has-text("Confirmar recusa")').isDisabled());
  await prof.locator("textarea").first().fill("Estou em outra cidade nesse dia");
  await prof.waitForTimeout(200);
  await prof.locator('button:has-text("Confirmar recusa")').click();
  await prof.waitForTimeout(3000);

  const aposRecusa = await prisma.pedido.findUnique({ where: { id: pedido.id }, include: { recusas: true } });
  ok("recusa devolve o atendimento à fila", aposRecusa.status === "CONFIRMADO", aposRecusa.status);
  ok("recusa fica registrada com o motivo", aposRecusa.recusas.length === 1);

  // ── Aloca de novo, agora o profissional aceita ────────────────────────────
  await logistica.reload();
  await logistica.waitForTimeout(1000);
  await logistica
    .locator('select[aria-label="Profissional para alocar"]')
    .first()
    .selectOption({ label: profissional.nome });
  await logistica.locator('button:has-text("Alocar")').first().click();
  await logistica.waitForTimeout(2500);

  await prof.reload();
  await prof.waitForTimeout(1200);
  await prof.locator('button:has-text("Aceitar atendimento")').first().click();
  await prof.waitForTimeout(2500);
  await prof.reload();
  await prof.waitForTimeout(1000);
  let corpo = await prof.innerText("body");
  ok("depois do aceite some o botão de recusar", !corpo.includes("Não consigo atender"));
  ok("aparece o check-in de chegada", corpo.includes("Cheguei no local"));

  // ── Check-in ──────────────────────────────────────────────────────────────
  await prof.locator('button:has-text("Cheguei no local")').first().click();
  await prof.waitForTimeout(3000);
  await prof.reload();
  await prof.waitForTimeout(1000);
  ok("chegada registrada", (await prof.innerText("body")).includes("chegada registrada"));

  // ── Relatório ─────────────────────────────────────────────────────────────
  await prof.locator('a:has-text("Preencher relatório")').first().click();
  await prof.waitForTimeout(1200);
  ok("relatório pede sinais vitais", (await prof.innerText("body")).includes("Sinais vitais"));

  await prof.locator('button:has-text("Enviar relatório")').click();
  await prof.waitForTimeout(2500);
  ok("recusa o envio com sinal vital em branco", (await prof.innerText("body")).includes("Falta preencher"));

  await prof.fill('input[name="frequenciaCardiaca"]', "72 bpm");
  await prof.fill('input[name="saturacaoOxigenio"]', "98%");
  const botoesNA = prof.locator('button:has-text("N/A")');
  for (let i = (await botoesNA.count()) - 1; i >= 2; i--) await botoesNA.nth(i).click();
  await prof.waitForTimeout(300);
  await prof.fill('textarea[name="servicosAdicionais"]', "2 membranas a mais");
  await prof.fill('input[name="ajudaCusto"]', "150,00");
  await prof.fill('input[name="ajudaCustoJustificativa"]', "210 km, carro");
  await prof.locator('button:has-text("Enviar relatório")').click();
  await prof.waitForTimeout(3500);
  ok("relatório enviado", prof.url().endsWith("/profissional"), prof.url());

  const relatorio = await prisma.relatorioAtendimento.findUnique({ where: { pedidoId: pedido.id } });
  ok('"não se aplica" chega ao banco como resposta', relatorio.pressaoArterial === "não se aplica", String(relatorio.pressaoArterial));
  ok("ajuda de custo vira centavos", relatorio.ajudaCustoCentavos === 15000, String(relatorio.ajudaCustoCentavos));

  // ── Pós-venda confere e aprova ────────────────────────────────────────────
  const posVenda = await entrar("posvenda@hemoderi.com.br");
  await posVenda.goto(`${BASE}/painel/pedidos?filtro=todos`);
  await posVenda.waitForTimeout(1000);
  corpo = await posVenda.innerText("body");
  ok("pós-venda vê o que foi declarado a mais", corpo.includes("2 membranas a mais"));
  ok("pós-venda vê a ajuda de custo", corpo.includes("150,00"));

  const aprovar = posVenda.locator('button:has-text("Aprovar e liberar repasse")').first();
  ok("aprovar começa travado", await aprovar.isDisabled());

  const caixas = posVenda.locator('input[type="checkbox"]');
  for (let i = 0; i < 3; i++) {
    await caixas.nth(i).click();
    await posVenda.waitForTimeout(1200);
  }
  ok("aprovar libera com os três itens conferidos", !(await aprovar.isDisabled()));
  await aprovar.click();
  await posVenda.waitForTimeout(3000);

  const repasse = await prisma.repasse.findUnique({ where: { pedidoId: pedido.id } });
  ok("repasse sai de aguardando aprovação", repasse?.status === "PENDENTE", String(repasse?.status));
} finally {
  await limpar();
  await nav.close();
  await prisma.$disconnect();
}

console.log(`\n${falhas === 0 ? "TUDO OK" : `${falhas} FALHA(S)`}`);
process.exit(falhas ? 1 : 0);
