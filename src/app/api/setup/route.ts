import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { inicializarCatalogo } from "@/lib/inicializar";

// Rota de configuração inicial: nunca pré-renderizada.
export const dynamic = "force-dynamic";

/**
 * Configuração inicial de produção — carrega o catálogo real e cria o
 * primeiro acesso interno, sem precisar de terminal nem de acesso direto ao
 * banco. Existe porque nem sempre quem conduz o deploy tem como rodar
 * `npm run db:seed`/`db:usuario` contra o banco de produção — mas o próprio
 * servidor da aplicação sempre tem.
 *
 * Autoproteção, não convite permanente: exige SETUP_SECRET (gerado só para
 * este momento) E se tranca sozinha assim que existe qualquer usuário
 * INTERNO — não é uma porta que fica aberta esperando alguém achar a chave.
 * Outros acessos internos, depois do primeiro, se criam pela tela normal
 * (/painel/acessos), já dentro do sistema.
 */

function segredoConfigurado(): string | null {
  const segredo = process.env.SETUP_SECRET;
  return segredo && segredo.length >= 16 ? segredo : null;
}

function pagina(corpo: string, status = 200): Response {
  return new Response(
    `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Configuração inicial — Hemoderi</title>
<style>
  body { font-family: system-ui, sans-serif; background: #faf5f2; color: #241412; margin: 0; padding: 2rem 1rem; }
  .cartao { max-width: 420px; margin: 3rem auto; background: white; border: 1px solid #e5e5e5; border-radius: 16px; padding: 2rem; }
  h1 { font-size: 1.1rem; color: #9C3A32; margin: 0 0 .25rem; }
  p { font-size: .85rem; color: #555; line-height: 1.5; }
  label { display: block; font-size: .75rem; font-weight: 600; margin: 1rem 0 .25rem; }
  input { width: 100%; box-sizing: border-box; padding: .6rem .75rem; border: 1px solid #ccc; border-radius: 8px; font-size: .9rem; }
  button { margin-top: 1.5rem; width: 100%; padding: .75rem; background: #9C3A32; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: .85rem; cursor: pointer; }
  button:hover { background: #6E2620; }
  a { color: #9C3A32; }
  .erro { color: #c0243f; font-size: .8rem; margin-top: .5rem; }
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

async function jaInicializado(): Promise<boolean> {
  const alguem = await prisma.usuario.findFirst({ where: { papel: "INTERNO" }, select: { id: true } });
  return Boolean(alguem);
}

export async function GET(requisicao: Request) {
  const segredo = segredoConfigurado();
  const chave = new URL(requisicao.url).searchParams.get("key");

  // Sem SETUP_SECRET configurado, ou chave errada: finge que a rota não
  // existe. Não é o lugar de dizer "chave incorreta" para quem está só
  // tentando adivinhar.
  if (!segredo || chave !== segredo) {
    return new Response("Not found", { status: 404 });
  }

  if (await jaInicializado()) {
    return pagina(`
      <h1>Já configurado</h1>
      <p>Esta operação já tem pelo menos um acesso interno. Para criar mais acessos
      (equipe, clínicas, profissionais), entre no sistema e use a tela
      <strong>Acessos</strong>.</p>
      <p><a href="/login">Ir para o login →</a></p>
      <p style="margin-top:2rem;color:#999;">Por segurança, remova a variável <code>SETUP_SECRET</code>
      do ambiente agora que não é mais necessária.</p>
    `);
  }

  return pagina(`
    <h1>Configuração inicial</h1>
    <p>Isto carrega o catálogo real da Hemoderi (serviços e equipamentos) e cria
    o primeiro acesso da equipe interna. Só funciona uma vez.</p>
    <form method="post" action="/api/setup">
      <input type="hidden" name="key" value="${chave}" />
      <label>Seu nome</label>
      <input type="text" name="nome" required autoFocus />
      <label>E-mail de acesso</label>
      <input type="email" name="email" required />
      <label>Senha (mínimo 8 caracteres)</label>
      <input type="password" name="senha" minlength="8" required />
      <button type="submit">Configurar e criar acesso</button>
    </form>
  `);
}

export async function POST(requisicao: Request) {
  const segredo = segredoConfigurado();
  const dados = await requisicao.formData();
  const chave = String(dados.get("key") ?? "");

  if (!segredo || chave !== segredo) {
    return new Response("Not found", { status: 404 });
  }

  if (await jaInicializado()) {
    return pagina(`<h1>Já configurado</h1><p><a href="/login">Ir para o login →</a></p>`);
  }

  const nome = String(dados.get("nome") ?? "").trim();
  const email = String(dados.get("email") ?? "")
    .toLowerCase()
    .trim();
  const senha = String(dados.get("senha") ?? "");

  if (!nome || !email || senha.length < 8) {
    return pagina(
      `<h1>Configuração inicial</h1><p class="erro">Preencha nome, e-mail e uma senha com pelo menos 8 caracteres.</p><p><a href="/api/setup?key=${encodeURIComponent(chave)}">← voltar</a></p>`,
      400
    );
  }

  const { equipamentosCriados, servicosCriados } = await inicializarCatalogo(prisma);

  await prisma.usuario.create({
    data: { nome, email, senhaHash: await bcrypt.hash(senha, 10), papel: "INTERNO" },
  });

  return pagina(`
    <h1>Tudo pronto</h1>
    <p>Catálogo carregado: ${servicosCriados} serviços e ${equipamentosCriados} equipamentos.</p>
    <p>Acesso criado para <strong>${email}</strong>.</p>
    <p><a href="/login">Entrar agora →</a></p>
    <p style="margin-top:2rem;color:#999;">Por segurança, remova a variável <code>SETUP_SECRET</code>
    do ambiente agora que não é mais necessária — esta rota se tranca sozinha,
    mas não custa nada tirar a chave de circulação.</p>
  `);
}
