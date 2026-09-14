"use client";

import { useState } from "react";
import { NOTA_MAXIMA, ROTULO_NOTA } from "@/lib/avaliacao";

/**
 * As cinco estrelas, para escolher e para ler.
 *
 * Nota é um campo de formulário como qualquer outro: o componente guarda a
 * escolha em estado e publica num <input type="hidden">, para o formulário
 * continuar sendo um formulário HTML comum — é o que deixa a server action
 * ler `dados.get("nota")` sem cliente nenhum no meio.
 */
export function EscolherEstrelas({ name = "nota", inicial = 0 }: { name?: string; inicial?: number }) {
  const [nota, setNota] = useState(inicial);
  // Pré-visualização no hover: sem ela, quem usa mouse não sabe o que está
  // prestes a clicar até ter clicado.
  const [previa, setPrevia] = useState(0);
  const mostrando = previa || nota;

  return (
    // Largura fixa, e o rótulo NUNCA na mesma linha das estrelas.
    //
    // Não é estética: o rótulo muda de texto a cada hover ("toque para
    // avaliar" → "Muito bom" → "Excelente"), e cada texto tem uma largura. Ao
    // lado das estrelas dentro de uma célula de tabela, essa mudança re-larga
    // a coluna, desloca as estrelas na horizontal, o ponteiro cai na estrela
    // vizinha, o rótulo muda de novo — e as estrelas ficam oscilando sem
    // parar, impossíveis de clicar. Empilhado e com altura travada, mudar o
    // texto não mexe em layout nenhum.
    <div className="w-[212px] sm:w-[184px]">
      <input type="hidden" name={name} value={nota || ""} />
      <div className="flex items-center gap-1" onMouseLeave={() => setPrevia(0)}>
        {Array.from({ length: NOTA_MAXIMA }, (_, i) => i + 1).map((valor) => (
          <button
            key={valor}
            type="button"
            // 40px no celular porque a estrela é o alvo de toque principal
            // desta tela, e um alvo de 20px é onde a clínica dá 3 querendo
            // dar 4. Tamanho fixo (w/h, não min-w/min-h): a estrela cheia e a
            // vazia podem ter avanços diferentes na fonte, e o botão não pode
            // mudar de tamanho conforme o próprio conteúdo.
            className={`w-10 h-10 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center
              text-2xl sm:text-xl leading-none rounded transition-colors
              ${valor <= mostrando ? "text-amber-500" : "text-gray-300"} hover:text-amber-400`}
            aria-label={`${valor} de ${NOTA_MAXIMA} — ${ROTULO_NOTA[valor]}`}
            aria-pressed={valor === nota}
            onMouseEnter={() => setPrevia(valor)}
            onFocus={() => setPrevia(valor)}
            onBlur={() => setPrevia(0)}
            onClick={() => setNota(valor === nota ? 0 : valor)}
          >
            {valor <= mostrando ? "★" : "☆"}
          </button>
        ))}
      </div>
      <div className="text-[11px] text-gray-500 h-4 overflow-hidden whitespace-nowrap">
        {mostrando ? ROTULO_NOTA[mostrando] : "toque para avaliar"}
      </div>
    </div>
  );
}

/** Leitura: a nota já dada, sem interação. */
export function MostrarEstrelas({ nota, titulo }: { nota: number; titulo?: string }) {
  return (
    <span className="whitespace-nowrap text-amber-500" title={titulo ?? ROTULO_NOTA[nota]}>
      {"★".repeat(nota)}
      <span className="text-gray-300">{"☆".repeat(NOTA_MAXIMA - nota)}</span>
    </span>
  );
}
