"use client";

import { useState, useTransition } from "react";
import { alternarPerfilDaClinica } from "@/app/actions/clientes";
import { ROTULO_PERFIL_CLIENTE, TODOS_OS_PERFIS } from "@/lib/visibilidade";

/**
 * Os perfis do cliente, direto na linha de Acessos: Odontologia, Medicina,
 * Estética, Curso, Mandic e Parceiro. Cada chip liga/desliga na hora — mais de
 * um perfil é normal (quem atende e dá curso). O perfil é da CLÍNICA, não da
 * pessoa: dois acessos da mesma clínica mostram os mesmos chips.
 *
 * O perfil decide o que o cliente vê no catálogo e qual tabela de preço vale
 * para ele; sem nenhum, só enxerga o que não é restrito — por isso o aviso.
 */
export function PerfisDoCliente({
  clinicaId,
  perfisAtuais,
  desabilitado,
}: {
  clinicaId: string;
  perfisAtuais: string[];
  desabilitado?: boolean;
}) {
  const [perfis, setPerfis] = useState<string[]>(perfisAtuais);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");

  return (
    <div className="max-w-[17rem]">
      <div className="flex flex-wrap gap-1">
        {TODOS_OS_PERFIS.map((perfil) => {
          const ligado = perfis.includes(perfil);
          return (
            <button
              key={perfil}
              type="button"
              disabled={pendente || desabilitado}
              aria-pressed={ligado}
              onClick={() => {
                const anteriores = perfis;
                setPerfis(ligado ? perfis.filter((p) => p !== perfil) : [...perfis, perfil]);
                setErro("");
                iniciar(async () => {
                  const r = await alternarPerfilDaClinica(clinicaId, perfil, !ligado);
                  if (!r.ok) {
                    setPerfis(anteriores);
                    setErro(r.erro ?? "Não foi possível alterar.");
                  }
                });
              }}
              className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors disabled:opacity-60 ${
                ligado
                  ? "bg-bordo text-white border-bordo"
                  : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {ROTULO_PERFIL_CLIENTE[perfil]}
            </button>
          );
        })}
      </div>
      {perfis.length === 0 && (
        <div className="text-[10px] text-amber-700 mt-1 leading-snug">
          Sem perfil: vê só o catálogo não restrito e o preço padrão.
        </div>
      )}
      {erro && <div className="text-[10px] text-red-600 mt-1">{erro}</div>}
    </div>
  );
}
