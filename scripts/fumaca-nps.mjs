/**
 * Teste de fumaça da pesquisa de NPS de 60 em 60 dias (reunião de 14/09).
 *
 * Cobre o ciclo que a rotina sozinha não prova: uma clínica "esfriando" (sem
 * múltiplos atendimentos na janela) recebe a pesquisa, ela aparece no portal,
 * a resposta some da tela depois de enviada, e a equipe vê o resultado — nota,
 * classificação e os três campos abertos — na tela da clínica.
 *
 *   npm run fumaca:nps
 *
 * ATENÇÃO: mexe em `criadaEm` de uma clínica do seed (Santa Rita) para
 * simulá-la com 65 dias, gera uma pesquisa de verdade e a responde. Ao final
 * apaga as pesquisas criadas e devolve `criadaEm` para agora. É para
 * ambiente de teste ou homologação — nunca contra a base de produção da
 * Hemoderi, e só faz sentido rodar com o servidor local (BASE_URL não é
 * aceito: mexer em `criadaEm` de uma clínica remota seria destrutivo demais
 * para um parâmetro de linha de comando).
 */

import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3003";
const EXECUTAVEL = process.env.CHROMIUM_PATH;
const prisma = new PrismaClient();
let n = 0, f = 0;
function ok(nome, cond, extra = "") { n++; if (cond) console.log(`  ok  ${nome}`); else { f++; console.log(`FALHA ${nome} ${extra}`); } }

const clinica = await prisma.clinica.findFirst({ where: { slug: "clinica-santa-rita" } });
if (!clinica) throw new Error("clínica do seed não encontrada — rode `npm run db:seed` antes");
const criadaEmOriginal = clinica.criadaEm;

const navegador = await chromium.launch(EXECUTAVEL ? { executablePath: EXECUTAVEL } : {});
const pagina = await navegador.newPage();
pagina.on("pageerror", (e) => ok(`erro de JS: ${e.message.slice(0, 150)}`, false));

try {
  // 65 dias atrás e sem pedido REALIZADO nesse intervalo (o seed não deixa
  // nenhum): a janela completa fica elegível — clínica "esfriando".
  await prisma.clinica.update({
    where: { id: clinica.id },
    data: { criadaEm: new Date(Date.now() - 65 * 86_400_000) },
  });

  const gerado = await fetch(`${BASE}/api/rotinas/nps`).then((r) => r.json());
  ok("rotina gera uma pesquisa para a clínica esfriando", gerado.geradas >= 1, JSON.stringify(gerado));

  const repetido = await fetch(`${BASE}/api/rotinas/nps`).then((r) => r.json());
  ok("rodar de novo não gera outra pesquisa para a mesma janela", repetido.geradas === 0, JSON.stringify(repetido));

  await pagina.goto(`${BASE}/login`);
  await pagina.fill('input[name="email"]', "clinica-santa-rita@exemplo.com.br");
  await pagina.fill('input[name="senha"]', "hemoderi123");
  await pagina.click('button[type="submit"]');
  await pagina.waitForURL(/\/portal/, { timeout: 20000 });
  await pagina.waitForTimeout(1200);

  const antes = await pagina.innerText("body");
  ok("portal mostra o card de pesquisa de satisfação", antes.includes("Pesquisa de satisfação"), antes.slice(0, 200));

  await pagina.locator('button:has-text("9")').first().click();
  await pagina.fill('textarea[name="pontosPositivos"]', "Atendimento rápido");
  await pagina.click('button:has-text("Enviar resposta")');
  await pagina.waitForTimeout(2500);

  const depois = await pagina.innerText("body");
  ok("card some do portal depois de respondida", !depois.includes("Pesquisa de satisfação"), depois.slice(0, 200));

  await pagina.context().clearCookies();
  await pagina.goto(`${BASE}/login`);
  await pagina.fill('input[name="email"]', "equipe@hemoderi.com.br");
  await pagina.fill('input[name="senha"]', "hemoderi123");
  await pagina.click('button[type="submit"]');
  await pagina.waitForURL(/\/painel/, { timeout: 20000 });

  await pagina.goto(`${BASE}/painel/clinicas`);
  await pagina.waitForTimeout(1000);
  await pagina.locator('a:has-text("Clínica Santa Rita")').first().click();
  await pagina.waitForTimeout(1200);

  const painel = await pagina.innerText("body");
  ok("equipe vê a nota respondida", painel.includes("9/10"), painel.slice(0, 400));
  ok("equipe vê a classificação (Promotor)", painel.includes("Promotor"));
  ok("equipe vê o texto do campo aberto", painel.includes("Atendimento rápido"));
} finally {
  // Devolve o banco ao estado do seed: sem isso, o próximo `fumaca:nps`
  // encontraria a janela já coberta e não geraria nada para testar.
  await prisma.pesquisaNps.deleteMany({ where: { clinicaId: clinica.id } });
  await prisma.clinica.update({ where: { id: clinica.id }, data: { criadaEm: criadaEmOriginal } });
  await prisma.$disconnect();
}

console.log(`\n${n - f}/${n} OK`);
await navegador.close();
process.exit(f ? 1 : 0);
