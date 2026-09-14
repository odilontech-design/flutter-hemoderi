"use client";

import { useState, useTransition } from "react";
import { definirCondicaoPagamento } from "@/app/actions/pedidos";
import { CONDICOES_PAGAMENTO } from "@/lib/pagamento";

/**
 * A condição de pagamento, editável direto na linha da esteira.
 *
 * Salva ao escolher, sem botão de confirmar: é um campo que o atendente
 * ajusta no meio de uma ligação, e um passo a mais aqui é o campo que fica
 * em branco.
 */
export function CondicaoPagamento({ pedidoId, atual }: { pedidoId: string; atual: string | null }) {
  const [valor, setValor] = useState(atual ?? "");
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        aria-label="Condição de pagamento"
        value={valor}
        disabled={pendente}
        onChange={(evento) => {
          const escolhido = evento.target.value;
          setValor(escolhido);
          setErro("");
          iniciar(async () => {
            const resultado = await definirCondicaoPagamento(pedidoId, escolhido);
            if (!resultado.ok) setErro(resultado.erro ?? "Não salvou.");
          });
        }}
        className={`text-[10px] rounded-md border px-1.5 py-1 outline-none focus:border-bordo
          ${valor ? "border-gray-300 text-gray-700" : "border-amber-300 bg-amber-50 text-amber-800"}`}
      >
        <option value="">pagamento a definir</option>
        {CONDICOES_PAGAMENTO.map((condicao) => (
          <option key={condicao} value={condicao}>
            {condicao}
          </option>
        ))}
      </select>
      {erro && <span className="text-[10px] text-red-600">{erro}</span>}
    </span>
  );
}
