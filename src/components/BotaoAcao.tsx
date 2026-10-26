"use client";

import { useState, useTransition } from "react";
import { Botao } from "@/components/ui";
import type { Resultado } from "@/app/actions/pedidos";
import { useConfirmarSalvo } from "@/components/ConfirmacaoSalvo";

/**
 * Ação de um clique só (baixar fatura, pagar repasse, desativar cadastro).
 * Mostra o erro devolvido pela action ao lado do botão em vez de engolir —
 * "não fez nada e não disse por quê" é o pior estado possível numa tela de
 * dinheiro.
 */
export function BotaoAcao({
  acao,
  children,
  variante = "secundario",
  confirmar,
}: {
  acao: () => Promise<Resultado>;
  children: React.ReactNode;
  variante?: "primario" | "secundario" | "perigo";
  confirmar?: string;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const avisarSalvo = useConfirmarSalvo();

  return (
    <span className="inline-flex items-center gap-2">
      <Botao
        variante={variante}
        disabled={pendente}
        onClick={() => {
          if (confirmar && !window.confirm(confirmar)) return;
          setErro("");
          setAviso("");
          iniciar(async () => {
            const resultado = await acao();
            if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível concluir.");
            else {
              avisarSalvo();
              if (resultado.avisos?.length) setAviso(resultado.avisos.join(" "));
            }
          });
        }}
      >
        {children}
      </Botao>
      {erro && <span className="text-[11px] text-red-600">{erro}</span>}
      {aviso && <span className="text-[11px] text-emerald-700">{aviso}</span>}
    </span>
  );
}
