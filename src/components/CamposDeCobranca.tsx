"use client";

import { useState } from "react";
import { Campo, Rotulo, Selecao } from "@/components/ui";
import { ROTULO_PERFIL_CLIENTE, TODOS_OS_PERFIS } from "@/lib/visibilidade";
import { ROTULO_UNIDADE } from "@/lib/cobranca";
import { UFS } from "@/lib/uf";

type Valores = {
  unidadeCobranca?: "PACIENTE" | "PERIODO" | "HORA";
  permiteQuantidade?: boolean;
  rotuloQuantidade?: string | null;
  quantidadeMaxima?: number | null;
  perfis?: string[];
  ufsIndisponiveis?: string[];
};

/**
 * Lógica de preço e de oferta do serviço (ata de 01/10), editável no cadastro:
 * em que unidade se cobra, se a quantidade varia (Light Touch por dente) ou é
 * sempre um por paciente (PRF), para quais perfis de cliente o serviço
 * aparece e em que estados NÃO é atendido.
 *
 * Mora num componente só para o cadastro novo e a edição não divergirem — o
 * que a equipe preenche aqui vira regra de agendamento, não rótulo.
 */
export function CamposDeCobranca({ valores = {}, sufixoId = "" }: { valores?: Valores; sufixoId?: string }) {
  const [permiteQuantidade, setPermiteQuantidade] = useState(Boolean(valores.permiteQuantidade));

  return (
    <fieldset className="border border-gray-200 rounded-xl p-3 space-y-3">
      <legend className="px-1 text-[11px] font-semibold text-bordo">Cobrança e quantidade</legend>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Rotulo>O valor é cobrado</Rotulo>
          <Selecao name="unidadeCobranca" defaultValue={valores.unidadeCobranca ?? "PACIENTE"}>
            {Object.entries(ROTULO_UNIDADE).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Selecao>
        </div>
        <div>
          <Rotulo>A quantidade varia?</Rotulo>
          <Selecao
            name="permiteQuantidade"
            value={permiteQuantidade ? "sim" : "nao"}
            onChange={(e) => setPermiteQuantidade(e.target.value === "sim")}
          >
            <option value="nao">Não — um por paciente (ex.: PRF)</option>
            <option value="sim">Sim — a clínica informa a quantidade</option>
          </Selecao>
        </div>
      </div>

      {permiteQuantidade && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Rotulo>O que se conta</Rotulo>
            <Campo name="rotuloQuantidade" placeholder="dentes, pacientes, horas…" defaultValue={valores.rotuloQuantidade ?? ""} />
          </div>
          <div>
            <Rotulo>Máximo por agendamento</Rotulo>
            <Campo name="quantidadeMaxima" type="number" min={1} placeholder="sem limite" defaultValue={valores.quantidadeMaxima ?? ""} />
          </div>
        </div>
      )}
      <div className="text-[10px] text-gray-400 leading-relaxed">
        Cobrado por hora com quantidade, as horas contratadas também ficam reservadas na agenda. Sem
        quantidade variável, outro paciente exige outro agendamento.
      </div>

      <div>
        <Rotulo>Perfis de cliente que veem este serviço</Rotulo>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
          {TODOS_OS_PERFIS.map((perfil) => (
            <label key={perfil} className="flex items-center gap-1.5 text-xs text-gray-700">
              <input type="checkbox" name="perfis" value={perfil} defaultChecked={valores.perfis?.includes(perfil)} />
              {ROTULO_PERFIL_CLIENTE[perfil]}
            </label>
          ))}
        </div>
        <div className="text-[10px] text-gray-400 mt-1">Nenhum marcado = todos os perfis veem.</div>
      </div>

      <div>
        <Rotulo>Estados onde NÃO atendemos este serviço</Rotulo>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
          {UFS.map((uf) => (
            <label key={`${sufixoId}${uf}`} className="flex items-center gap-1 text-[11px] text-gray-700">
              <input type="checkbox" name="ufsIndisponiveis" value={uf} defaultChecked={valores.ufsIndisponiveis?.includes(uf)} />
              {uf}
            </label>
          ))}
        </div>
        <div className="text-[10px] text-gray-400 mt-1">
          O serviço some do catálogo e do agendamento de quem atende nesses estados (ex.: laser CO2 no RJ).
        </div>
      </div>
    </fieldset>
  );
}
