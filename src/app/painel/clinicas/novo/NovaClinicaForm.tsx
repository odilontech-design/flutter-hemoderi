"use client";

import { useRouter } from "next/navigation";
import { Campo, Rotulo } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { CamposEndereco } from "@/components/CamposEndereco";
import { CampoDocumento } from "@/components/CampoDocumento";
import { salvarClinica } from "@/app/actions/cadastros";

export function NovaClinicaForm() {
  const router = useRouter();

  return (
    <FormularioAcao
      acao={salvarClinica}
      botao="Cadastrar clínica"
      aoSalvar={() => router.push("/painel/clinicas")}
    >
      <div>
        <Rotulo>Nome</Rotulo>
        <Campo name="nome" required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CampoDocumento tipo="cnpj" name="cnpj" rotulo="CNPJ" />
        <div>
          <Rotulo>Telefone</Rotulo>
          <Campo name="telefone" placeholder="(11) 99999-0000" />
        </div>
      </div>
      <div>
        <Rotulo>E-mail</Rotulo>
        <Campo name="email" type="email" />
      </div>

      <CamposEndereco />
      <div>
        <Rotulo>Salas de atendimento simultâneo</Rotulo>
        <Campo name="salas" type="number" min={1} defaultValue={1} />
        <div className="text-[10px] text-gray-400 mt-1">
          Quantos atendimentos cabem ao mesmo tempo no endereço. É o que permite alocar
          dois profissionais no mesmo horário sem que o sistema veja conflito.
        </div>
      </div>
      <div className="text-[10px] text-gray-400 leading-relaxed">
        Com o e-mail preenchido, o acesso ao portal sai em um clique na própria lista
        (<strong>Gerar acesso</strong>) — a senha é sorteada pelo sistema e aparece na tela
        para você repassar.
      </div>
    </FormularioAcao>
  );
}
