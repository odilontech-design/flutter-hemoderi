"use client";

import { useState, useTransition } from "react";
import { cartaoEmLote } from "@/app/actions/cobrancas";
import { formatarReais } from "@/lib/dinheiro";

/**
 * Cartão de crédito pelo Asaas (ata de 03/11): à vista ou em até 12x, com os
 * juros do parcelamento por conta do cliente — o total de cada opção aparece
 * antes de escolher. O cartão é digitado na página segura do Asaas.
 */
export function PagarComCartao({ pedidoIds, valorCentavos, juros }: { pedidoIds: string[]; valorCentavos: number; juros: number[] }) {
  const [parcelas, setParcelas] = useState(1);
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  const total = (n: number) => Math.round(valorCentavos * (1 + (juros[n - 1] ?? 0) / 100));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-xs font-semibold text-gray-800 mb-2">Pagar com cartão de crédito</div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Parcelas"
          value={parcelas}
          onChange={(e) => setParcelas(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-2 py-2 text-xs bg-white min-h-[40px] sm:min-h-0"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n === 1 ? `À vista · ${formatarReais(total(1))}` : `${n}x de ${formatarReais(Math.round(total(n) / n))} · total ${formatarReais(total(n))}`}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pendente}
          onClick={() => {
            setErro("");
            iniciar(async () => {
              const r = await cartaoEmLote(pedidoIds, parcelas);
              if (r.ok && r.link) window.location.href = r.link;
              else setErro(r.erro ?? "Não foi possível abrir o pagamento.");
            });
          }}
          className="bg-bordo text-white text-xs font-semibold px-4 py-2 rounded-lg min-h-[40px] sm:min-h-0 disabled:opacity-50"
        >
          {pendente ? "Abrindo…" : "Pagar com cartão"}
        </button>
      </div>
      {parcelas > 1 && (juros[parcelas - 1] ?? 0) > 0 && (
        <div className="text-[10px] text-gray-500 mt-1">Inclui os juros do parcelamento.</div>
      )}
      <div className="text-[10px] text-gray-400 mt-1">Você digita o cartão na página segura do Asaas e volta para cá depois.</div>
      {erro && <div className="text-[11px] text-red-600 mt-1">{erro}</div>}
    </div>
  );
}
