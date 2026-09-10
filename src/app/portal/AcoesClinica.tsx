"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Botao } from "@/components/ui";
import { cancelarPeloPortal } from "@/app/actions/pedidos";

/**
 * O que a clínica pode fazer sozinha com o próprio pedido.
 *
 * A janela de antecedência é conferida no servidor, não aqui — esconder o
 * botão ajuda, mas quem garante a regra é a action. Perto demais do
 * atendimento, a resposta explica que é para ligar para a central, em vez de
 * simplesmente recusar.
 */
export function AcoesClinica({ pedidoId }: { pedidoId: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/portal/reagendar/${pedidoId}`}
        className="text-[11px] font-semibold text-navy border border-gray-300 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"
      >
        Reagendar
      </Link>
      <Botao
        variante="perigo"
        disabled={pendente}
        onClick={() => {
          const motivo = window.prompt("Motivo do cancelamento (opcional):");
          if (motivo === null) return;
          setErro("");
          iniciar(async () => {
            const resultado = await cancelarPeloPortal(pedidoId, motivo);
            if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível cancelar.");
          });
        }}
      >
        Cancelar
      </Botao>
      {erro && <span className="text-[11px] text-hemo">{erro}</span>}
    </div>
  );
}
