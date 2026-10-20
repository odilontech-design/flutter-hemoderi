"use client";

import { useState } from "react";
import { Campo, Rotulo } from "@/components/ui";
import { CampoTelefone } from "@/components/CampoTelefone";

/**
 * Bloco "Responsável financeiro" (ata de 20/10). Padrão: a própria clínica;
 * marcando "outra pessoa ou empresa", pede nome, CPF ou CNPJ e telefone
 * (obrigatórios) e e-mail (opcional). As regras de verdade estão em
 * lib/responsavel-financeiro.ts.
 */
export function CamposResponsavelFinanceiro({
  inicial,
}: {
  inicial?: { nome: string | null; documento: string | null; telefone: string | null; email: string | null };
}) {
  const [outro, setOutro] = useState(Boolean(inicial?.documento));

  return (
    <fieldset className="rounded-xl border border-gray-200 p-3 space-y-3">
      <legend className="px-1 text-xs font-semibold text-bordo">Responsável financeiro</legend>
      <div className="text-[11px] text-gray-500 -mt-1">
        Para quem vai a cobrança dos atendimentos. A Hemoderi cobra a clínica, nunca o paciente.
      </div>
      <div className="flex flex-col sm:flex-row gap-2 text-xs">
        <label className="flex items-center gap-2">
          <input type="radio" name="financeiroOutro" value="nao" checked={!outro} onChange={() => setOutro(false)} />A
          própria clínica (CNPJ e telefone deste cadastro)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="financeiroOutro" value="sim" checked={outro} onChange={() => setOutro(true)} />
          Outra pessoa ou empresa
        </label>
      </div>
      {outro && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Rotulo>Nome ou razão social</Rotulo>
            <Campo name="financeiroNome" required defaultValue={inicial?.nome ?? ""} />
          </div>
          <div>
            <Rotulo>CPF ou CNPJ</Rotulo>
            <Campo name="financeiroDocumento" required inputMode="numeric" defaultValue={inicial?.documento ?? ""} />
          </div>
          <div>
            <Rotulo>Telefone</Rotulo>
            <CampoTelefone name="financeiroTelefone" inicial={inicial?.telefone ?? ""} obrigatorio />
          </div>
          <div className="sm:col-span-2">
            <Rotulo>E-mail para cobrança (opcional)</Rotulo>
            <Campo name="financeiroEmail" type="email" defaultValue={inicial?.email ?? ""} />
          </div>
        </div>
      )}
    </fieldset>
  );
}
