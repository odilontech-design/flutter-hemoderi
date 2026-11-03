"use client";

import { useState } from "react";
import Link from "next/link";
import { formatarReais } from "@/lib/dinheiro";
import { PagarComPix } from "../resumo/PagarComPix";
import { PagarComCartao } from "../PagarComCartao";

type Pendencia = { chave: string; data: string; servicos: string; valorCentavos: number; pedidoIds: string[]; resumoId: string; naFatura: boolean };

/**
 * Pagamentos pendentes com seleção (ata de 03/11): a clínica marca os
 * atendimentos e paga todos num Pix só. Atendimento já em fatura fica fora do
 * lote — a fatura tem o Pix dela.
 */
export function PagarPendencias({ pendencias, cartao }: { pendencias: Pendencia[]; cartao?: { juros: number[] } | null }) {
  const pagaveis = pendencias.filter((p) => !p.naFatura);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(pagaveis.map((p) => p.chave)));
  const [pagar, setPagar] = useState<string[] | null>(null);
  const selecionadas = pagaveis.filter((p) => marcados.has(p.chave));
  const total = selecionadas.reduce((t, p) => t + p.valorCentavos, 0);

  return (
    <div>
      <ul className="divide-y divide-rose-100 text-xs">
        {pendencias.map((p) => (
          <li key={p.chave} className="py-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-gray-700 min-w-0">
              <input
                type="checkbox"
                disabled={p.naFatura || pagar !== null}
                checked={!p.naFatura && marcados.has(p.chave)}
                onChange={(e) =>
                  setMarcados((atual) => {
                    const novo = new Set(atual);
                    if (e.target.checked) novo.add(p.chave);
                    else novo.delete(p.chave);
                    return novo;
                  })
                }
                className="accent-bordo"
              />
              <span className="min-w-0">
                <strong>{p.data}</strong> · {p.servicos}
                {p.naFatura && <span className="block text-[10px] text-gray-500">na fatura do mês — pague pela fatura</span>}
              </span>
            </label>
            <span className="flex items-center gap-3">
              <strong className="text-bordo">{formatarReais(p.valorCentavos)}</strong>
              <Link href={`/portal/resumo/${p.resumoId}`} className="font-semibold text-bordo hover:underline">
                Ver resumo
              </Link>
            </span>
          </li>
        ))}
      </ul>

      {pagaveis.length > 0 && pagar === null && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={selecionadas.length === 0}
            onClick={() => setPagar(selecionadas.flatMap((p) => p.pedidoIds))}
            className="bg-bordo text-white text-xs font-semibold px-4 py-2 rounded-lg min-h-[40px] sm:min-h-0 disabled:opacity-50"
          >
            Pagar {selecionadas.length} selecionado{selecionadas.length === 1 ? "" : "s"} com um Pix · {formatarReais(total)}
          </button>
        </div>
      )}
      {cartao && pagaveis.length > 0 && pagar === null && selecionadas.length > 0 && (
        <div className="mt-3 max-w-md">
          <PagarComCartao pedidoIds={selecionadas.flatMap((p) => p.pedidoIds)} valorCentavos={total} juros={cartao.juros} />
        </div>
      )}
      {pagar && (
        <div className="mt-3 max-w-sm">
          <PagarComPix pedidoId={pagar[0]} pedidoIds={pagar} valorCentavos={total} pagoEm={null} disponivel />
          <button type="button" onClick={() => setPagar(null)} className="mt-2 text-[11px] font-semibold text-gray-500 hover:underline">
            Voltar e mudar a seleção
          </button>
        </div>
      )}
    </div>
  );
}
