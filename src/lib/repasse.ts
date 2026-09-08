/**
 * Quanto a Hemoderi deve ao profissional por um atendimento.
 *
 * A cadeia de regras existe porque o combinado não é único: há o percentual
 * geral da operação, serviços em que a Hemoderi banca o insumo e por isso
 * repassa menos, profissionais com percentual próprio e, de vez em quando, um
 * acerto específico de um profissional em um serviço.
 *
 * Ordem, do mais específico para o mais genérico:
 *
 *   1. RegraRepasse (profissional × serviço) — o acerto individual.
 *   2. Serviço — a exceção existe justamente porque a estrutura de custo
 *      daquele procedimento é diferente; ela vence o percentual genérico do
 *      profissional. Quem precisar furar isso registra a regra do par (1).
 *   3. Percentual padrão do profissional.
 *   4. Percentual padrão da operação (Parametros).
 *
 * A primeira regra que responder decide, e a função devolve QUAL respondeu:
 * quando o profissional questiona o valor, a resposta precisa ser "veio da
 * sua regra específica", não um número sem origem.
 */

import { aplicarPercent } from "@/lib/dinheiro";

export type OrigemRepasse = "REGRA_ESPECIFICA" | "SERVICO" | "PROFISSIONAL" | "PADRAO";

export type EntradaRepasse = {
  valorServicoCentavos: number;
  regra?: { percent: number | null; fixoCentavos: number | null } | null;
  servico?: { repassePercent: number | null; repasseFixoCentavos: number | null } | null;
  profissional?: { repassePercentPadrao: number | null } | null;
  percentPadrao: number;
};

export type ResultadoRepasse = {
  valorCentavos: number;
  origem: OrigemRepasse;
  /** Nulo quando a regra aplicada é de valor fixo. */
  percent: number | null;
};

export function calcularRepasse(entrada: EntradaRepasse): ResultadoRepasse {
  const { valorServicoCentavos, regra, servico, profissional, percentPadrao } = entrada;

  if (regra) {
    if (regra.fixoCentavos != null) {
      return { valorCentavos: regra.fixoCentavos, origem: "REGRA_ESPECIFICA", percent: null };
    }
    if (regra.percent != null) {
      return {
        valorCentavos: aplicarPercent(valorServicoCentavos, regra.percent),
        origem: "REGRA_ESPECIFICA",
        percent: regra.percent,
      };
    }
  }

  if (servico) {
    if (servico.repasseFixoCentavos != null) {
      return { valorCentavos: servico.repasseFixoCentavos, origem: "SERVICO", percent: null };
    }
    if (servico.repassePercent != null) {
      return {
        valorCentavos: aplicarPercent(valorServicoCentavos, servico.repassePercent),
        origem: "SERVICO",
        percent: servico.repassePercent,
      };
    }
  }

  if (profissional?.repassePercentPadrao != null) {
    return {
      valorCentavos: aplicarPercent(valorServicoCentavos, profissional.repassePercentPadrao),
      origem: "PROFISSIONAL",
      percent: profissional.repassePercentPadrao,
    };
  }

  return {
    valorCentavos: aplicarPercent(valorServicoCentavos, percentPadrao),
    origem: "PADRAO",
    percent: percentPadrao,
  };
}

export const ROTULO_ORIGEM_REPASSE: Record<OrigemRepasse, string> = {
  REGRA_ESPECIFICA: "acerto específico deste profissional neste serviço",
  SERVICO: "regra do serviço",
  PROFISSIONAL: "percentual do profissional",
  PADRAO: "percentual padrão da operação",
};

/** Margem da operação no atendimento: o que a clínica paga menos o repasse. */
export function margemCentavos(valorServicoCentavos: number, valorRepasseCentavos: number): number {
  return valorServicoCentavos - valorRepasseCentavos;
}
