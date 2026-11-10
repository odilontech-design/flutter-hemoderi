"use client";

import { useState, useTransition } from "react";
import { Botao } from "@/components/ui";
import { salvarPendentesNaAgenda } from "@/app/actions/integracoes";

/**
 * Coloca na agenda compartilhada os atendimentos confirmados de hoje em
 * diante que ainda não estão nela. Roda em lotes de 15 até acabar e pode ser
 * repetido sem duplicar: quem já tem evento fica de fora.
 */
export function SalvarAgendaPendentes() {
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState("");

  function rodar() {
    if (!window.confirm("Salvar na agenda compartilhada todos os atendimentos confirmados, de hoje em diante, que ainda não estão nela?")) return;
    setMensagem("Começando…");
    iniciar(async () => {
      let feitos = 0;
      let aPartirDe: number | undefined;
      const falhas: string[] = [];
      for (let volta = 0; volta < 40; volta++) {
        const r = await salvarPendentesNaAgenda(aPartirDe);
        feitos += r.feitos;
        falhas.push(...r.falhas);
        setMensagem(`${feitos} salvo(s)…${r.restam > 0 ? ` faltam ${r.restam}` : ""}`);
        if (!r.ultimo || r.restam === 0) break;
        // Nada salvo e só erro (agenda sem acesso, chave errada): parar evita
        // repetir a mesma falha em todos os lotes.
        if (r.feitos === 0 && r.falhas.length > 0 && volta === 0) break;
        aPartirDe = r.ultimo;
      }
      setMensagem(`${feitos} atendimento(s) salvos na agenda compartilhada.${falhas.length ? ` ${falhas.length} falha(s). A primeira: ${falhas[0]}` : ""}`);
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Botao disabled={pendente} onClick={rodar}>
        Salvar na agenda todos os confirmados
      </Botao>
      {mensagem && <span className="text-[11px] text-gray-600">{mensagem}</span>}
    </span>
  );
}
