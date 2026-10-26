"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

type Confirmar = (acao?: string) => string;

const Contexto = createContext<Confirmar>(() => "");

/**
 * A confirmação de que salvou, com quem e quando (pedido do André, 26/10):
 * "✓ Salvo por Ana às 14:32". Toda ação que grava algo chama `confirmar()` ao
 * dar certo; o aviso aparece no rodapé da tela por alguns segundos, em
 * qualquer página do painel, do portal e do profissional — e sobrevive à troca
 * de página, porque mora no layout.
 *
 * O nome é o da sessão de quem está usando; a hora, a do momento em que o
 * servidor respondeu. O registro que vale (auditoria) continua no servidor —
 * aqui é a resposta que a pessoa precisa ver para não salvar duas vezes.
 */
export function ProvedorConfirmacao({ children }: { children: React.ReactNode }) {
  const { data } = useSession();
  const [aviso, setAviso] = useState<{ texto: string; chave: number } | null>(null);

  const confirmar = useCallback<Confirmar>(
    (acao = "Salvo") => {
      const nome = data?.user?.name?.trim() || "você";
      const texto = `${acao} por ${nome} às ${HORA.format(new Date())}`;
      setAviso({ texto, chave: Date.now() });
      return texto;
    },
    [data]
  );

  useEffect(() => {
    if (!aviso) return;
    const espera = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(espera);
  }, [aviso]);

  return (
    <Contexto.Provider value={confirmar}>
      {children}
      {aviso && (
        <div
          key={aviso.chave}
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] rounded-xl bg-green-700 text-white text-xs font-semibold px-4 py-3 shadow-lg flex items-center gap-2"
        >
          <span aria-hidden>✓</span>
          <span>{aviso.texto}</span>
        </div>
      )}
    </Contexto.Provider>
  );
}

/** Chame `confirmar()` quando a ação der certo; devolve o texto mostrado. */
export function useConfirmarSalvo(): Confirmar {
  return useContext(Contexto);
}
