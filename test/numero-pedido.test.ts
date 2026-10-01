import { test } from "node:test";
import assert from "node:assert/strict";
import { proximoNumeroDePedido } from "../src/lib/numero-pedido";

/** Um `tx` mínimo: o contador de Parametros e o maior número já gravado em Pedido. */
function bancoFalso(contador: number, maiorNumero: number | null) {
  const estado = { contador };
  const tx = {
    parametros: {
      update: async ({ data }: { data: { proximoNumeroPedido: number | { increment: number } } }) => {
        const novo = data.proximoNumeroPedido;
        estado.contador = typeof novo === "number" ? novo : estado.contador + novo.increment;
        return { proximoNumeroPedido: estado.contador };
      },
    },
    pedido: { aggregate: async () => ({ _max: { numero: maiorNumero } }) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dublê mínimo do cliente de transação.
  } as any;
  return { tx, estado };
}

test("contador em dia: usa o número do contador e avança", async () => {
  const { tx, estado } = bancoFalso(9, 8);
  assert.equal(await proximoNumeroDePedido(tx), 9);
  assert.equal(estado.contador, 10);
});

test("banco novo, sem nenhum pedido: começa no 1", async () => {
  const { tx } = bancoFalso(1, null);
  assert.equal(await proximoNumeroDePedido(tx), 1);
});

test("contador ATRÁS do maior número usado: pula para o maior + 1 e se realinha", async () => {
  // O caso de 01/10: contador em 8 e o pedido 8 já existia.
  const { tx, estado } = bancoFalso(8, 8);
  assert.equal(await proximoNumeroDePedido(tx), 9);
  assert.equal(estado.contador, 10, "o próximo pedido não repete o 9");
});

test("dois pedidos seguidos nunca repetem número, mesmo com o contador defasado", async () => {
  const { tx } = bancoFalso(2, 7);
  const a = await proximoNumeroDePedido(tx);
  // Quem criou o pedido grava o número; o maior passa a ser o que acabou de sair.
  const proximo = bancoFalso(2, a);
  const b = await proximoNumeroDePedido(proximo.tx);
  assert.notEqual(a, b);
});
