"use client";

import { useFormState } from "react-dom";
import { Aviso } from "@/components/ui";
import { revisarCadastro } from "@/app/actions/clientes";
import type { Resultado } from "@/app/actions/pedidos";
import { ROTULO_PERFIL_CLIENTE, TODOS_OS_PERFIS } from "@/lib/visibilidade";
import type { TabelaDisponivel } from "./PerfilDoCliente";

const INICIAL: Resultado = { ok: false };

/**
 * A triagem de um autocadastro (ata de 01/10): o cliente disse que é dentista;
 * a Ana confere e confirma o perfil — que pode ser outro — e a tabela de preço
 * a que ele tem direito. Só então o agendamento é liberado.
 */
export function TriagemCadastro({
  clinicaId,
  perfilDeclarado,
  tabelas,
}: {
  clinicaId: string;
  perfilDeclarado: string | null;
  tabelas: TabelaDisponivel[];
}) {
  const [estado, enviar] = useFormState(revisarCadastro, INICIAL);

  return (
    <form action={enviar} className="mt-3 space-y-3">
      <input type="hidden" name="clinicaId" value={clinicaId} />

      <div>
        <div className="text-[11px] font-semibold text-gray-600 mb-1">Perfil confirmado</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {TODOS_OS_PERFIS.map((perfil) => (
            <label key={perfil} className="flex items-center gap-1.5 text-xs text-gray-700">
              <input type="checkbox" name="perfis" value={perfil} defaultChecked={perfil === perfilDeclarado} />
              {ROTULO_PERFIL_CLIENTE[perfil]}
            </label>
          ))}
        </div>
      </div>

      {tabelas.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-gray-600 mb-1">Tabela de preço</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {tabelas.map((tabela) => (
              <label key={tabela.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                <input
                  type="checkbox"
                  name="tabelas"
                  value={tabela.id}
                  defaultChecked={tabela.perfil === perfilDeclarado}
                />
                {tabela.nome}
              </label>
            ))}
          </div>
        </div>
      )}

      {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decisao"
          value="aprovar"
          className="bg-bordo text-white text-xs font-semibold px-4 py-2.5 min-h-[40px] sm:min-h-0 rounded-lg hover:bg-bordoEscuro"
        >
          Aprovar e liberar agendamento
        </button>
        <button
          type="submit"
          name="decisao"
          value="recusar"
          className="border border-red-300 text-red-600 text-xs font-semibold px-4 py-2.5 min-h-[40px] sm:min-h-0 rounded-lg hover:bg-red-50"
        >
          Recusar
        </button>
      </div>
    </form>
  );
}
