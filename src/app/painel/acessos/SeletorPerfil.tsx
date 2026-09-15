"use client";

import { useState, useTransition } from "react";
import type { PerfilInterno } from "@prisma/client";
import { alterarPerfilInterno } from "@/app/actions/acessos";
import { Selecao } from "@/components/ui";
import { ROTULO_PERFIL_INTERNO } from "@/lib/papeis";

/**
 * Troca de perfil de um acesso interno, direto na linha da tabela.
 *
 * Muda sozinho ao selecionar — não precisa de um botão "Salvar" ao lado,
 * porque o próprio valor do <select> já mostra o estado atual: não há
 * rascunho para confirmar, só um de-para. `disabled` enquanto a mudança
 * anterior ainda está em voo evita o clique duplo virar duas idas ao banco.
 */
export function SeletorPerfil({
  usuarioId,
  perfilAtual,
  desabilitado,
}: {
  usuarioId: string;
  perfilAtual: PerfilInterno;
  desabilitado?: boolean;
}) {
  const [perfil, setPerfil] = useState(perfilAtual);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");

  return (
    <div>
      <Selecao
        aria-label="Perfil do acesso interno"
        value={perfil}
        disabled={pendente || desabilitado}
        onChange={(e) => {
          const novo = e.target.value as PerfilInterno;
          const anterior = perfil;
          setPerfil(novo);
          setErro("");
          iniciar(async () => {
            const r = await alterarPerfilInterno(usuarioId, novo);
            if (!r.ok) {
              setPerfil(anterior);
              setErro(r.erro ?? "Não foi possível alterar.");
            }
          });
        }}
        className="!w-auto text-[11px] !py-1"
      >
        {(Object.keys(ROTULO_PERFIL_INTERNO) as PerfilInterno[]).map((valor) => (
          <option key={valor} value={valor}>
            {ROTULO_PERFIL_INTERNO[valor]}
          </option>
        ))}
      </Selecao>
      {erro && <div className="text-[10px] text-red-600 mt-1">{erro}</div>}
    </div>
  );
}
