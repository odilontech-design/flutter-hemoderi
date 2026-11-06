/**
 * Condições de pagamento que a operação usa.
 *
 * Mora aqui, e NÃO em actions/pedidos.ts, por um motivo que só aparece em
 * produção: num arquivo "use server" todo export vira uma referência de
 * server action. Uma constante exportada de lá chega ao navegador como
 * função, não como array — e a tela quebra com "map is not a function",
 * depois de compilar e passar no typecheck sem uma palavra.
 *
 * Lista fechada de propósito: o campo é lido no fechamento do mês, e texto
 * livre viraria "faturado", "Faturado", "mensal" e "fiado" significando a
 * mesma coisa.
 */
export const CONDICOES_PAGAMENTO = [
  "Antecipado",
  "No ato do atendimento",
  "Faturado no mês",
  "Cortesia",
] as const;

export type CondicaoPagamento = (typeof CONDICOES_PAGAMENTO)[number];

export function condicaoValida(valor: string): valor is CondicaoPagamento {
  return (CONDICOES_PAGAMENTO as readonly string[]).includes(valor);
}

/**
 * Como o CLIENTE paga o atendimento — o que ele escolhe ao agendar (ata de
 * 02/10). Pix, cartão de crédito (Asaas), dinheiro e cheque.
 *
 * Não confundir com `CONDICOES_PAGAMENTO`, o acordo interno da operação com a
 * clínica (antecipado, faturado…), que o cliente não vê.
 */
export const FORMAS_DE_PAGAMENTO = ["Pix", "Cartão de crédito", "Dinheiro", "Cheque"] as const;

/** A escolha que leva ao pagamento com cartão pelo Asaas (à vista ou parcelado). */
export const FORMA_CARTAO = "Cartão de crédito";

export type FormaDePagamento = (typeof FORMAS_DE_PAGAMENTO)[number];

export function formaDePagamentoValida(valor: string): valor is FormaDePagamento {
  return (FORMAS_DE_PAGAMENTO as readonly string[]).includes(valor);
}

/**
 * Texto da cobrança (Asaas e Pix): os serviços exatamente como foram
 * contratados, com a data. Agrupa repetidos ("Membranas – PRF (2 pacientes)")
 * e corta no limite do meio de pagamento, sem quebrar no meio de um item.
 */
export function descricaoDaCobranca(
  pedidos: { servicoNome: string; data: string }[],
  clinicaNome: string,
  limite: number
): string {
  const grupos = new Map<string, { nome: string; datas: Set<string>; n: number }>();
  for (const p of pedidos) {
    const g = grupos.get(p.servicoNome) ?? { nome: p.servicoNome, datas: new Set<string>(), n: 0 };
    g.n += 1;
    g.datas.add(p.data);
    grupos.set(p.servicoNome, g);
  }
  const itens = [...grupos.values()].map((g) => {
    const datas = [...g.datas].sort().join(", ");
    return `${g.nome}${g.n > 1 ? ` x${g.n}` : ""} (${datas})`;
  });
  const cabecalho = `Hemoderi - ${clinicaNome}: `;
  let texto = cabecalho;
  let usados = 0;
  for (const item of itens) {
    const proximo = (usados ? texto + "; " : texto) + item;
    const resto = itens.length - usados - 1;
    const sufixo = resto > 0 ? ` e mais ${resto}` : "";
    if (proximo.length + sufixo.length > limite && usados > 0) break;
    texto = proximo;
    usados += 1;
  }
  if (usados < itens.length) texto += ` e mais ${itens.length - usados}`;
  return texto.slice(0, limite);
}
