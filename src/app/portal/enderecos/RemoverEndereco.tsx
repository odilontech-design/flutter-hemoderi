"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removerEndereco } from "@/app/actions/enderecos";

export function RemoverEndereco({ id, rotulo }: { id: string; rotulo: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");

  function remover() {
    if (!window.confirm(`Remover o endereço "${rotulo}"? Os atendimentos já feitos nele continuam no histórico.`)) return;
    iniciar(async () => {
      const resultado = await removerEndereco(id);
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível remover.");
      else router.refresh();
    });
  }

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={remover}
        disabled={pendente}
        className="text-[11px] font-semibold text-red-600 hover:underline disabled:opacity-50 py-2"
      >
        {pendente ? "Removendo…" : "Remover"}
      </button>
      {erro && <div className="text-[10px] text-red-600">{erro}</div>}
    </div>
  );
}
