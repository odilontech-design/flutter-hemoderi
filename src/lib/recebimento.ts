import { ajudaCustoEmCentavos } from "./relatorio";

/**
 * O que o profissional recebeu da clínica NO ATO do atendimento (ata de
 * 05/10): se recebeu, quanto (total ou parcial), de que forma e, quando a
 * forma deixa rastro eletrônico, o comprovante. É declaração do profissional,
 * conferida pelo pós-venda — e é o que faz o histórico do cliente mostrar
 * "pago" sem esperar a fatura.
 */
export const SITUACOES_RECEBIMENTO = [
  { valor: "NAO", rotulo: "Não recebeu" },
  { valor: "TOTAL", rotulo: "Recebeu o valor total" },
  { valor: "PARCIAL", rotulo: "Recebeu parte do valor" },
] as const;

export type SituacaoRecebimento = (typeof SITUACOES_RECEBIMENTO)[number]["valor"];

export const FORMAS_RECEBIMENTO = [
  { valor: "PIX", rotulo: "Pix", exigeComprovante: true },
  { valor: "DINHEIRO", rotulo: "Dinheiro", exigeComprovante: false },
  { valor: "CHEQUE", rotulo: "Cheque", exigeComprovante: false },
  { valor: "CARTAO", rotulo: "Cartão de crédito", exigeComprovante: true },
] as const;

export type FormaRecebimento = (typeof FORMAS_RECEBIMENTO)[number]["valor"];

export function rotuloDaSituacao(valor: string | null | undefined): string {
  return SITUACOES_RECEBIMENTO.find((s) => s.valor === valor)?.rotulo ?? "Não informado";
}

export function rotuloDaForma(valor: string | null | undefined): string {
  return FORMAS_RECEBIMENTO.find((f) => f.valor === valor)?.rotulo ?? "—";
}

export const LIMITE_COMPROVANTE_BYTES = 3 * 1024 * 1024;
export const TIPOS_DE_COMPROVANTE = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export function comprovanteAceito(arquivo: { type: string; size: number }): string | null {
  if (!(TIPOS_DE_COMPROVANTE as readonly string[]).includes(arquivo.type)) {
    return "O comprovante precisa ser uma foto (JPG, PNG) ou um PDF.";
  }
  if (arquivo.size > LIMITE_COMPROVANTE_BYTES) {
    return "O comprovante passou de 3 MB. Tire uma foto menor ou envie o PDF do banco.";
  }
  return null;
}

export type RecebimentoLido = {
  recebimento: SituacaoRecebimento;
  formaRecebimento: FormaRecebimento | null;
  valorRecebidoCentavos: number | null;
  /** O comprovante é obrigatório para esta resposta. */
  exigeComprovante: boolean;
};

/**
 * Lê e confere o bloco de recebimento do relatório.
 *
 * - "Não recebeu": nada mais é pedido; forma e valor são descartados.
 * - Recebeu (total ou parcial): a forma é obrigatória.
 * - Dinheiro e recebimento parcial: o valor exato é obrigatório — é o que a
 *   equipe confere contra a clínica, e dinheiro não deixa outro rastro.
 * - Pix e cartão: comprovante obrigatório (a checagem do arquivo é feita fora,
 *   porque depende de haver um comprovante já salvo de um envio anterior).
 */
export function lerRecebimento(entrada: {
  situacao: string;
  forma: string;
  valor: string;
}): { ok: true; dados: RecebimentoLido } | { ok: false; erro: string } {
  const situacao = SITUACOES_RECEBIMENTO.find((s) => s.valor === entrada.situacao)?.valor;
  if (!situacao) {
    return { ok: false, erro: "Informe se você recebeu o valor da clínica no atendimento." };
  }
  if (situacao === "NAO") {
    return {
      ok: true,
      dados: { recebimento: "NAO", formaRecebimento: null, valorRecebidoCentavos: null, exigeComprovante: false },
    };
  }

  const forma = FORMAS_RECEBIMENTO.find((f) => f.valor === entrada.forma);
  if (!forma) return { ok: false, erro: "Informe a forma de pagamento que você recebeu." };

  const valor = ajudaCustoEmCentavos(entrada.valor);
  if (valor === undefined) return { ok: false, erro: "Valor recebido: use só números, como 350,00." };
  const exigeValor = forma.valor === "DINHEIRO" || situacao === "PARCIAL";
  if (exigeValor && !valor) {
    return {
      ok: false,
      erro:
        situacao === "PARCIAL"
          ? "Recebimento parcial: informe o valor exato que você recebeu."
          : "Dinheiro: informe o valor exato que você recebeu.",
    };
  }

  return {
    ok: true,
    dados: {
      recebimento: situacao,
      formaRecebimento: forma.valor,
      valorRecebidoCentavos: valor ?? null,
      exigeComprovante: forma.exigeComprovante,
    },
  };
}

/** O profissional declarou ter recebido o valor total no ato — o cliente vê "pago". */
export function recebidoNoAto(recebimento: string | null | undefined): boolean {
  return recebimento === "TOTAL";
}
