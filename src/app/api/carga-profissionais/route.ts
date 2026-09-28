import { prisma } from "@/lib/prisma";

// Rota de manutenção: nunca pré-renderizada.
export const dynamic = "force-dynamic";

/**
 * Carga única dos 46 profissionais da planilha que a Hemoderi enviou
 * (conferida linha a linha contra a relação original — ver a correção do
 * e-mail da Iara e a duplicata da Daniela abaixo).
 *
 * Cria só o cadastro em `Profissional` — sem `Usuario`, sem senha, sem
 * acesso ao portal. Foi pedido de propósito assim: cadastrar sessenta
 * pessoas sem abrir login compartilhado para o lote inteiro de uma vez,
 * sem usar a ferramenta de importação da tela (que também cria acesso).
 *
 * Idempotente: quem já existe (mesmo e-mail em `Profissional` ou em
 * `Usuario`) é pulado, nunca sobrescrito — dá para rodar de novo sem medo
 * de duplicar.
 */

const PROFISSIONAIS: { nome: string; email: string }[] = [
  { nome: "Antonio Brito Rocha", email: "antonio19202016@gmail.com" },
  { nome: "Claudijane Ramos dos Santos", email: "ramosclaudijane@gmail.com" },
  { nome: "Caroline Giacoia", email: "carolgiacoia@gmail.com" },
  { nome: "Diogo Lima de Souza", email: "dilima13@gmail.com" },
  { nome: "Elisandra Franca Borges de Sá", email: "li_franca103@hotmail.com" },
  { nome: "Elito Evangelista Santos Junior", email: "elitoevangelista32@gmail.com" },
  { nome: "Fernanda Ferreira", email: "f.ferreira@hc.fm.usp.br" },
  { nome: "Fillipe Leal", email: "filipelealreis@gmail.com" },
  { nome: "Giuliana Azevedo Rocha Santos", email: "giulianaazvd@gmail.com" },
  { nome: "Julbeto Brito Coutinho", email: "jubacoutinho@yahoo.com.br" },
  { nome: "Luís Carlos Brito Sepulveda", email: "luissepulveda68@hotmail.com" },
  { nome: "Lucila Beatriz Godoi", email: "bibi_godoi@yahoo.com.br" },
  { nome: "Nayara da Silva Vieira", email: "nay.vieira@outlook.com" },
  { nome: "Rafael Ferreira da Silva", email: "jolohe102427@gmail.com" },
  { nome: "Sandra Regina Souza", email: "sandraregina.meireles@gmail.com" },
  { nome: "Vinicius Gabriel Fagundes Santana", email: "vinigfs@gmail.com" },
  { nome: "Bianca Bernadette Augusto de Souza", email: "biancabernadette@hotmail.com" },
  { nome: "Tayná dos Santos Alves", email: "taynaasantos@gmail.com" },
  { nome: "Kellen Da Silva Santos", email: "silvaskellen@hotmail.com" },
  { nome: "Marcela Oliveira Jacinto", email: "marcela.jacintto@gmail.com" },
  { nome: "Ana Carolina Garcia Argañaraz", email: "carol.arganaraz@gmail.com" },
  { nome: "Ana Maria Gomes de Oliveira", email: "19amg62@gmail.com" },
  { nome: "Thiago da Costa Coelho", email: "thiagodcc64@gmail.com" },
  { nome: "Ingrid Palmieri", email: "ingrid.palmieri@gmail.com" },
  { nome: "Ana Luisa Teixeira Favari", email: "dra.analuisafavari@gmail.com" },
  { nome: "Maira Soares Carmelo", email: "mai.soarescarmelo@gmail.com" },
  { nome: "Yorrahn Bandini de Oliveira", email: "bandinioliveira@gmail.com" },
  { nome: "Iara Martins Alves", email: "iarinha503@gmail.com" },
  { nome: "Joyce Alves Soares", email: "lumieresecretariadoremoto@gmail.com" },
  { nome: "Marcio Estevo de Azevedo Junior", email: "m.junior_2001@hotmail.com" },
  { nome: "Ana Daiane Marques dos Santos Pacheco", email: "anadaiane54@gmail.com" },
  { nome: "Daniela de Melo Garcia", email: "dani_garcia30@yahoo.com.br" },
  { nome: "Rafael Nelson Neves", email: "neves.rn01@gmail.com" },
  { nome: "Aline Costa Araujo", email: "aline.costaaraujo@yahoo.com.br" },
  { nome: "Sthefany Folha da Silva", email: "sthefanyfolha8@gmail.com" },
  { nome: "Juliana Evangelista Lobo", email: "julianaelobo@yahoo.com.br" },
  { nome: "Gabriel Patrick Medeiros Cavalcante de Araujo", email: "gabspatrick@gmail.com" },
  { nome: "Renata Muniz Ribeiro", email: "renatamuniz_1@hotmail.com" },
  { nome: "Maria Aline Da Silva Carvalho", email: "dra.alinecarvalhoo@gmail.com" },
  { nome: "Isabelle Oliveira Lopes", email: "isabellelopes200313@gmail.com" },
  { nome: "Bruna Alves Gomes Velez", email: "b.alvesgms@gmail.com" },
  { nome: "Gabriel Claudiano", email: "gabriel-claudiano@hotmail.com" },
  { nome: "Mariluci Cristine Neves de Oliveira", email: "mariluci.cn@yahoo.com" },
  { nome: "Ederson Alex de Brito", email: "edersonalex@gmail.com" },
  { nome: "Monica Messias Nascimento e Silva", email: "monicaed2011@gmail.com" },
  { nome: "Liniker Moreno da Silva", email: "moreno.liniker@gmail.com" },
];

