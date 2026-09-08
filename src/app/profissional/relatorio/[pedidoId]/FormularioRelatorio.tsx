"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Area, Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { enviarRelatorio } from "@/app/actions/relatorio";
import type { Resultado } from "@/app/actions/pedidos";

const INICIAL: Resultado = { ok: false };

export function FormularioRelatorio({ pedidoId, horaPrevista }: { pedidoId: string; horaPrevista: string }) {
  const router = useRouter();
  const [estado, enviar] = useFormState(enviarRelatorio, INICIAL);
  const [compareceu, setCompareceu] = useState("sim");

  useEffect(() => {
    if (estado.ok) router.push("/profissional");
  }, [estado.ok, router]);

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="pedidoId" value={pedidoId} />

      <div>
        <Rotulo>O paciente compareceu?</Rotulo>
        <Selecao name="compareceu" value={compareceu} onChange={(e) => setCompareceu(e.target.value)}>
          <option value="sim">Sim, atendimento realizado</option>
          <option value="nao">Não compareceu</option>
        </Selecao>
        {compareceu === "nao" && (
          <div className="text-[10px] text-gray-500 mt-1">
            A falta fica registrada, mas não gera repasse automático. Fale com a central se houve
            deslocamento.
          </div>
        )}
      </div>

      {compareceu === "sim" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Rotulo>Início</Rotulo>
              <Campo name="inicioReal" type="time" defaultValue={horaPrevista} />
            </div>
            <div>
              <Rotulo>Fim</Rotulo>
              <Campo name="fimReal" type="time" />
            </div>
            <div>
              <Rotulo>Quantidade</Rotulo>
              <Campo name="quantidade" type="number" min={1} defaultValue={1} />
            </div>
          </div>

          <div>
            <Rotulo>Houve intercorrência?</Rotulo>
            <Selecao name="intercorrencia" defaultValue="nao">
              <option value="nao">Não</option>
              <option value="sim">Sim — descreva abaixo</option>
            </Selecao>
          </div>
        </>
      )}

      <div>
        <Rotulo>Observações</Rotulo>
        <Area name="observacoes" rows={3} />
      </div>

      {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}

      <Botao type="submit">Enviar relatório</Botao>
      <div className="text-[10px] text-gray-400">
        O relatório não pode ser editado depois de enviado. Correção é feita pela central.
      </div>
    </form>
  );
}
