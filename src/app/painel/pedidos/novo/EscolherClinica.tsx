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
  /** Pré-cadastro vindo da base do CRM (PipeDrive): só aparece na busca. */
  doCrm: boolean;
};

/** Da base do CRM, quantos mostrar por busca — são milhares. */
const LIMITE_CRM = 30;

/** Sem acento e em minúsculas, para a busca achar "São" digitando "sao". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * A primeira etapa do agendamento pela equipe: a clínica (ata de 26/10:
 * "adicionar e/ou ativar as clínicas cadastradas"). A que não está pronta
 * aparece com a situação ao lado e é liberada na etapa seguinte, sem trocar de
 * tela.
 *
 * As clínicas cadastradas aparecem sempre; a base do CRM — milhares de
 * pré-cadastros importados do PipeDrive — só entra quando a pessoa busca um
 * nome, num bloco separado. Listada inteira, ela soterrava as clínicas reais.
 */
export function EscolherClinica({ clinicas, escolhidaId }: { clinicas: ClinicaDaLista[]; escolhidaId: string | null }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const escolhida = clinicas.find((c) => c.id === escolhidaId) ?? null;
  const [aberta, setAberta] = useState(!escolhida);

  const termo = normalizar(busca);
  const { cadastradas, doCrm, totalCrm } = useMemo(() => {
    const casa = (c: ClinicaDaLista) => !termo || normalizar(`${c.nome} ${c.local}`).includes(termo);
    const crm = termo.length >= 2 ? clinicas.filter((c) => c.doCrm && casa(c)) : [];
    return {
      cadastradas: clinicas.filter((c) => !c.doCrm && casa(c)),
      doCrm: crm.slice(0, LIMITE_CRM),
      totalCrm: crm.length,
    };
  }, [termo, clinicas]);

  function escolher(id: string) {
    setAberta(false);
    router.push(`/painel/pedidos/novo?clinica=${id}`);
  }

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
      <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100 bg-white">
        {cadastradas.map((c) => (
          <Linha key={c.id} clinica={c} escolhida={c.id === escolhidaId} aoEscolher={escolher} />
        ))}
        {doCrm.length > 0 && (
          <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Base do CRM (PipeDrive) — ativar para agendar
            {totalCrm > doCrm.length && (
              <span className="normal-case font-normal"> · {totalCrm} encontradas, refine a busca</span>
            )}
          </div>
        )}
        {doCrm.map((c) => (
          <Linha key={c.id} clinica={c} escolhida={c.id === escolhidaId} aoEscolher={escolher} />
        ))}
        {cadastradas.length === 0 && doCrm.length === 0 && (
          <div className="p-3 text-[11px] text-gray-500">
            {termo.length === 1 ? "Digite mais uma letra para buscar também na base do CRM. " : "Nenhuma clínica com esse nome. "}
            <Link href="/painel/clinicas/novo?agendar=1" className="font-semibold text-bordo hover:underline">
              Cadastrar nova clínica
            </Link>
          </div>
        )}
      </div>
      {!termo && (
        <div className="text-[10px] text-gray-400">
          Mostrando as clínicas cadastradas. Para achar uma da base do CRM, busque pelo nome.
        </div>
      )}
    </div>
  );
}

function Linha({
  clinica,
  escolhida,
  aoEscolher,
}: {
  clinica: ClinicaDaLista;
  escolhida: boolean;
  aoEscolher: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => aoEscolher(clinica.id)}
      className={`w-full text-left px-3 py-2 hover:bg-bege/60 flex items-center justify-between gap-3 ${escolhida ? "bg-bege/60" : ""}`}
    >
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-gray-800 truncate">{clinica.nome}</span>
        <span className="block text-[10px] text-gray-400 truncate">{clinica.local || "sem endereço cadastrado"}</span>
      </span>
      {clinica.situacao && (
        <span className="shrink-0 text-[10px] font-semibold text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">
          {clinica.situacao}
        </span>
      )}
    </button>
  );
}
