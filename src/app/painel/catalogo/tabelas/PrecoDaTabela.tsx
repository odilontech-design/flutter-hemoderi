"use client";

import { useState, useTransition } from "react";
import { salvarPrecoTabela } from "@/app/actions/tabelas";
import { formatarReais } from "@/lib/dinheiro";

/**
 * O preço de um serviço numa tabela, editável na própria linha (mesma
 * interação de PrecoDaRegiao). Campo vazio TIRA o serviço da tabela — quem
 * está nela passa a pagar o preço da praça ou o de tabela padrão.
 */
export function PrecoDaTabela({
  tabelaId,
  servicoId,
  atual,
}: {
  tabelaId: string;
  servicoId: string;
  atual: number | null;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(atual);
  const [texto, setTexto] = useState("");
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");

  const comoTexto = (centavos: number | null) => (centavos === null ? "" : (centavos / 100).toFixed(2).replace(".", ","));

  function salvar() {
    setErro("");
    iniciar(async () => {
      const dados = new FormData();
      dados.set("tabelaId", tabelaId);
      dados.set("servicoId", servicoId);
      dados.set("valor", texto);
      const resultado = await salvarPrecoTabela({ ok: false }, dados);
      if (!resultado.ok) {
        setErro(resultado.erro ?? "Não salvou.");
        return;
      }
      const lido = Math.round(Number(texto.replace(/\./g, "").replace(",", ".")) * 100);
      setValor(texto.trim() && Number.isFinite(lido) ? lido : null);
      setEditando(false);
    });
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => {
          setTexto(comoTexto(valor));
          setEditando(true);
        }}
        title="Clique para definir o preço nesta tabela"
        className={`text-xs font-semibold hover:underline ${valor === null ? "text-gray-400" : "text-bordo"}`}
      >
        {valor === null ? "fora da tabela" : formatarReais(valor)}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <input
        autoFocus
        inputMode="decimal"
        placeholder="vazio = fora da tabela"
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
