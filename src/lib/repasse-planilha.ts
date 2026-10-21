import type { Celula } from "@/lib/xlsx-leitor";
import { PRACAS, type ChavePraca } from "@/lib/praca";

/**
 * Lê a aba "Repasses" da planilha que o pós-venda preenche (gerada em
 * 21/10): colunas A–D fixas (família, serviço, cobrança, valor), e para cada
 * praça três colunas — % do valor, ou fixo (R$), e o repasse calculado (que
 * aqui é ignorado). A linha EXEMPLO não entra. Percentual aceito como fração
 * (0,65, o que o Excel guarda em célula de %) ou como número (65).
 */
export type RegraDaPlanilha = {
  servico: string;
  praca: ChavePraca;
  percent: number | null;
  fixoCentavos: number | null;
  observacao: string | null;
};

export type LeituraDaPlanilha = { regras: RegraDaPlanilha[]; problemas: string[] };

const PRIMEIRA_COLUNA_DE_PRACA = 4; // E
const COLUNAS_POR_PRACA = 3;

function numero(v: Celula): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[R$\s%]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function lerRegrasDaPlanilha(linhas: Celula[][]): LeituraDaPlanilha {
  const regras: RegraDaPlanilha[] = [];
  const problemas: string[] = [];
  const colunaObs = PRIMEIRA_COLUNA_DE_PRACA + PRACAS.length * COLUNAS_POR_PRACA;

  linhas.forEach((linha, i) => {
    if (i < 2) return; // cabeçalho em duas linhas
    const familia = String(linha[0] ?? "").trim();
    const servico = String(linha[1] ?? "").trim();
    if (!servico || familia.toUpperCase() === "EXEMPLO") return;
    const observacao = String(linha[colunaObs] ?? "").trim() || null;

    PRACAS.forEach((praca, k) => {
      const col = PRIMEIRA_COLUNA_DE_PRACA + k * COLUNAS_POR_PRACA;
      const pct = numero(linha[col]);
      const fixo = numero(linha[col + 1]);
      if (pct == null && fixo == null) return;
      const percent = pct == null ? null : pct <= 1 ? Math.round(pct * 10000) / 100 : pct;
      if (percent != null && (percent < 0 || percent > 100)) {
        problemas.push(`Linha ${i + 1} (${servico}, ${praca.rotulo}): percentual ${percent}% fora de 0–100.`);
        return;
      }
      if (fixo != null && fixo < 0) {
        problemas.push(`Linha ${i + 1} (${servico}, ${praca.rotulo}): valor fixo negativo.`);
        return;
      }
      regras.push({
        servico,
        praca: praca.chave,
        // Fixo vence percentual quando os dois vierem (regra da planilha).
        percent: fixo != null ? null : percent,
        fixoCentavos: fixo != null ? Math.round(fixo * 100) : null,
        observacao,
      });
    });
  });

  return { regras, problemas };
}
