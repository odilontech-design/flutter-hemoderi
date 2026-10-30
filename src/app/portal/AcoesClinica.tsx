"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Botao } from "@/components/ui";
import { cancelarPeloPortal } from "@/app/actions/pedidos";
import { useConfirmarSalvo } from "@/components/ConfirmacaoSalvo";

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
  const avisarSalvo = useConfirmarSalvo();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/portal/reagendar/${pedidoId}`}
        className="text-[11px] font-semibold text-bordo border border-gray-300 rounded-lg px-2.5 py-1.5 min-h-[40px] sm:min-h-0 inline-flex items-center justify-center hover:bg-gray-50"
      >
        Reagendar
      </Link>
      <Botao
        variante="perigo"
        className="!text-[11px] !px-2.5 !py-1.5"
        disabled={pendente}
        onClick={() => {
          const motivo = window.prompt("Motivo do cancelamento (opcional):");
          if (motivo === null) return;
          setErro("");
          iniciar(async () => {
            const resultado = await cancelarPeloPortal(pedidoId, motivo);
            if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível cancelar.");
            else avisarSalvo("Cancelado", { tela: true, titulo: "Agendamento cancelado", detalhes: ["A central foi avisada do cancelamento."] });
          });
        }}
      >
        Cancelar
      </Botao>
      {erro && <span className="text-[11px] text-red-600">{erro}</span>}
    </div>
  );
}