function segredoConfigurado(): string | null {
  const segredo = process.env.CARGA_SECRET;
  return segredo && segredo.length >= 16 ? segredo : null;
}

function pagina(corpo: string, status = 200): Response {
  return new Response(
    `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Carga de profissionais — Hemoderi</title>
<style>
  body { font-family: system-ui, sans-serif; background: #faf5f2; color: #241412; margin: 0; padding: 2rem 1rem; }
  .cartao { max-width: 560px; margin: 3rem auto; background: white; border: 1px solid #e5e5e5; border-radius: 16px; padding: 2rem; }
  h1 { font-size: 1.1rem; color: #9C3A32; margin: 0 0 .5rem; }
  h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; color: #999; margin: 1.75rem 0 .5rem; }
  p { font-size: .85rem; color: #555; line-height: 1.55; }
  ul { font-size: .8rem; color: #555; line-height: 1.6; padding-left: 1.1rem; max-height: 260px; overflow-y: auto; }
  button { width: 100%; padding: .8rem; border: none; border-radius: 8px; font-weight: 600; font-size: .85rem; cursor: pointer; background: #9C3A32; color: white; }
  button:hover { background: #6E2620; }
  a { color: #9C3A32; }
  code { background: #f3ebe6; border-radius: 5px; padding: .1rem .35rem; font-size: .8rem; }
  .aviso { background: #faf0dd; border: 1px solid #eedcb4; border-radius: 10px; padding: .8rem 1rem; font-size: .8rem; color: #7a5510; line-height: 1.5; margin-top: 1.5rem; }
</style>
</head>
<body>
<div class="cartao">
  <div style="font-weight:800;color:#9C3A32;margin-bottom:1rem;">Hemoderi · Operações</div>
  ${corpo}
</div>
</body>
</html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function jaExistentes(): Promise<Set<string>> {
  const emails = PROFISSIONAIS.map((p) => p.email);
  const [profissionais, usuarios] = await Promise.all([
    prisma.profissional.findMany({ where: { email: { in: emails } }, select: { email: true } }),
    prisma.usuario.findMany({ where: { email: { in: emails } }, select: { email: true } }),
  ]);
  return new Set([...profissionais.map((p) => p.email ?? ""), ...usuarios.map((u) => u.email)]);
}

export async function GET(requisicao: Request) {
  const segredo = segredoConfigurado();
  const chave = new URL(requisicao.url).searchParams.get("key");
  if (!segredo || chave !== segredo) return new Response("Not found", { status: 404 });

  const existentes = await jaExistentes();
  const pendentes = PROFISSIONAIS.filter((p) => !existentes.has(p.email));

  return pagina(`
    <h1>Carga de profissionais</h1>
    <p>Planilha da Hemoderi: ${PROFISSIONAIS.length} profissionais no total.
    Cria só o cadastro (<strong>sem acesso ao portal</strong>) — quem já existe é pulado.</p>

    <h2>Situação agora</h2>
    <p>${PROFISSIONAIS.length - pendentes.length} já cadastrado(s) · ${pendentes.length} pendente(s)</p>

    ${
      pendentes.length > 0
        ? `<form method="post" action="/api/carga-profissionais">
             <input type="hidden" name="key" value="${chave}" />
             <button type="submit">Cadastrar os ${pendentes.length} pendentes</button>
           </form>`
        : `<p><strong>Todos os ${PROFISSIONAIS.length} já estão cadastrados.</strong></p>`
    }

    <h2>Pendentes</h2>
    <ul>${pendentes.map((p) => `<li>${p.nome} — ${p.email}</li>`).join("") || "<li>nenhum</li>"}</ul>

    <div class="aviso">
      Depois de cadastrar, remova a variável <code>CARGA_SECRET</code> do ambiente —
      esta rota fica ativa até você tirá-la.
    </div>
  `);
}

export async function POST(requisicao: Request) {
  const segredo = segredoConfigurado();
  const dados = await requisicao.formData();
  const chave = String(dados.get("key") ?? "");
  if (!segredo || chave !== segredo) return new Response("Not found", { status: 404 });

  const existentes = await jaExistentes();
  const pendentes = PROFISSIONAIS.filter((p) => !existentes.has(p.email));

  const criados: string[] = [];
  const falharam: { nome: string; email: string; motivo: string }[] = [];

  for (const { nome, email } of pendentes) {
    try {
      await prisma.profissional.create({ data: { nome, email } });
      criados.push(`${nome} — ${email}`);
    } catch (erro) {
      falharam.push({ nome, email, motivo: erro instanceof Error ? erro.message.slice(0, 120) : "falhou ao criar" });
    }
  }

  return pagina(`
    <h1>Carga concluída</h1>
    <p>${criados.length} profissional(is) cadastrado(s) agora. Sem acesso ao portal —
    só o cadastro, como pedido.</p>

    ${criados.length > 0 ? `<h2>Cadastrados agora</h2><ul>${criados.map((c) => `<li>${c}</li>`).join("")}</ul>` : ""}
    ${
      falharam.length > 0
        ? `<h2>Não deu para cadastrar</h2><ul>${falharam
            .map((f) => `<li>${f.nome} — ${f.email}: ${f.motivo}</li>`)
            .join("")}</ul>`
        : ""
    }

    <p style="margin-top:1.5rem;"><a href="/api/carga-profissionais?key=${encodeURIComponent(chave)}">← voltar</a></p>
    <p><a href="/painel/profissionais">Ver a lista de profissionais →</a></p>

    <div class="aviso">
      Por segurança, remova a variável <code>CARGA_SECRET</code> do ambiente agora
      que a carga terminou.
    </div>
  `);
}
