"use client";

import { useRouter } from "next/navigation";
import { Campo, Rotulo } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { CamposEndereco } from "@/components/CamposEndereco";
import { adicionarEndereco } from "@/app/actions/enderecos";

export function NovoEndereco() {
  const router = useRouter();

  return (
    <FormularioAcao acao={adicionarEndereco} botao="Salvar endereço" aoSalvar={() => router.refresh()}>
      <div>
        <Rotulo>Nome do endereço</Rotulo>
        <Campo name="rotulo" required placeholder="Unidade Moema, Consultório do Rio…" />
        <div className="text-[10px] text-gray-400 mt-1">
          É como você vai reconhecer o lugar na hora de agendar.
        </div>
      </div>
      <CamposEndereco />
    </FormularioAcao>
  );
}
