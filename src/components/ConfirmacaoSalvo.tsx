"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

export type OpcoesDeConfirmacao = {
  /** Abre uma tela de confirmação que fica até a pessoa dar OK (reunião de 28/10). */
  tela?: boolean;
  /** Título da tela. Padrão: "<ação> com sucesso". */
  titulo?: string;
  /** Linhas abaixo do título: o código do agendamento, o que acontece agora… */
  detalhes?: string[];
};

type Confirmar = (acao?: string, opcoes?: OpcoesDeConfirmacao) => string;

const Contexto = createContext<Confirmar>(() => "");

type Tela = { chave: number; titulo: string; quando: string; detalhes: string[] };

/**
 * A confirmação de que salvou ou enviou, com quem e quando.
 *
 * Duas formas (reunião de 28/10: "em todos os botões de envio, uma tela com a
 * confirmação do envio para não ficar na dúvida"):
 *
 *   • aviso no rodapé, que some sozinho — para o que é pequeno e corriqueiro
 *     (marcar um item, trocar um perfil);
 *   • TELA de confirmação, centralizada, que só fecha quando a pessoa dá OK —
 *     para o que é envio: agendamento, relatório, mensagem, cadastro. A
 *     pessoa que acabou de mandar um relatório do celular, no meio do dia, não
 *     precisa adivinhar se foi.
 *
 * Mora no layout, então sobrevive à troca de página: o formulário pode levar a
 * pessoa para outra tela logo depois de enviar e a confirmação continua lá.
 */
export function ProvedorConfirmacao({ children }: { children: React.ReactNode }) {
  const { data } = useSession();
  const [aviso, setAviso] = useState<{ texto: string; chave: number } | null>(null);
  const [tela, setTela] = useState<Tela | null>(null);
  const botao = useRef<HTMLButtonElement>(null);

  const confirmar = useCallback<Confirmar>(
    (acao = "Salvo", opcoes) => {
      const nome = data?.user?.name?.trim() || "você";
      const hora = HORA.format(new Date());
      const texto = `${acao} por ${nome} às ${hora}`;
      if (opcoes?.tela) {
        setAviso(null);
        setTela({
          chave: Date.now(),
          titulo: opcoes.titulo ?? `${acao} com sucesso`,
          quando: texto,
          detalhes: opcoes.detalhes ?? [],
        });
      } else {
        setAviso({ texto, chave: Date.now() });
      }
      return texto;
    },
    [data]
  );

  useEffect(() => {
    if (!aviso) return;
    const espera = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(espera);
  }, [aviso]);

  // A tela pega o foco (o OK é o que a pessoa vai tocar) e fecha com Esc.
  useEffect(() => {
    if (!tela) return;
    botao.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setTela(null);
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [tela]);

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
      {tela && (
        <div key={tela.chave} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmacao-titulo"
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
          >
            <div aria-hidden className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700">
              ✓
            </div>
            <h2 id="confirmacao-titulo" className="font-display text-lg font-bold text-green-800">
              {tela.titulo}
            </h2>
            <div className="mt-1 text-xs text-gray-500">{tela.quando}</div>
            {tela.detalhes.length > 0 && (
              <div className="mt-3 space-y-1 text-sm text-gray-700">
                {tela.detalhes.map((linha) => (
                  <p key={linha}>{linha}</p>
                ))}
              </div>
            )}
            <button
              ref={botao}
              type="button"
              onClick={() => setTela(null)}
              className="mt-5 w-full rounded-xl bg-bordo px-4 py-3 text-sm font-semibold text-white hover:bg-bordoEscuro"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </Contexto.Provider>
  );
}

/** Chame `confirmar()` quando a ação der certo; devolve o texto mostrado. */
export function useConfirmarSalvo(): Confirmar {
  return useContext(Contexto);
}
