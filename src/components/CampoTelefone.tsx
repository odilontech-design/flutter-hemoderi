"use client";

import { useState } from "react";
import { Campo } from "@/components/ui";
import { lerTelefoneBrasileiro, mascararTelefone } from "@/lib/telefone";

/**
 * Telefone com máscara (11) 99999-9999 (ata de 13/10). Colar "+55 11 9…" já
 * tira o 55. Avisa ao sair do campo; quem decide é a validação do servidor.
 */
export function CampoTelefone({
  name,
  inicial = "",
  obrigatorio = false,
}: {
  name: string;
  inicial?: string;
  obrigatorio?: boolean;
}) {
  const [valor, setValor] = useState(mascararTelefone(inicial));
  const [invalido, setInvalido] = useState(false);
  return (
    <>
      <Campo
        name={name}
        value={valor}
        required={obrigatorio}
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="(11) 99999-9999"
        onChange={(e) => {
          setValor(mascararTelefone(e.target.value));
          if (invalido) setInvalido(false);
        }}
        onBlur={(e) => setInvalido(e.target.value.length > 0 && !lerTelefoneBrasileiro(e.target.value))}
      />
      {invalido && (
        <div className="text-[11px] text-red-600 mt-1">Use DDD + número, 11 dígitos, sem o +55.</div>
      )}
    </>
  );
}
