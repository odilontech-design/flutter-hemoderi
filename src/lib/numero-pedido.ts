import type { Prisma } from "@prisma/client";

/**
 * Numeração sequencial do pedido.
 *
 * Sai de dentro da mesma transação que cria o pedido: o `update` do contador
 * segura a linha de Parametros até o commit, então dois atendimentos ao mesmo
 * tempo nunca recebem o mesmo número. `numero` é único no banco para que uma
 * corrida vire erro visível em vez de dois pedidos com a mesma identidade.
 *
 * O contador ainda se corrige sozinho: se ele ficou ATRÁS do maior número já
 * usado (uma carga manual, um contador mexido à mão), o próximo número é o
 * maior + 1 e o contador é realinhado. Sem isso, o primeiro pedido depois do
 * descompasso estouraria o índice único e a clínica veria "Application error"
 * — foi exatamente o que aconteceu em 01/10.
 */
export async function proximoNumeroDePedido(tx: Prisma.TransactionClient): Promise<number> {
  const config = await tx.parametros.update({
    where: { id: "hemoderi" },
    data: { proximoNumeroPedido: { increment: 1 } },
    select: { proximoNumeroPedido: true },
  });
  const numero = config.proximoNumeroPedido - 1;

  const maior = await tx.pedido.aggregate({ _max: { numero: true } });
  const ultimoUsado = maior._max.numero ?? 0;
  if (numero > ultimoUsado) return numero;

  const corrigido = ultimoUsado + 1;
  await tx.parametros.update({
    where: { id: "hemoderi" },
    data: { proximoNumeroPedido: corrigido + 1 },
  });
  return corrigido;
}
