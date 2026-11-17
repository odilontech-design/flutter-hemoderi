"use client";

import { useState, useTransition } from "react";
import { Botao, Campo } from "@/components/ui";
import { definirRepasseDoPedido } from "@/app/actions/pedidos";
import { useConfirmarSalvo } from "@/components/ConfirmacaoSalvo";

/**
 * O pós-venda corrige o valor do repasse deste agendamento. No curso, o
 * primeiro paciente leva o valor único e os outros ficam em zero até ela ajustar.
 */
export function EditarRepasse({ pedidoId, inicialCentavos }: { pedidoId: string; inicialCentavos: number }) {
  const [valor, setValor] = useState((inicialCentavos / 100).toFixed(2).replace(".", ","));
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const avisarSalvo = useConfirmarSalvo();
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <Campo aria-label="Valor do repasse (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="!w-28 !py-1.5 text-xs" />
      <Botao
        variante="secundario"
        disabled={pendente}
        onClick={() => {
          setErro(null);
          iniciar(async () => {
            const r = await definirRepasseDoPedido(pedidoId, valor);
            if (!r.ok) setErro(r.erro ?? "Não foi possível salvar.");
            else avisarSalvo();
          });
        }}
      >
        Salvar repasse
      </Botao>
      {erro && <span className="text-[11px] text-red-600">{erro}</span>}
    </div>
  );
}
