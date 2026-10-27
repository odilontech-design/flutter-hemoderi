"use client";

import { useEffect } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { aceitarTermo } from "@/app/actions/termo";
import { Aviso, Botao } from "@/components/ui";
import type { Resultado } from "@/app/actions/pedidos";

const INICIAL: Resultado = { ok: false };

export function FormularioTermo({ inicio }: { inicio: string }) {
  const [estado, enviar] = useFormState(aceitarTermo, INICIAL);
  const router = useRouter();

  useEffect(() => {
    if (!estado.ok) return;
    // refresh antes do replace: a guarda lê o termo aceito do banco.
    router.refresh();
    router.replace(inicio);
  }, [estado, inicio, router]);

  return (
    <form action={enviar} className="space-y-3">
      <label className="flex items-start gap-2 text-xs text-gray-800">
        <input type="checkbox" name="concordo" className="mt-0.5" required />
        <span>Li e concordo com o termo de aceite.</span>
      </label>
      {!estado.ok && estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      <Botao type="submit">Continuar para o portal</Botao>
    </form>
  );
}
