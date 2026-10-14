"use client";

import { useState } from "react";
import { responderNps } from "@/app/actions/nps";
import { FormularioAcao } from "@/components/FormularioAcao";
import { Area, Botao, Rotulo } from "@/components/ui";
import { LIMITE_TEXTO_NPS, NOTA_NPS_MAXIMA, NOTA_NPS_MINIMA } from "@/lib/nps";
import { PERGUNTAS_ABERTAS } from "@/lib/avaliacao";

const NOTAS = Array.from({ length: NOTA_NPS_MAXIMA - NOTA_NPS_MINIMA + 1 }, (_, i) => NOTA_NPS_MINIMA + i);

/** Faixa clássica do NPS: 0–6 detrator, 7–8 neutro, 9–10 promotor. */
function corDaNota(n: number, escolhida: boolean): string {
  if (n <= 6) return escolhida ? "bg-red-600 text-white border-red-600" : "border-red-200 text-red-700 hover:border-red-400";
  if (n <= 8) return escolhida ? "bg-amber-500 text-white border-amber-500" : "border-amber-200 text-amber-700 hover:border-amber-400";
  return escolhida ? "bg-green-600 text-white border-green-600" : "border-green-200 text-green-700 hover:border-green-400";
}

/**
 * A pergunta clássica de NPS ("de 0 a 10, o quanto você recomendaria…"), com
 * três perguntas abertas — as mesmas da avaliação (ata de 13/10): o que mais
 * gostou, o que menos gostou e o que pode melhorar. A escala ganhou as cores
 * das faixas do NPS, para a clínica ver que 7 não é "nota boa". Aparece uma vez a cada 60 dias — bem mais raro que
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
              className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg text-xs font-semibold border transition-colors ${corDaNota(n, nota === n)}`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>0 · nada provável</span>
          <span>10 · com certeza</span>
        </div>
      </div>

      <div className="text-[10px] text-gray-400">As perguntas abaixo são opcionais.</div>
      {PERGUNTAS_ABERTAS.map(({ campo, pergunta }) => (
        <div key={campo}>
          <Rotulo>{pergunta}</Rotulo>
          {/* No NPS o "menos gostou" grava na coluna antiga de expectativas não atendidas. */}
          <Area name={campo === "pontosNegativos" ? "expectativasNaoAtendidas" : campo} rows={2} maxLength={LIMITE_TEXTO_NPS} />
        </div>
      ))}
    </FormularioAcao>
  );
}
