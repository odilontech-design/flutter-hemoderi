"use client";

import { useState } from "react";
import { Botao } from "@/components/ui";

export function CopiarLink({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <Botao
      variante="secundario"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          // Navegador sem permissão de área de transferência (ou fora de
          // HTTPS): o link está visível ao lado para copiar à mão.
          setCopiado(false);
        }
      }}
    >
      {copiado ? "Copiado ✓" : "Copiar link"}
    </Botao>
  );
}
