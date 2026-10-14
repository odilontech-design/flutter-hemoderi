"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Area, Botao, Campo, Rotulo } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { CamposEndereco } from "@/components/CamposEndereco";
import { adicionarEndereco } from "@/app/actions/enderecos";

/**
 * Botão "Adicionar endereço" que abre o formulário (ata de 13/10): a lista de
 * endereços fica limpa, e o formulário só aparece para quem vai cadastrar.
 */
export function NovoEndereco() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return <Botao onClick={() => setAberto(true)}>+ Adicionar endereço</Botao>;
  }

  return (
    <FormularioAcao
      acao={adicionarEndereco}
      botao="Salvar endereço"
      aoSalvar={() => {
        setAberto(false);
        router.refresh();
      }}
    >
      {/* Ordem da ata de 05/10: o NOME da clínica ou consultório vem antes do
          CEP nos endereços novos (o CEP só vem primeiro no cadastro inicial). */}
      <div>
        <Rotulo>Nome da clínica ou consultório</Rotulo>
        <Campo name="rotulo" required placeholder="Clínica Lom Saúde, Unidade Moema…" />
        <div className="text-[10px] text-gray-400 mt-1">
          É como você vai reconhecer o lugar na hora de agendar.
        </div>
      </div>
      <CamposEndereco />
      <div>
        <Rotulo>Observações e referências (opcional)</Rotulo>
        <Area name="observacoes" rows={2} maxLength={500} placeholder="Ex.: bloco B, sala 12, estacionamento no subsolo, entrada pelos fundos" />
        <div className="text-[10px] text-gray-400 mt-1">
          Ajuda o profissional a chegar. O endereço em si ele confere pelo CEP.
        </div>
      </div>
      <button type="button" onClick={() => setAberto(false)} className="text-[11px] text-gray-400 hover:text-bordo">
        cancelar
      </button>
    </FormularioAcao>
  );
}
