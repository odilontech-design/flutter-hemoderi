"use client";

import { useState } from "react";

export type GrupoDeServicos = { familia: string; servicos: { id: string; nome: string }[] };

/**
 * Os serviços que o profissional está apto a prestar (ata de 02/10), na mesma
 * ordem de categorias do catálogo. Cada categoria abre e fecha; o contador
 * mostra quantos há marcados sem precisar abrir tudo.
 *
 * Nenhum marcado quer dizer "ainda não configurado": o profissional continua
 * alocável a qualquer serviço (ver lib/aptidao.ts).
 */
export function ServicosAptos({
  grupos,
  selecionados,
}: {
  grupos: GrupoDeServicos[];
  selecionados: string[];
}) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set(selecionados));

  function alternar(id: string, ligado: boolean) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (ligado) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }

  return (
    <div>
      <div className="text-[11px] font-semibold text-gray-600 mb-1">
        Serviços que está apto a prestar{marcados.size > 0 ? ` · ${marcados.size} marcado(s)` : ""}
      </div>
      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-72 overflow-y-auto">
        {grupos.map((grupo) => {
          const quantos = grupo.servicos.filter((s) => marcados.has(s.id)).length;
          return (
            <details key={grupo.familia} className="group">
              <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2 text-xs list-none [&::-webkit-details-marker]:hidden">
                <span className="font-semibold text-bordo">{grupo.familia}</span>
                <span className="text-[10px] text-gray-400 shrink-0">
                  {quantos > 0 ? `${quantos}/${grupo.servicos.length}` : grupo.servicos.length} ▾
                </span>
              </summary>
              <div className="px-3 pb-2 space-y-1">
                {grupo.servicos.map((servico) => (
                  <label key={servico.id} className="flex items-start gap-2 text-[11px] text-gray-700">
                    <input
                      type="checkbox"
                      name="servicosAptosIds"
                      value={servico.id}
                      checked={marcados.has(servico.id)}
                      onChange={(e) => alternar(servico.id, e.target.checked)}
                      className="mt-0.5"
                    />
                    {servico.nome}
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>
      <div className="text-[10px] text-gray-400 mt-1">
        Define para quais serviços ele aparece na alocação. Sem nenhum marcado, pode ser alocado a qualquer um.
      </div>
    </div>
  );
}
