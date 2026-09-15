"use client";

import { useState } from "react";
import { responderNps } from "@/app/actions/nps";
import { FormularioAcao } from "@/components/FormularioAcao";
import { Area, Botao, Rotulo } from "@/components/ui";
import { LIMITE_TEXTO_NPS, NOTA_NPS_MAXIMA, NOTA_NPS_MINIMA } from "@/lib/nps";

const NOTAS = Array.from({ length: NOTA_NPS_MAXIMA - NOTA_NPS_MINIMA + 1 }, (_, i) => NOTA_NPS_MINIMA + i);

/**
 * A pergunta clássica de NPS ("de 0 a 10, o quanto você recomendaria…"), com
 * três perguntas abertas. Aparece uma vez a cada 60 dias — bem mais raro que
 * a avaliação por atendimento — e por isso o formulário vem sempre aberto,
 * sem o estado "fechado" que `AvaliarAtendimento` usa: não há paredão de
 * pendências a evitar quando só existe uma pesquisa por vez.
 */
export function ResponderNps({ pesquisaId }: { pesquisaId: string }) {
  const [nota, setNota] = useState<number | null>(null);

  return (
    <FormularioAcao acao={responderNps} botao="Enviar resposta" limparAoSalvar={false}>
      <input type="hidden" name="pesquisaId" value={pesquisaId} />
      <input type="hidden" name="nota" value={nota ?? ""} />

      <div>
        <Rotulo>De 0 a 10, o quanto você recomendaria a Hemoderi a um colega?</Rotulo>
        <div className="flex flex-wrap gap-1 mt-1">
          {NOTAS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNota(n)}
              aria-pressed={nota === n}
              className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-colors
                ${nota === n ? "bg-bordo text-white border-bordo" : "border-gray-300 hover:border-bordo/40"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>pouco provável</span>
          <span>com certeza</span>
        </div>
      </div>

      <div>
        <Rotulo>O que tem funcionado bem? (opcional)</Rotulo>
        <Area name="pontosPositivos" rows={2} maxLength={LIMITE_TEXTO_NPS} />
      </div>
      <div>
        <Rotulo>Alguma expectativa que não foi atendida? (opcional)</Rotulo>
        <Area name="expectativasNaoAtendidas" rows={2} maxLength={LIMITE_TEXTO_NPS} />
      </div>
      <div>
        <Rotulo>O que a gente poderia melhorar? (opcional)</Rotulo>
        <Area name="sugestoes" rows={2} maxLength={LIMITE_TEXTO_NPS} />
      </div>
    </FormularioAcao>
  );
}
