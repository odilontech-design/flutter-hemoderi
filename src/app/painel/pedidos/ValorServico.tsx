"use client";

import { useState, useTransition } from "react";
import { definirValorServico } from "@/app/actions/pedidos";
import { formatarReais } from "@/lib/dinheiro";

/**
 * O valor do serviço, editável direto na linha da esteira.
 *
 * Existe porque o preço de tabela pode nascer "a negociar" (sem
 * PrecoClinica nem valorPadrao — ver `valorDoServico` em actions/pedidos.ts),
 * e aí o pedido chega com R$ 0,00 sem nenhum lugar para corrigir — nem na
 * alocação, nem depois dela. Um clique no próprio valor abre a edição, do
 * mesmo jeito que a condição de pagamento já funciona ao lado.
 */
export function ValorServico({ pedidoId, valorCentavos }: { pedidoId: string; valorCentavos: number }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(() => (valorCentavos / 100).toFixed(2).replace(".", ","));
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");

  function salvar() {
    setErro("");
    iniciar(async () => {
      const resultado = await definirValorServico(pedidoId, texto);
      if (!resultado.ok) setErro(resultado.erro ?? "Não salvou.");
      else setEditando(false);
    });
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => {
          setTexto((valorCentavos / 100).toFixed(2).replace(".", ","));
          setEditando(true);
        }}
        title="Clique para ajustar o valor"
        className={`text-xs font-semibold hover:underline ${
          valorCentavos > 0 ? "text-bordo" : "text-amber-700"
        }`}
      >
        {formatarReais(valorCentavos)}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          inputMode="decimal"
          value={texto}
          disabled={pendente}
          onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter") salvar();
            if (evento.key === "Escape") setEditando(false);
          }}
          onBlur={salvar}
          className="w-20 text-xs text-right rounded-md border border-gray-300 px-1.5 py-1 outline-none focus:border-bordo"
        />
      </span>
      {erro && <span className="text-[10px] text-red-600">{erro}</span>}
    </span>
  );
}
