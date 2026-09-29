import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { etapaDoPerfil } from "@/lib/esteira";

// Consulta de estado da fila: nunca pré-renderizada nem cacheada.
export const dynamic = "force-dynamic";

/**
 * Quanto trabalho está parado na fila de quem perguntou.
 *
 * Existe para o aviso do painel (ata de 28/09: "notificações em pop-up no
 * sistema interno para alertar a equipe sobre novas tarefas"). É uma rota
 * própria, e não um dado da página, porque a pergunta se repete enquanto a
 * pessoa trabalha em outra tela — recarregar a esteira inteira a cada minuto
 * para descobrir um número seria caro e ainda tiraria a pessoa do lugar.
 *
 * Devolve o instante da movimentação mais recente, não só o total: é ele que
 * distingue "chegou coisa nova" de "continua o mesmo trabalho de antes". Um
 * contador sozinho não serve — a fila pode receber um pedido e perder outro
 * no mesmo intervalo, e o total ficaria igual enquanto algo novo esperava.
 *
 * `atualizadoEm`, e não `criadoEm`: o pedido entra na fila da logística
 * quando o comercial o confirma, e nesse momento ele não é novo — mudou de
 * etapa. Quem olha a fila da alocação quer saber disso.
 */
export async function GET() {
  const sessao = await exigirInterno();
  const etapa = etapaDoPerfil(sessao.perfil);

  const [total, maisRecente] = await Promise.all([
    prisma.pedido.count({ where: etapa.onde }),
    prisma.pedido.findFirst({
      where: etapa.onde,
      orderBy: { atualizadoEm: "desc" },
      select: { atualizadoEm: true },
    }),
  ]);

  return Response.json({
    etapa: etapa.chave,
    rotulo: etapa.rotulo,
    // Só a fila que tem dono é "sua": gestão e responsável abrem numa visão
    // geral, e avisar "chegou trabalho seu" para quem supervisiona tudo
    // transformaria o aviso em ruído constante.
    propria: Boolean(etapa.dono),
    total,
    movimentadoEm: maisRecente?.atualizadoEm.toISOString() ?? null,
  });
}
