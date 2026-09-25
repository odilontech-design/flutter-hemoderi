"use client";

import { createContext, useContext, useState } from "react";
import { Botao, Cartao } from "@/components/ui";
import { IconeFechar, IconeMais } from "@/components/icones/UiIcones";

/**
 * O "fechar" deste formulário, disponível para quem está dentro dele —
 * `FormularioAcao` usa isso para se recolher sozinho ao salvar (ver lá).
 *
 * É Contexto, e não uma função passada por prop, porque `children` aqui
 * quase sempre nasce num Server Component (a própria página de cadastro):
 * uma função não atravessa a fronteira servidor→cliente, mas uma árvore de
 * elementos atravessa normalmente — e o Provider entrega `fechar` a quem
 * estiver dentro dela assim que tudo vira componente de cliente no
 * navegador.
 */
const FecharFormularioContexto = createContext<(() => void) | null>(null);

/** Usado por FormularioAcao — `null` fora de um FormularioRecolhivel, sem efeito nenhum. */
export function useFecharFormularioRecolhivel() {
  return useContext(FecharFormularioContexto);
}

/**
 * O "Novo X" ao lado de uma lista, fechado por padrão.
 *
 * Antes, o formulário de cadastro ficava sempre aberto ao lado da lista —
 * em uma tela com trinta clínicas ou cem profissionais, ele é a parte que
 * quase ninguém usa na maioria das visitas, e ainda assim empurrava a lista
 * (o que a pessoa veio ver) para baixo no celular. Abrir sob um clique
 * inverte a prioridade sem tirar a função do lugar onde ela já mora.
 */
export function FormularioRecolhivel({
  titulo,
  children,
}: {
  /** Serve tanto de cabeçalho do cartão aberto quanto de texto do botão fechado — "Nova clínica", "Novo serviço". */
  titulo: string;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <Botao
        type="button"
        variante="secundario"
        onClick={() => setAberto(true)}
        className="w-full flex items-center justify-center gap-1.5"
      >
        <IconeMais />
        {titulo}
      </Botao>
    );
  }

  return (
    <Cartao>
      <div className="flex items-center justify-between mb-3">
        <div className="font-display font-bold text-bordo text-sm">{titulo}</div>
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar formulário"
          className="text-gray-400 hover:text-bordo p-1.5 -m-1.5"
        >
          <IconeFechar />
        </button>
      </div>
      <FecharFormularioContexto.Provider value={() => setAberto(false)}>
        {children}
      </FecharFormularioContexto.Provider>
    </Cartao>
  );
}
