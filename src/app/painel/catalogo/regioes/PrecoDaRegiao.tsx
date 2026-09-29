"use client";

import { useState, useTransition } from "react";
import { salvarPrecoRegiao } from "@/app/actions/cadastros";
import { formatarReais } from "@/lib/dinheiro";

/**
 * O preço de um serviço numa praça, editável na própria linha.
 *
 * Mesma interação do valor na esteira (ValorServico.tsx): trinta e quatro
 * serviços numa tela só, e abrir um formulário por linha seria trinta e
 * quatro cliques a mais para ajustar dois preços.
 *
 * Campo vazio APAGA o preço da praça — é o jeito de dizer "aqui vale a
 * tabela" sem precisar de um segundo botão para isso.
 */
export function PrecoDaRegiao({
  regiaoId,
  servicoId,
  atual,
}: {
  regiaoId: string;
  servicoId: string;
  atual: number | null;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(() => (atual === null ? "" : (atual / 100).toFixed(2).replace(".", ",")));
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");

  function salvar() {
    setErro("");
    iniciar(async () => {
      const dados = new FormData();
      dados.set("regiaoId", regiaoId);
      dados.set("servicoId", servicoId);
      dados.set("valor", texto);
      const resultado = await salvarPrecoRegiao({ ok: false }, dados);
      if (!resultado.ok) setErro(resultado.erro ?? "Não salvou.");
      else setEditando(false);
    });
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => {
          setTexto(atual === null ? "" : (atual / 100).toFixed(2).replace(".", ","));
          setEditando(true);
        }}
        title="Clique para definir o preço nesta praça"
        className={`text-xs font-semibold hover:underline ${atual === null ? "text-gray-400" : "text-bordo"}`}
      >
        {atual === null ? "usa a tabela" : formatarReais(atual)}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <input
        autoFocus
        inputMode="decimal"
        placeholder="vazio = tabela"
        value={texto}
        disabled={pendente}
        onChange={(evento) => setTexto(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key === "Enter") salvar();
          if (evento.key === "Escape") setEditando(false);
        }}
        onBlur={salvar}
        className="w-28 text-xs text-right rounded-md border border-gray-300 px-1.5 py-1 outline-none focus:border-bordo"
      />
      {erro && <span className="text-[10px] text-red-600">{erro}</span>}
    </span>
  );
}
