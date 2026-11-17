"use client";

import { useState, useTransition } from "react";
import { Botao, Campo } from "@/components/ui";
import { conferirNegocioDoPedido } from "@/app/actions/integracoes";

/**
 * Mostra o negócio de um agendamento como está no PipeDrive: título, dono,
 * cliente e os campos preenchidos. Para conferir o que o sistema mandou sem
 * precisar de acesso ao PipeDrive.
 */
export function ConferirNegocio() {
  const [numero, setNumero] = useState("");
  const [linhas, setLinhas] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Campo
          aria-label="Número do agendamento"
          inputMode="numeric"
          placeholder="Nº do agendamento (ex.: 534)"
          value={numero}
          onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
          className="!w-56 !py-1.5 text-xs"
        />
        <Botao
          variante="secundario"
          disabled={pendente || !numero}
          onClick={() =>
            iniciar(async () => {
              setErro("");
              setLinhas([]);
              const r = await conferirNegocioDoPedido(Number(numero));
              if (r.ok) setLinhas(r.avisos ?? []);
              else setErro(r.erro ?? "Não foi possível consultar.");
            })
          }
        >
          Ver negócio no PipeDrive
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
