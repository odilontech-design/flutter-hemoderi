import { prisma } from "@/lib/prisma";

// Rota de dados vivos: nunca pré-renderizada no build.
export const dynamic = "force-dynamic";

/**
 * Verificação de saúde, para conferir um deploy em segundos.
 *
 * Responde se o banco atende e se o schema já foi migrado — que é a diferença
 * entre "a aplicação subiu" e "a aplicação funciona". Deploy novo com banco
 * vazio sobe normalmente e só quebra na primeira tela; aqui isso aparece na
 * hora.
 *
 * Não devolve contagem de pedidos, nomes nem nada da operação: é rota pública
 * e serve para monitoramento, não para conferir movimento.
 */
export async function GET() {
  try {
    const [{ existe }] = await prisma.$queryRaw<{ existe: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'Pedido'
      ) AS existe
    `;

    if (!existe) {
      return Response.json(
        { ok: false, banco: "conectado", schema: "ausente", detalhe: "rode as migrations" },
        { status: 503 }
      );
    }

    return Response.json({ ok: true, banco: "conectado", schema: "aplicado" });
  } catch (erro) {
    return Response.json(
      { ok: false, banco: "inacessível", detalhe: erro instanceof Error ? erro.message : "erro" },
      { status: 503 }
    );
  }
}
