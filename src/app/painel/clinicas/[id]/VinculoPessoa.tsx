"use client";

import { useState, useTransition } from "react";
import { buscarClinicasParaVinculo, desvincularPessoa, moverPessoa, separarEmClinicaPropria } from "@/app/actions/vinculos";
import { useConfirmarSalvo } from "@/components/ConfirmacaoSalvo";

/** As correções de vínculo de uma pessoa nesta clínica (ver actions/vinculos.ts). */
export function VinculoPessoa({ clinicaId, pessoaId, nome }: { clinicaId: string; pessoaId: string; nome: string }) {
  const [pendente, iniciar] = useTransition();
  const [movendo, setMovendo] = useState(false);
  const [termo, setTermo] = useState("");
  const [opcoes, setOpcoes] = useState<{ id: string; nome: string; cidade: string | null }[]>([]);
  const [erro, setErro] = useState("");
  const avisarSalvo = useConfirmarSalvo();

  function executar(acao: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro("");
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) setErro(r.erro ?? "Não foi possível.");
      else avisarSalvo();
    });
  }

  async function buscar(valor: string) {
    setTermo(valor);
    setOpcoes(valor.trim().length >= 2 ? await buscarClinicasParaVinculo(valor) : []);
  }

  return (
    <div className="text-[11px]">
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={pendente} onClick={() => setMovendo((v) => !v)} className="font-semibold text-bordo hover:underline">
          Mover para outra clínica
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => {
            if (confirm(`Criar um pré-cadastro próprio para ${nome} e tirá-la desta clínica?`)) {
              executar(() => separarEmClinicaPropria(clinicaId, pessoaId));
            }
          }}
          className="font-semibold text-bordo hover:underline"
        >
          Separar em clínica própria
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => {
            if (confirm(`Tirar ${nome} desta clínica?`)) executar(() => desvincularPessoa(clinicaId, pessoaId));
          }}
          className="font-semibold text-red-600 hover:underline"
        >
          Desvincular
        </button>
      </div>
      {movendo && (
        <div className="mt-2 space-y-1">
          <input
            value={termo}
            onChange={(e) => void buscar(e.target.value)}
            placeholder="Buscar clínica pelo nome…"
            className="w-full max-w-xs border border-gray-300 rounded-lg px-2 py-1.5"
            autoFocus
          />
          {opcoes.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={pendente || o.id === clinicaId}
              onClick={() => executar(() => moverPessoa(clinicaId, pessoaId, o.id))}
              className="block text-left text-gray-700 hover:text-bordo disabled:text-gray-300"
            >
              → {o.nome}
              {o.cidade ? <span className="text-gray-400"> · {o.cidade}</span> : null}
            </button>
          ))}
        </div>
      )}
      {erro && <div className="text-red-600 mt-1">{erro}</div>}
    </div>
  );
}
