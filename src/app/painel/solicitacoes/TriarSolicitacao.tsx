"use client";

import { useState, useTransition } from "react";
import { recusarSolicitacao, vincularSolicitacao } from "@/app/actions/publico";
import { Botao, Selecao } from "@/components/ui";

/**
 * A decisão da equipe sobre um pedido que chegou de fora.
 *
 * A clínica sugerida vem primeiro na lista quando o telefone bateu com um
 * cadastro — mas continua sendo uma escolha, não um automatismo. "Clínica da
 * Dra. Marina" pode ser a Santa Rita com outro nome, e só quem atende sabe.
 */
export function TriarSolicitacao({
  solicitacaoId,
  clinicas,
  sugeridaId,
}: {
  solicitacaoId: string;
  clinicas: { id: string; nome: string }[];
  sugeridaId: string | null;
}) {
  const [clinicaId, setClinicaId] = useState(sugeridaId ?? "");
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");

  const ordenadas = sugeridaId
    ? [...clinicas].sort((a, b) => (a.id === sugeridaId ? -1 : b.id === sugeridaId ? 1 : 0))
    : clinicas;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Selecao
        aria-label="Clínica para vincular"
        value={clinicaId}
        disabled={pendente}
        onChange={(e) => setClinicaId(e.target.value)}
        className="!w-auto max-w-[240px] text-xs"
      >
        <option value="">— escolha a clínica —</option>
        {ordenadas.map((clinica) => (
          <option key={clinica.id} value={clinica.id}>
            {clinica.nome}
            {clinica.id === sugeridaId ? " (telefone bateu)" : ""}
          </option>
        ))}
      </Selecao>

      <Botao
        disabled={pendente || !clinicaId}
        onClick={() => {
          setErro("");
          iniciar(async () => {
            const r = await vincularSolicitacao(solicitacaoId, clinicaId);
            if (!r.ok) setErro(r.erro ?? "Não deu para vincular.");
          });
        }}
      >
        Virar agendamento
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
