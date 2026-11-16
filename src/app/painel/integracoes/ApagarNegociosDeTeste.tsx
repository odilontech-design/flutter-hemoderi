"use client";

import { useState, useTransition } from "react";
import { Botao } from "@/components/ui";
import { apagarNegociosDeTestePipedrive } from "@/app/actions/integracoes";

/**
 * Apaga do PipeDrive os negócios criados por agendamentos de clínicas de
 * teste. Os agendamentos continuam no sistema, só perdem o vínculo.
 */
export function ApagarNegociosDeTeste() {
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState("");

  function rodar() {
    if (!window.confirm("Apagar do PipeDrive os negócios criados por clínicas de TESTE? Os agendamentos continuam no sistema.")) return;
    setMensagem("Apagando…");
    iniciar(async () => {
      let feitos = 0;
      const falhas: string[] = [];
      for (let volta = 0; volta < 10; volta++) {
        const r = await apagarNegociosDeTestePipedrive();
        feitos += r.feitos;
        falhas.push(...r.falhas);
        setMensagem(`${feitos} negócio(s) apagados…${r.restam > 0 ? ` faltam ${r.restam}` : ""}`);
        if (r.restam === 0 || r.feitos === 0) break;
      }
      setMensagem(`${feitos} negócio(s) de teste apagados.${falhas.length ? ` ${falhas.length} falha(s): ${falhas[0]}` : ""}`);
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Botao disabled={pendente} onClick={rodar}>
        Apagar negócios de teste
      </Botao>
      {mensagem && <span className="text-[11px] text-gray-600">{mensagem}</span>}
    </span>
  );
}
