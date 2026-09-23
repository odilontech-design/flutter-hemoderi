"use client";

import { useRouter } from "next/navigation";
import { Rotulo, Selecao } from "@/components/ui";

/**
 * Filtro isolado — não usa o mesmo módulo da agenda porque aqui é um campo
 * só, direto na URL, sem os outros quatro filtros que a agenda tem.
 */
export function FiltroProdutividade({
  servicoId,
  servicos,
}: {
  servicoId: string;
  servicos: { id: string; nome: string }[];
}) {
  const router = useRouter();

  return (
    <div className="w-40">
      <Rotulo>Filtrar por serviço</Rotulo>
      <Selecao
        value={servicoId}
        onChange={(e) => router.push(e.target.value ? `/painel?servico=${e.target.value}` : "/painel")}
      >
        <option value="">Todos</option>
        {servicos.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </Selecao>
    </div>
  );
}
