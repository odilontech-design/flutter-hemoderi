"use client";

import { Campo, Rotulo, Selecao } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { CampoDocumento } from "@/components/CampoDocumento";
import { salvarDadosDaClinica } from "@/app/actions/configuracoes";
import { CONSELHOS } from "@/lib/conselhos";
import { CampoTelefone } from "@/components/CampoTelefone";
import { CamposResponsavelFinanceiro } from "@/components/CamposResponsavelFinanceiro";

type Financeiro = { nome: string | null; documento: string | null; telefone: string | null; email: string | null };

/**
 * Os dados de contato e documento da clínica. Só telefone e e-mail mudam
 * livremente (ata de 20/10). Nome, perfil e endereço principal são da equipe
 * Hemoderi; documento, conselho, registro e o responsável financeiro só se
 * preenchem enquanto estão vazios — depois, quem altera é a central (a
 * cobrança e a identificação saem deles).
 */
export function DadosDaClinica({
  nome,
  telefone,
  email,
  cnpj,
  conselho,
  registroConselho,
  financeiro,
  podeEditar,
}: {
  nome: string;
  telefone: string;
  email: string;
  cnpj: string;
  conselho: string;
  registroConselho: string;
  financeiro: Financeiro;
  podeEditar: boolean;
}) {
  const textoFinanceiro = financeiro.documento
    ? [financeiro.nome, financeiro.documento, financeiro.telefone, financeiro.email].filter(Boolean).join(" · ")
    : "A própria clínica";
  // Quem não é titular só lê: sem botão de salvar que a ação ia recusar.
  if (!podeEditar) {
    const linhas: [string, string][] = [
      ["Nome da clínica", nome],
      ["Telefone", telefone],
      ["E-mail", email],
      ["CNPJ ou CPF", cnpj],
      ["Conselho de classe", [conselho, registroConselho].filter(Boolean).join(" ")],
      ["Responsável financeiro", textoFinanceiro],
    ];
    return (
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="text-gray-400">{rotulo}</dt>
            <dd className="text-gray-800">{valor || "—"}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <FormularioAcao acao={salvarDadosDaClinica} botao="Salvar dados" limparAoSalvar={false}>
      <div>
        <Rotulo>Nome da clínica</Rotulo>
        <Campo value={nome} readOnly disabled />
        <div className="text-[10px] text-gray-400 mt-1">Para mudar o nome ou o endereço principal, fale com a central.</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Rotulo>Telefone</Rotulo>
          <CampoTelefone name="telefone" inicial={telefone} obrigatorio />
        </div>
        <div>
          <Rotulo>E-mail para contato e cobrança</Rotulo>
          <Campo name="email" type="email" defaultValue={email} />
        </div>
      </div>

      {cnpj ? (
        <div>
          <Rotulo>CNPJ ou CPF</Rotulo>
          <Campo value={cnpj} readOnly disabled />
        </div>
      ) : (
        <CampoDocumento tipo="cnpj" name="cnpj" rotulo="CNPJ ou CPF" />
      )}

      {conselho && registroConselho ? (
        <div>
          <Rotulo>Conselho de classe do responsável</Rotulo>
          <Campo value={`${conselho} ${registroConselho}`} readOnly disabled />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Rotulo>Conselho de classe do responsável</Rotulo>
            <Selecao name="conselho" defaultValue={conselho}>
              <option value="">Selecione…</option>
              {CONSELHOS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Selecao>
          </div>
          <div>
            <Rotulo>Número do registro</Rotulo>
            <Campo name="registroConselho" defaultValue={registroConselho} />
          </div>
        </div>
      )}

      {financeiro.documento ? (
        <div>
          <Rotulo>Responsável financeiro</Rotulo>
          <Campo value={textoFinanceiro} readOnly disabled />
        </div>
      ) : (
        <CamposResponsavelFinanceiro />
      )}
      <div className="text-[10px] text-gray-400">
        Documento, conselho e responsável financeiro, depois de preenchidos, só a central altera.
      </div>
    </FormularioAcao>
  );
}
