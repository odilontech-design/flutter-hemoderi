"use client";

import { useFormState } from "react-dom";
import { Aviso, Botao } from "@/components/ui";
import { importarRepassesPraca, type ResultadoImportacao } from "@/app/actions/repasses-praca";

const INICIAL: ResultadoImportacao = { ok: false };

/** Envia a planilha preenchida: primeiro confere, depois aplica. */
export function ImportarPlanilha() {
  const [estado, enviar] = useFormState(importarRepassesPraca, INICIAL);

  return (
    <form action={enviar} className="space-y-3">
      <input
        type="file"
        name="planilha"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        required
        className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-bordo file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
      />
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" name="modo" value="conferir" variante="secundario">
          Conferir
        </Botao>
        <Botao type="submit" name="modo" value="aplicar">
          Aplicar a planilha
        </Botao>
      </div>
      <div className="text-[10px] text-gray-400">
        Conferir não grava nada. Aplicar substitui a tabela inteira pela planilha; pedidos já alocados mantêm o repasse
        calculado na alocação.
      </div>

      {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      {estado.regras != null && (
        <Aviso tom={estado.aplicada ? "info" : "alerta"}>
          <div className="font-semibold mb-1">
            {estado.aplicada ? "Tabela aplicada." : "Conferência — nada foi gravado ainda."} {estado.regras} regra(s) em{" "}
            {estado.servicosComRegra} serviço(s).
          </div>
          {estado.amostra && estado.amostra.length > 0 && (
            <ul className="list-disc pl-4 space-y-0.5">
              {estado.amostra.map((a, i) => (
                <li key={i}>
                  {a.servico} · {a.praca}: {a.regra}
                </li>
              ))}
            </ul>
          )}
          {estado.naoEncontrados && estado.naoEncontrados.length > 0 && (
            <div className="mt-2 text-amber-800">
              Serviços da planilha que não existem no sistema (ignorados): {estado.naoEncontrados.join("; ")}
            </div>
          )}
          {estado.problemas && estado.problemas.length > 0 && (
            <ul className="mt-2 text-red-700 list-disc pl-4">
              {estado.problemas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </Aviso>
      )}
    </form>
  );
}
