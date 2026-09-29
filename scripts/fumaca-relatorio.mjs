/**
 * Teste de fumaça do relatório editável (ata de 28/09).
 *
 * O que prova: o profissional abre o relatório com os dados do agendamento
 * já preenchidos, corrige o que saiu diferente na prática, e a divergência
 * chega à esteira para o pós-venda conferir — sem alterar o cadastro da
 * clínica, que continua sendo da equipe interna.
 *
 *   npm run fumaca:relatorio
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3003";
const EXECUTAVEL = process.env.CHROMIUM_PATH;
const SENHA = "hemoderi123";
const PACIENTE = "Paciente Relatorio";

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

try {
  await prisma.pedido.deleteMany({ where: { pacienteNome: PACIENTE } });

  const profissional = await prisma.profissional.findFirst({
    where: { ativo: true, usuarios: { some: { email: "ana@exemplo.com.br" } } },
    select: { id: true },
  });
  const clinica = await prisma.clinica.findFirst({
    where: { ativa: true },
    select: { id: true, nome: true },
  });
  const servico = await prisma.servico.findFirst({
    where: { ativo: true },
    select: { id: true, duracaoMin: true },
  });

  // Um atendimento alocado para hoje: é o que abre o relatório.
  const pedido = await prisma.pedido.create({
    data: {
      numero: 940000 + (Date.now() % 50000),
      clinicaId: clinica.id,
      servicoId: servico.id,
      profissionalId: profissional.id,
      data: new Date(),
      horaInicio: "08:00",
      duracaoMin: servico.duracaoMin,
      status: "ALOCADO",
      aceitoEm: new Date(),
      doutorNome: "Dr. Agendado",
      pacienteNome: PACIENTE,
      valorServicoCentavos: 20_000,
      valorRepasseCentavos: 12_000,
    },
    select: { id: true },
  });

  // ── O profissional preenche o relatório ──────────────────────────────────
  await entrar(p, "ana@exemplo.com.br");
  await p.goto(`${BASE}/profissional/relatorio/${pedido.id}`);
  await p.waitForTimeout(1500);

  ok(
    "o relatório abre com a clínica do agendamento preenchida",
    (await p.locator('input[name="clinicaNomeInformado"]').inputValue()) === clinica.nome
  );
  ok(
    "o doutor agendado vem preenchido",
    (await p.locator('input[name="doutorNomeInformado"]').inputValue()) === "Dr. Agendado"
  );
  ok(
    "o identificador do pedido não é editável",
    (await p.locator('input[name="numero"], input[name="codigo"]').count()) === 0
  );

  // Corrige o que saiu diferente: outra unidade e outro doutor.
  await p.fill('input[name="clinicaNomeInformado"]', "Unidade Centro");
  await p.fill('input[name="doutorNomeInformado"]', "Dra. Quem Recebeu");
  // O endereço fica como está — é o caso de "não mexeu, não divergiu".

  for (const campo of [
    "frequenciaCardiaca",
    "saturacaoOxigenio",
    "pressaoArterial",
    "glicemia",
    "oxidoNitroso",
    "oxigenio",
  ]) {
    await p.fill(`input[name="${campo}"]`, "não se aplica");
  }
  await p.fill('input[name="fimReal"]', "09:00");
  await p.locator('button[type="submit"]').click();
  // O envio espera a localização antes de chamar a action, e essa espera tem
  // teto de 4s (lib/geolocalizacao.ts) — sem GPS no navegador de teste, ela
  // vai até o fim. Menos que isso mede o formulário antes de ele enviar.
  await p.waitForTimeout(9000);

  const relatorio = await prisma.relatorioAtendimento.findUnique({
    where: { pedidoId: pedido.id },
    select: { clinicaNomeInformado: true, doutorNomeInformado: true, enderecoInformado: true },
  });
  ok("a clínica corrigida foi gravada", relatorio?.clinicaNomeInformado === "Unidade Centro", JSON.stringify(relatorio));
  ok("o doutor corrigido foi gravado", relatorio?.doutorNomeInformado === "Dra. Quem Recebeu");
  ok(
    "o campo não alterado NÃO vira divergência",
    relatorio?.enderecoInformado === null,
    String(relatorio?.enderecoInformado)
  );

  // O cadastro da clínica é da equipe: o relatório não o reescreve.
  const clinicaDepois = await prisma.clinica.findUnique({
    where: { id: clinica.id },
    select: { nome: true },
  });
  ok("o cadastro da clínica continua intacto", clinicaDepois.nome === clinica.nome, clinicaDepois.nome);

  // ── A divergência chega ao pós-venda ─────────────────────────────────────
  await entrar(p, "posvenda@hemoderi.com.br");
  await p.goto(`${BASE}/painel/pedidos?filtro=conferir`);
  await p.waitForTimeout(1800);
  const esteira = await p.innerText("body");
  ok("a esteira mostra onde o atendimento saiu", esteira.includes("Unidade Centro"), esteira.slice(0, 300));
  ok("a esteira mostra quem recebeu", esteira.includes("Dra. Quem Recebeu"));
  ok("a esteira mostra o que estava agendado, para comparar", esteira.includes("Dr. Agendado"));
} finally {
  await nav.close();
  await prisma.pedido.deleteMany({ where: { pacienteNome: PACIENTE } });
  await prisma.$disconnect();
}

console.log(`\n${passou}/${passou + falhou} OK`);
process.exit(falhou > 0 ? 1 : 0);
