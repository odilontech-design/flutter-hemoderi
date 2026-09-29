"use client";

import { useState, useTransition } from "react";
import { aplicarCupomNaFatura } from "@/app/actions/cupons";
import { Botao, Campo } from "@/components/ui";

/**
 * Formulário inline para aplicar cupom numa fatura aberta.
 *
 * Fica na linha da fatura na tela de financeiro, ao lado de "Dar baixa". A
 * Stephanie (pós-venda) gera a cobrança depois — e o cupom precisa estar
 * aplicado antes, para o Pix sair com o valor líquido.
 */
export function AplicarCupom({ faturaId }: { faturaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [pendente, iniciar] = useTransition();

  if (!aberto) {
    return (
      <Botao variante="secundario" onClick={() => setAberto(true)}>
        Cupom
      </Botao>
    );
  }

  function aplicar() {
    setErro(null);
    setSucesso(false);
    iniciar(async () => {
      const r = await aplicarCupomNaFatura(faturaId, codigo);
      if (r.ok) {
        setSucesso(true);
        setCodigo("");
        setTimeout(() => setAberto(false), 1500);
      } else {
        setErro(r.erro ?? "Erro ao aplicar cupom.");
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <Campo
        name="cupom"
        placeholder="Código"
        value={codigo}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCodigo(e.target.value)}
        className="!w-28 !py-1 !text-xs font-mono uppercase"
      />
      <Botao onClick={aplicar} disabled={pendente || !codigo.trim()}>
        {pendente ? "…" : "Aplicar"}
      </Botao>
      <Botao variante="secundario" onClick={() => setAberto(false)}>
        ✕
      </Botao>
      {erro && <span className="text-[10px] text-red-600 ml-1">{erro}</span>}
      {sucesso && <span className="text-[10px] text-emerald-600 ml-1">Aplicado!</span>}
    </div>
  );
}
