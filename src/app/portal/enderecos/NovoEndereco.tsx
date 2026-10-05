"use client";

import { useRouter } from "next/navigation";
import { Area, Campo, Rotulo } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { CamposEndereco } from "@/components/CamposEndereco";
import { adicionarEndereco } from "@/app/actions/enderecos";

export function NovoEndereco() {
  const router = useRouter();

  return (
    <FormularioAcao acao={adicionarEndereco} botao="Salvar endereço" aoSalvar={() => router.refresh()}>
      {/* Ordem da ata de 02/10: CEP primeiro (ele puxa o resto), depois o nome
          da clínica ou consultório, e por fim a observação. */}
      <CamposEndereco />
      <div>
        <Rotulo>Nome da clínica ou consultório</Rotulo>
        <Campo name="rotulo" required placeholder="Clínica Lom Saúde, Unidade Moema…" />
        <div className="text-[10px] text-gray-400 mt-1">
          É como você vai reconhecer o lugar na hora de agendar.
        </div>
      </div>
      <div>
        <Rotulo>Observações e referências (opcional)</Rotulo>
        <Area name="observacoes" rows={2} maxLength={500} placeholder="Ex.: entrada pelos fundos, bloco B, sala 12" />
        <div className="text-[10px] text-gray-400 mt-1">
          Ajuda o profissional a chegar. O endereço em si ele confere pelo CEP.
        </div>
      </div>
    </FormularioAcao>
  );
}
