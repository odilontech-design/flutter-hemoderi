"use client";

import { useState, useTransition } from "react";
import { Botao } from "@/components/ui";
import { reatribuirNegociosPipedrive } from "@/app/actions/integracoes";

/**
 * Passa para a Sthefany os negócios que já existem no PipeDrive. Roda em
 * lotes de 40 até acabar; pode ser repetido sem efeito colateral.
 */
export function ReatribuirNegocios() {
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState("");

  function rodar() {
    if (!window.confirm("Passar TODOS os negócios já criados no PipeDrive para a Sthefany? Pode levar alguns minutos.")) return;
    setMensagem("Começando…");
    iniciar(async () => {
      let feitos = 0;
      let aPartirDe: string | undefined;
      const falhas: string[] = [];
      for (let volta = 0; volta < 20; volta++) {
        const r = await reatribuirNegociosPipedrive(aPartirDe);
        feitos += r.feitos;
        falhas.push(...r.falhas);
        setMensagem(`${feitos} negócio(s) passados… ${r.restam > 0 ? `faltam ${r.restam}` : ""}`);
        if (!r.ultimo || r.restam === 0) break;
        if (r.falhas.length > 0 && r.feitos === 0) break;
        aPartirDe = r.ultimo;
      }
      setMensagem(`${feitos} negócio(s) passados para a Sthefany.${falhas.length ? ` ${falhas.length} falha(s): ${falhas[0]}` : ""}`);
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Botao disabled={pendente} onClick={rodar}>
        Passar negócios existentes para a Sthefany
      </Botao>
      {mensagem && <span className="text-[11px] text-gray-600">{mensagem}</span>}
    </span>
  );
}
