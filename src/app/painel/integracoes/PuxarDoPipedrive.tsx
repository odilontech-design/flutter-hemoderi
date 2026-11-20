"use client";

import { useState, useTransition } from "react";
import { Botao, Campo } from "@/components/ui";
import { puxarDoPipedrive } from "@/app/actions/integracoes";

/**
 * O caminho de volta à mão: compara o negócio de um agendamento com o sistema e,
 * se for o caso, puxa as diferenças (valor, repasse, profissional, paciente e
 * baixa do pagamento). Serve para o que foi alterado no PipeDrive antes do aviso
 * automático e para conferir sem esperar o PipeDrive avisar.
 */
export function PuxarDoPipedrive() {
  const [numero, setNumero] = useState("");
  const [linhas, setLinhas] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();

  function rodar(simular: boolean) {
    if (!simular && !window.confirm(`Puxar do PipeDrive para o agendamento ${numero}? O valor, o repasse, o profissional, o paciente e a baixa do sistema passam a ser os do negócio.`)) return;
    iniciar(async () => {
      setErro("");
      setLinhas([]);
      const r = await puxarDoPipedrive(Number(numero), simular);
      if (r.ok) setLinhas(r.avisos ?? []);
      else setErro(r.erro ?? "Não foi possível consultar.");
    });
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Campo
          aria-label="Número do agendamento"
          inputMode="numeric"
          placeholder="Nº do agendamento (ex.: 468)"
          value={numero}
          onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
          className="!w-56 !py-1.5 text-xs"
        />
        <Botao variante="secundario" disabled={pendente || !numero} onClick={() => rodar(true)}>
          Comparar com o PipeDrive
        </Botao>
        <Botao disabled={pendente || !numero} onClick={() => rodar(false)}>
          Puxar do PipeDrive
        </Botao>
      </div>
      {erro && <div className="mt-2 text-[11px] text-red-600">{erro}</div>}
      {linhas.length > 0 && (
        <ul className="mt-2 space-y-0.5 rounded-lg border border-gray-200 bg-white p-3 text-[11px] text-gray-700">
          {linhas.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
