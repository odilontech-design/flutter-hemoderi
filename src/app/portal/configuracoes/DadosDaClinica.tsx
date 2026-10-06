"use client";

import { Campo, Rotulo, Selecao } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { CampoDocumento } from "@/components/CampoDocumento";
import { salvarDadosDaClinica } from "@/app/actions/configuracoes";
import { CONSELHOS } from "@/lib/conselhos";

/**
 * Os dados de contato e documento da clínica. Nome, perfil e o endereço
 * principal são da equipe Hemoderi (ver actions/configuracoes.ts); o documento
 * só é editável enquanto não foi preenchido.
 */
export function DadosDaClinica({
  nome,
  telefone,
  email,
  cnpj,
  conselho,
  registroConselho,
  podeEditar,
}: {
  nome: string;
  telefone: string;
  email: string;
  cnpj: string;
  conselho: string;
  registroConselho: string;
  podeEditar: boolean;
}) {
  // Quem não é titular só lê: sem botão de salvar que a ação ia recusar.
  if (!podeEditar) {
    const linhas: [string, string][] = [
      ["Nome da clínica", nome],
      ["Telefone", telefone],
      ["E-mail", email],
      ["CNPJ ou CPF", cnpj],
      ["Conselho de classe", [conselho, registroConselho].filter(Boolean).join(" ")],
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
          <Campo name="telefone" defaultValue={telefone} inputMode="tel" placeholder="(11) 99999-9999" />
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
    </FormularioAcao>
  );
}
