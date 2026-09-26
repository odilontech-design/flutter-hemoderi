"use client";

import { useRouter } from "next/navigation";
import { Campo, Rotulo, Selecao } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { CampoDocumento } from "@/components/CampoDocumento";
import { salvarProfissional } from "@/app/actions/cadastros";

export function NovoProfissionalForm({ gruposRepasse }: { gruposRepasse: { id: string; nome: string }[] }) {
  const router = useRouter();

  return (
    <FormularioAcao
      acao={salvarProfissional}
      botao="Cadastrar profissional"
      aoSalvar={() => router.push("/painel/profissionais")}
    >
      <div>
        <Rotulo>Nome</Rotulo>
        <Campo name="nome" required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CampoDocumento tipo="cpf" name="cpf" rotulo="CPF" />
        <div>
          <Rotulo>Telefone</Rotulo>
          <Campo name="telefone" />
        </div>
      </div>
      <div>
        <Rotulo>E-mail</Rotulo>
        <Campo name="email" type="email" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Rotulo>Conselho</Rotulo>
          <Campo name="conselho" placeholder="COREN-SP" />
        </div>
        <div>
          <Rotulo>Registro</Rotulo>
          <Campo name="registro" />
        </div>
      </div>
      <div>
        <Rotulo>Especialidade</Rotulo>
        <Campo name="especialidade" />
      </div>
      <div>
        <Rotulo>Agenda do Google (opcional)</Rotulo>
        <Campo name="googleAgendaId" type="email" placeholder="profissional@gmail.com" />
        <div className="text-[10px] text-gray-400 mt-1">
          E-mail da conta Google dele. Só funciona depois que ele compartilhar a própria agenda
          com a conta de serviço da Hemoderi — o passo a passo está no portal do profissional.
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Rotulo>Chave PIX</Rotulo>
          <Campo name="chavePix" />
        </div>
        <div>
          <Rotulo>Repasse por atendimento (R$)</Rotulo>
          <Campo name="repasseFixoCentavos" placeholder="150,00" inputMode="decimal" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Rotulo>UF</Rotulo>
          <Campo name="uf" placeholder="SP" maxLength={2} />
        </div>
        <div>
          <Rotulo>Grupo de repasse</Rotulo>
          <Selecao name="grupoRepasseId" defaultValue="">
            <option value="">Nenhum</option>
            {gruposRepasse.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Selecao>
        </div>
      </div>
      <div className="text-[10px] text-gray-400 leading-relaxed">
        O repasse é valor fechado por atendimento. Vazio, cai no percentual padrão da
        operação; serviço com regra própria vence os dois.
        <br />
        Com o e-mail preenchido, o acesso ao portal sai em um clique na própria lista
        (<strong>Gerar acesso</strong>) — a senha é sorteada pelo sistema e aparece na tela
        para você repassar.
      </div>
    </FormularioAcao>
  );
}
