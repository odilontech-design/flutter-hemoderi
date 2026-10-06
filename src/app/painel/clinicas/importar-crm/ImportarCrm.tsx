"use client";

import { useFormState } from "react-dom";
import { importarCrm } from "@/app/actions/crm";
import type { EstadoImportacaoCrm } from "@/lib/crm";
import { Aviso, Botao, Rotulo } from "@/components/ui";

const INICIAL: EstadoImportacaoCrm = { etapa: "inicial" };

function Linha({ rotulo, valor }: { rotulo: string; valor: number | string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-gray-100 last:border-0">
      <span className="text-gray-600">{rotulo}</span>
      <span className="font-semibold text-bordo">{valor}</span>
    </div>
  );
}

/**
 * Dois CSV, uma prévia e a confirmação. O mesmo formulário serve às duas
 * etapas: "Analisar" simula sem gravar nada; "Confirmar importação" reenvia os
 * mesmos arquivos (os campos de arquivo continuam preenchidos) e grava.
 */
export function ImportarCrm() {
  const [estado, enviar] = useFormState(importarCrm, INICIAL);
  const { resumo, execucao } = estado;

  return (
    <form action={enviar} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Rotulo>CSV de organizações</Rotulo>
          <input type="file" name="organizacoes" accept=".csv,text/csv" required className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-bordo file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" />
        </div>
        <div>
          <Rotulo>CSV de pessoas</Rotulo>
          <input type="file" name="pessoas" accept=".csv,text/csv" required className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-bordo file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" />
        </div>
      </div>

      {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}

      {estado.etapa === "concluida" && execucao && (
        <Aviso tom="info">
          <div className="font-semibold mb-0.5">Importação concluída.</div>
          {execucao.clinicasNovas} pré-cadastros criados, {execucao.pessoasNovas} pessoas ligadas às clínicas
          {execucao.clinicasAdotadas > 0 && `, ${execucao.clinicasAdotadas} clínicas já cadastradas marcadas como vindas do CRM`}
          {execucao.clinicasJaImportadas > 0 && `, ${execucao.clinicasJaImportadas} já estavam importados`}.{" "}
          Veja na aba Pré-cadastros de Clínicas.
        </Aviso>
      )}

      {estado.etapa === "previa" && resumo && execucao && (
        <div className="rounded-xl border border-gray-200 p-3 text-xs">
          <div className="font-display font-bold text-bordo text-sm mb-2">Prévia — nada foi gravado ainda</div>
          <Linha rotulo="Organizações / pessoas no arquivo" valor={`${resumo.organizacoesNoArquivo} / ${resumo.pessoasNoArquivo}`} />
          <Linha rotulo="Pré-cadastros a criar" valor={execucao.clinicasNovas} />
          <Linha rotulo="— com negócio fechado no PipeDrive" valor={resumo.clinicasComNegocioFechado} />
          <Linha rotulo="— profissionais avulsos (sem organização)" valor={resumo.clinicasDeProfissionalAvulso} />
          <Linha rotulo="Cadastros duplicados consolidados" valor={resumo.duplicadasConsolidadas} />
          <Linha rotulo="Pessoas a ligar às clínicas" valor={execucao.pessoasNovas} />
          <Linha rotulo="Pessoas com celular / telefone / e-mail" valor={`${resumo.pessoasComCelular} / ${resumo.pessoasComTelefone} / ${resumo.pessoasComEmail}`} />
          {execucao.clinicasAdotadas > 0 && (
            <Linha rotulo="Clínicas já cadastradas com o mesmo nome (só ganham a marca do CRM)" valor={execucao.clinicasAdotadas} />
          )}
          {execucao.clinicasJaImportadas > 0 && (
            <Linha rotulo="Já importados antes (não são tocados)" valor={execucao.clinicasJaImportadas} />
          )}
          <div className="text-[10px] text-gray-500 mt-2 leading-relaxed">
            Nenhum acesso será criado. Os pré-cadastros ficam inativos e fora da agenda, dos pedidos e das pesquisas
            até a equipe ativar cada um.
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Botao type="submit">{estado.etapa === "previa" ? "Analisar de novo" : "Analisar arquivos"}</Botao>
        {estado.etapa === "previa" && (
          <button
            type="submit"
            name="confirmar"
            value="sim"
            className="bg-green-700 text-white text-xs font-semibold px-4 py-2 min-h-[40px] sm:min-h-0 rounded-lg hover:bg-green-800"
          >
            Confirmar importação
          </button>
        )}
      </div>
    </form>
  );
}
