"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Rotulo, Selecao } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { OutroEndereco } from "@/components/OutroEndereco";
import { alterarLocalDoAgendamento } from "@/app/actions/pedidos";

/**
 * Corrigir só o local do atendimento (ata de 27/10): a logística esquece ou
 * erra o endereço e precisa acertar na hora, sem abrir a edição completa do
 * comercial. Endereço novo se cadastra pelo CEP ali mesmo.
 */
export function AlterarLocal({
  pedidoId,
  clinicaId,
  enderecoId,
  locais,
}: {
  pedidoId: string;
  clinicaId: string;
  enderecoId: string;
  locais: { id: string; rotulo: string }[];
}) {
  const router = useRouter();
  const [escolhido, setEscolhido] = useState(enderecoId);
  const [lista, setLista] = useState(locais);

  return (
    <details className="mb-3 bg-white rounded-2xl border border-bordo/30 px-5 py-3">
      <summary className="cursor-pointer select-none text-xs font-semibold text-bordo">📍 Alterar o local do atendimento</summary>
      <div className="mt-3 space-y-2">
        <FormularioAcao acao={alterarLocalDoAgendamento} botao="Salvar o local" limparAoSalvar={false} aoSalvar={() => router.refresh()}>
          <input type="hidden" name="pedidoId" value={pedidoId} />
          <div>
            <Rotulo>Local do atendimento</Rotulo>
            <Selecao name="enderecoId" value={escolhido} onChange={(e) => setEscolhido(e.target.value)}>
              {lista.map((l) => (
                <option key={l.id || "principal"} value={l.id}>
                  {l.rotulo}
                </option>
              ))}
            </Selecao>
          </div>
        </FormularioAcao>
        <OutroEndereco
          clinicaId={clinicaId}
          aoCriar={(id) => {
            setLista((atual) => (atual.some((l) => l.id === id) ? atual : [...atual, { id, rotulo: "Endereço novo (salve para usar)" }]));
            setEscolhido(id);
            router.refresh();
          }}
        />
      </div>
    </details>
  );
}
