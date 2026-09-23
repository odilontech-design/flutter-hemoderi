"use client";

import { useState, useTransition } from "react";
import { recusarSolicitacao, vincularSolicitacao } from "@/app/actions/publico";
import { Botao } from "@/components/ui";

/**
 * A solicitação já chegou com a clínica resolvida (login ou cadastro novo,
 * ata de 21/09) — não sobra "achar de quem é isso" para a equipe, só
 * confirmar data, horário e serviço antes de virar agendamento.
 */
export function ConfirmarSolicitacao({ solicitacaoId, clinicaId }: { solicitacaoId: string; clinicaId: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Botao
        disabled={pendente}
        onClick={() => {
          setErro("");
          iniciar(async () => {
            const r = await vincularSolicitacao(solicitacaoId, clinicaId);
            if (!r.ok) setErro(r.erro ?? "Não deu para confirmar.");
          });
        }}
      >
        Confirmar e agendar
      </Botao>

      <Botao
        variante="perigo"
        disabled={pendente}
        onClick={() => {
          const motivo = window.prompt("Motivo da recusa (aparece só para a equipe):") ?? "";
          if (motivo === null) return;
          setErro("");
          iniciar(async () => {
            const r = await recusarSolicitacao(solicitacaoId, motivo);
            if (!r.ok) setErro(r.erro ?? "Não deu para recusar.");
          });
        }}
      >
        Recusar
      </Botao>

      {erro && <span className="text-[11px] text-red-600">{erro}</span>}
    </div>
  );
}
