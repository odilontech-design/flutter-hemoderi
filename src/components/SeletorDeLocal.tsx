"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Selecao } from "@/components/ui";
import { OutroEndereco } from "@/components/OutroEndereco";

/**
 * O local do atendimento na edição do agendamento, com "+ Usar outro
 * endereço" ali mesmo (Joyce, 29/10: o endereço não era editável e cadastrar
 * um novo levava para a tela de clínicas). O endereço novo já fica escolhido.
 */
export function SeletorDeLocal({
  name = "enderecoId",
  clinicaId,
  inicial,
  locais,
}: {
  name?: string;
  clinicaId: string;
  inicial: string;
  locais: { id: string; rotulo: string }[];
}) {
  const router = useRouter();
  const [escolhido, setEscolhido] = useState(inicial);
  const [lista, setLista] = useState(locais);

  return (
    <div className="space-y-1">
      <Selecao name={name} value={escolhido} onChange={(e) => setEscolhido(e.target.value)}>
        {lista.map((l) => (
          <option key={l.id || "principal"} value={l.id}>
            {l.rotulo}
          </option>
        ))}
      </Selecao>
      <OutroEndereco
        clinicaId={clinicaId}
        aoCriar={(id) => {
          setLista((atual) => (atual.some((l) => l.id === id) ? atual : [...atual, { id, rotulo: "Endereço novo" }]));
          setEscolhido(id);
          router.refresh();
        }}
      />
    </div>
  );
}
