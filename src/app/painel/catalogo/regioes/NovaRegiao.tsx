"use client";

import { useState } from "react";
import { Campo, Rotulo } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { salvarRegiaoPreco } from "@/app/actions/cadastros";
import { UFS } from "@/lib/uf";

/**
 * Cadastro de uma praça: nome e as UFs que caem nela.
 *
 * As UFs são chips, não texto digitado — "SP, RG, MG" com um erro de digitação
 * criaria uma praça que não cobre estado nenhum, e o cadastro só reclamaria
 * quando alguém estranhasse o preço de uma clínica.
 */
export function NovaRegiao() {
  const [selecionadas, setSelecionadas] = useState<string[]>([]);

  function alternar(uf: string) {
    setSelecionadas((atuais) =>
      atuais.includes(uf) ? atuais.filter((u) => u !== uf) : [...atuais, uf]
    );
  }

  return (
    <FormularioAcao
      acao={salvarRegiaoPreco}
      botao="Criar praça"
      aoSalvar={() => setSelecionadas([])}
    >
      <input type="hidden" name="ufs" value={selecionadas.join(",")} />
      <div>
        <Rotulo>Nome da praça</Rotulo>
        <Campo name="nome" required placeholder="São Paulo e região" />
      </div>
      <div>
        <Rotulo>Estados desta praça</Rotulo>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {UFS.map((uf) => {
            const marcada = selecionadas.includes(uf);
            return (
              <button
                key={uf}
                type="button"
                onClick={() => alternar(uf)}
                aria-pressed={marcada}
                className={`text-[11px] font-semibold px-2.5 py-2 rounded-lg border ${
                  marcada
                    ? "bg-bordo text-white border-bordo"
                    : "bg-white text-gray-600 border-gray-300 hover:border-bordo/40"
                }`}
              >
                {uf}
              </button>
            );
          })}
        </div>
        <div className="text-[10px] text-gray-400 mt-1">
          {selecionadas.length === 0
            ? "Escolha ao menos um estado."
            : `${selecionadas.length} estado(s): ${selecionadas.join(", ")}`}
        </div>
      </div>
    </FormularioAcao>
  );
}
