import { prisma } from "@/lib/prisma";
import { estadoDemo, limparDemo, montarDemo, SENHA_DEMO, type ResumoDemo } from "@/lib/demo";

// Rota de manutenção: nunca pré-renderizada.
export const dynamic = "force-dynamic";
// Montar a demonstração são ~12 idas ao banco; o padrão de 10s é curto demais
// se a rede estiver lenta no meio de uma apresentação.
export const maxDuration = 60;

/**
 * Monta e desmonta os dados de demonstração — para apresentar o sistema com
 * as telas cheias antes de a operação real existir.
 *
 * Mesma proteção do /api/setup: exige um segredo que só existe enquanto for
 * necessário, e sem ele finge que a rota não existe. A diferença é que esta
 * NÃO se tranca sozinha: montar e limpar são operações que a apresentação
 * pode precisar repetir. Por isso vale mais ainda tirar DEMO_SECRET do
 * ambiente quando a apresentação acabar.
 */

function segredoConfigurado(): string | null {
  const segredo = process.env.DEMO_SECRET;
  return segredo && segredo.length >= 16 ? segredo : null;
}

function pagina(corpo: string, status = 200): Response {
  return new Response(
    `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Demonstração — Hemoderi</title>
<style>
  body { font-family: system-ui, sans-serif; background: #faf5f2; color: #241412; margin: 0; padding: 2rem 1rem; }
  .cartao { max-width: 560px; margin: 3rem auto; background: white; border: 1px solid #e5e5e5; border-radius: 16px; padding: 2rem; }
  h1 { font-size: 1.1rem; color: #9C3A32; margin: 0 0 .5rem; }
  h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; color: #999; margin: 1.75rem 0 .5rem; }
  p { font-size: .85rem; color: #555; line-height: 1.55; }
  ul { font-size: .85rem; color: #555; line-height: 1.7; padding-left: 1.1rem; }
  button { width: 100%; padding: .8rem; border: none; border-radius: 8px; font-weight: 600; font-size: .85rem; cursor: pointer; }
  .montar { background: #9C3A32; color: white; }
  .montar:hover { background: #6E2620; }
  .limpar { background: white; color: #c0243f; border: 1px solid #f0c0c8; margin-top: .6rem; }
  .limpar:hover { background: #fff5f6; }
  a { color: #9C3A32; }
  code { background: #f3ebe6; border-radius: 5px; padding: .1rem .35rem; font-size: .8rem; }
  table { width: 100%; border-collapse: collapse; font-size: .85rem; }
  td { padding: .35rem 0; border-bottom: 1px solid #f0e8e4; color: #555; }
  td:last-child { text-align: right; font-weight: 600; color: #241412; }
  .aviso { background: #faf0dd; border: 1px solid #eedcb4; border-radius: 10px; padding: .8rem 1rem; font-size: .8rem; color: #7a5510; line-height: 1.5; margin-top: 1.5rem; }
  .credencial { background: #f3ebe6; border-radius: 10px; padding: .8rem 1rem; font-size: .82rem; line-height: 1.7; margin-top: .5rem; }
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

function tabelaResumo(resumo: ResumoDemo): string {
  const linhas: [string, number][] = [
    ["Clínicas", resumo.clinicas],
    ["Profissionais", resumo.profissionais],
    ["Atendimentos", resumo.pedidos],
    ["Relatórios", resumo.relatorios],
    ["Repasses", resumo.repasses],
    ["Faturas", resumo.faturas],
    ["Acessos", resumo.acessos],
  ];
  return `<table>${linhas.map(([r, v]) => `<tr><td>${r}</td><td>${v}</td></tr>`).join("")}</table>`;
}

function botoes(chave: string, temDados: boolean): string {
  const escondida = `<input type="hidden" name="key" value="${chave}" />`;
  return `
    <form method="post" action="/api/demo">
      ${escondida}
      <input type="hidden" name="acao" value="montar" />
      <button class="montar" type="submit">${temDados ? "Recriar" : "Montar"} a demonstração</button>
    </form>
    ${
      temDados
        ? `<form method="post" action="/api/demo">
             ${escondida}
             <input type="hidden" name="acao" value="limpar" />
             <button class="limpar" type="submit">Apagar os dados de demonstração</button>
           </form>`
        : ""
    }`;
}

export async function GET(requisicao: Request) {
  const segredo = segredoConfigurado();
  const chave = new URL(requisicao.url).searchParams.get("key");
  if (!segredo || chave !== segredo) return new Response("Not found", { status: 404 });

  const resumo = await estadoDemo(prisma);
  const temDados = resumo.clinicas > 0 || resumo.pedidos > 0;

  return pagina(`
    <h1>Dados de demonstração</h1>
    <p>Preenche o sistema com clínicas, profissionais, agenda, relatórios e um mês
    já faturado — para apresentar as telas cheias antes de a operação real
    existir.</p>

    <h2>No banco agora</h2>
    ${temDados ? tabelaResumo(resumo) : "<p>Nenhum dado de demonstração.</p>"}

    <h2>O que isto faz</h2>
    <ul>
      <li>Tudo que cria tem identificador começando em <code>demo-</code>, e a
      limpeza apaga exatamente isso — nada perto de um dado real.</li>
      <li>O catálogo de serviços e equipamentos <strong>não é alterado</strong>.
      O preço da demonstração entra como preço negociado das clínicas de
      demonstração, que é onde ele vive de verdade.</li>
      <li>Recriar limpa a anterior antes, então pode rodar quantas vezes quiser
      sem duplicar.</li>
    </ul>

    ${botoes(chave, temDados)}
  `);
}

export async function POST(requisicao: Request) {
  const segredo = segredoConfigurado();
  const dados = await requisicao.formData();
  const chave = String(dados.get("key") ?? "");
  if (!segredo || chave !== segredo) return new Response("Not found", { status: 404 });

  const acao = String(dados.get("acao") ?? "");

  if (acao === "limpar") {
    const apagado = await limparDemo(prisma);
    return pagina(`
      <h1>Demonstração apagada</h1>
      <p>Saíram do banco:</p>
      ${tabelaResumo(apagado)}
      <p style="margin-top:1.5rem;"><a href="/api/demo?key=${encodeURIComponent(chave)}">← voltar</a></p>
    `);
  }

  if (acao !== "montar") return new Response("Not found", { status: 404 });

  let resumo: ResumoDemo;
  try {
    resumo = await montarDemo(prisma);
  } catch (erro) {
    return pagina(
      `<h1>Não deu para montar</h1>
       <p>${erro instanceof Error ? erro.message : String(erro)}</p>
       <p><a href="/api/demo?key=${encodeURIComponent(chave)}">← voltar</a></p>`,
      500
    );
  }

  return pagina(`
    <h1>Demonstração pronta</h1>
    ${tabelaResumo(resumo)}

    <h2>Acessos para mostrar os três perfis</h2>
    <div class="credencial">
      <strong>Equipe:</strong> equipe@demo.hemoderi.com.br<br />
      <strong>Clínica:</strong> clinica@demo.hemoderi.com.br<br />
      <strong>Profissional:</strong> profissional@demo.hemoderi.com.br<br />
      <strong>Senha das três:</strong> <code>${SENHA_DEMO}</code>
    </div>
    <p style="margin-top:.75rem;">Seu acesso real continua funcionando normalmente,
    e enxerga tudo — inclusive a demonstração.</p>

    <p style="margin-top:1.5rem;"><a href="/login">Ir para o sistema →</a></p>

    <div class="aviso">
      <strong>Quando a apresentação acabar:</strong> volte aqui e use
      <em>Apagar os dados de demonstração</em>, e depois remova a variável
      <code>DEMO_SECRET</code> do ambiente. Enquanto ela existir, quem tiver o
      link consegue recriar ou apagar a demonstração.
    </div>
  `);
}
