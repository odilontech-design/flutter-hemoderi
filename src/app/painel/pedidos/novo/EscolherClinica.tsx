"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Campo } from "@/components/ui";

export type ClinicaDaLista = {
  id: string;
  nome: string;
  local: string;
  /** "desativada", "pré-cadastro", "em análise"… — vazio quando já agenda. */
  situacao: string;
};

/**
 * A primeira etapa do agendamento pela equipe: a clínica. Lista TODAS as
 * cadastradas, inclusive desativadas e pré-cadastros do CRM (ata de 26/10:
 * "adicionar e/ou ativar as clínicas cadastradas") — a que não está pronta
 * aparece com a situação ao lado e é liberada na etapa seguinte, sem trocar de
 * tela. A busca filtra por nome ou cidade.
 */
export function EscolherClinica({ clinicas, escolhidaId }: { clinicas: ClinicaDaLista[]; escolhidaId: string | null }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const escolhida = clinicas.find((c) => c.id === escolhidaId) ?? null;
  const [aberta, setAberta] = useState(!escolhida);

  const filtradas = useMemo(() => {
    const termo = busca
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    if (!termo) return clinicas;
    return clinicas.filter((c) =>
      `${c.nome} ${c.local}`
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .includes(termo)
    );
  }, [busca, clinicas]);

  if (escolhida && !aberta) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-bordo truncate">{escolhida.nome}</div>
          <div className="text-[10px] text-gray-500 truncate">{escolhida.local || "sem endereço cadastrado"}</div>
        </div>
        <button type="button" onClick={() => setAberta(true)} className="shrink-0 text-[11px] font-semibold text-bordo hover:underline">
          trocar clínica
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Campo
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pelo nome ou pela cidade"
          aria-label="Buscar clínica"
          className="!w-auto flex-1 min-w-[200px]"
          autoFocus
        />
        <Link
          href="/painel/clinicas/novo?agendar=1"
          className="shrink-0 text-xs font-semibold text-bordo border border-bordo/40 rounded-lg px-3 py-2 hover:bg-bordo/5"
        >
          + Cadastrar nova clínica
        </Link>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100 bg-white">
        {filtradas.length === 0 ? (
          <div className="p-3 text-[11px] text-gray-500">
            Nenhuma clínica com esse nome.{" "}
            <Link href="/painel/clinicas/novo?agendar=1" className="font-semibold text-bordo hover:underline">
              Cadastrar nova clínica
            </Link>
          </div>
        ) : (
          filtradas.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setAberta(false);
                router.push(`/painel/pedidos/novo?clinica=${c.id}`);
              }}
              className={`w-full text-left px-3 py-2 hover:bg-bege/60 flex items-center justify-between gap-3 ${
                c.id === escolhidaId ? "bg-bege/60" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-gray-800 truncate">{c.nome}</span>
                <span className="block text-[10px] text-gray-400 truncate">{c.local || "sem endereço cadastrado"}</span>
              </span>
              {c.situacao && (
                <span className="shrink-0 text-[10px] font-semibold text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">
                  {c.situacao}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
