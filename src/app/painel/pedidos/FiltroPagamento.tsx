"use client";

import { useRouter } from "next/navigation";
import { Selecao } from "@/components/ui";
import { CONDICOES_PAGAMENTO } from "@/lib/pagamento";

/**
 * Filtro por condição de pagamento — ortogonal ao filtro de status (ata de
 * 21/09: "filtros no ADM para pagamento antecipado ou a qualquer momento").
 * Some quatro opções, não duas, porque a lista de condições já é essa —
 * restringir a UI a "antecipado" × "outro" esconderia a diferença entre
 * faturado e cortesia, que a equipe trata de formas bem diferentes.
 */
export function FiltroPagamento({ filtroStatus, pagamento }: { filtroStatus: string; pagamento: string }) {
  const router = useRouter();

  return (
    <Selecao
      aria-label="Filtrar por condição de pagamento"
      value={pagamento}
      onChange={(e) => {
        const params = new URLSearchParams({ filtro: filtroStatus });
        if (e.target.value) params.set("pagamento", e.target.value);
        router.push(`/painel/pedidos?${params.toString()}`);
      }}
      className="!w-auto text-xs"
    >
      <option value="">Todas as condições de pagamento</option>
      {CONDICOES_PAGAMENTO.map((condicao) => (
        <option key={condicao} value={condicao}>
          {condicao}
        </option>
      ))}
    </Selecao>
  );
}
