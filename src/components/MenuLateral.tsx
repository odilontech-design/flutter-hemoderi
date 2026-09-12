"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export type ItemMenu = { href: string; icone: string; rotulo: string };

const CHAVE_RECOLHIDO = "hemoderi:menu-recolhido";

/** Seta dupla, sem depender de emoji (que rende diferente por SO/fonte). */
function IconeSeta({ apontaParaDireita }: { apontaParaDireita: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${apontaParaDireita ? "rotate-180" : ""}`}
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function MenuLateral({
  titulo,
  subtitulo,
  itens,
}: {
  titulo: string;
  subtitulo: string;
  itens: ItemMenu[];
}) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const [recolhido, setRecolhido] = useState(false);

  // Lido depois da primeira renderização, não no useState inicial: o servidor
  // não tem acesso ao localStorage do navegador, e ler ali causaria o HTML do
  // servidor divergir do cliente (erro de hidratação). O preço é um piscar
  // rápido de expandido→recolhido pra quem já tinha essa preferência —
  // aceitável, e só acontece uma vez por carregamento de página.
  useEffect(() => {
    try {
      if (localStorage.getItem(CHAVE_RECOLHIDO) === "1") setRecolhido(true);
    } catch {
      // Navegador bloqueando localStorage (aba anônima estrita, etc.): fica
      // expandido, que é o padrão — não é motivo pra quebrar o menu.
    }
  }, []);

  function alternarRecolhido() {
    setRecolhido((atual) => {
      const novo = !atual;
      try {
        localStorage.setItem(CHAVE_RECOLHIDO, novo ? "1" : "0");
      } catch {
        // idem — preferência só não persiste, o menu continua funcionando.
      }
      return novo;
    });
  }

  return (
    <>
      {/* Barra fixa no topo só em tela pequena: a equipe usa desktop, mas o
          profissional preenche o relatório no celular, saindo da clínica. */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-bordoEscuro text-white flex items-center gap-3 px-4 z-40">
        {/* -m-2.5 compensa o p-2.5: a área de toque cresce (~44px) sem
            deslocar o ícone visualmente do lugar onde estava. */}
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="text-xl leading-none p-2.5 -m-2.5"
        >
          ☰
        </button>
        <div className="font-display font-bold text-sm truncate">{titulo}</div>
      </div>

      {aberto && <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setAberto(false)} />}

      <div
        className={`relative bg-bordoEscuro text-white flex flex-col shrink-0 h-screen fixed md:sticky top-0 z-50 w-64
          transition-[width,transform] duration-200 ${aberto ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${recolhido ? "md:w-[4.5rem]" : "md:w-56"}`}
      >
        {/* Botão de recolher/expandir: só no desktop — no celular o menu
            já se fecha inteiro pelo overlay, não precisa de um meio-termo. */}
        <button
          type="button"
          onClick={alternarRecolhido}
          aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
          title={recolhido ? "Expandir menu" : "Recolher menu"}
          className="hidden md:flex absolute -right-3 top-6 z-10 w-6 h-6 items-center justify-center
            rounded-full bg-white text-bordoEscuro shadow-md border border-black/5
            hover:bg-white/90 hover:scale-105 active:scale-95 transition-all"
        >
          <IconeSeta apontaParaDireita={recolhido} />
        </button>

        <div className={`p-4 border-b border-white/10 ${recolhido ? "md:px-2" : ""}`}>
          <div className={`flex items-center gap-2 ${recolhido ? "md:justify-center" : ""}`}>
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center font-display font-bold text-xs shrink-0">
              {titulo.charAt(0)}
            </div>
            <div className={`min-w-0 ${recolhido ? "md:hidden" : ""}`}>
              <div className="font-display font-bold text-sm truncate">{titulo}</div>
              <div className="text-[10px] text-white/50 mt-0.5 truncate">{subtitulo}</div>
            </div>
          </div>
          <div className={`text-[9px] uppercase tracking-wide mt-2 text-white/70 ${recolhido ? "md:hidden" : ""}`}>
            Dilon Saúde · Operações
          </div>
          <button
            type="button"
            onClick={() => setAberto(false)}
            aria-label="Fechar menu"
            className="md:hidden absolute top-2 right-2 text-white/60 text-lg leading-none p-2.5"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto overflow-x-hidden">
          {itens.map((item) => {
            // O item mais longo que casa com a URL vence, senão "/painel"
            // ficaria ativo em todas as telas do painel.
            const ativo =
              caminho === item.href ||
              (item.href !== "/painel" && item.href !== "/portal" && item.href !== "/profissional"
                ? caminho?.startsWith(item.href)
                : false);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAberto(false)}
                title={recolhido ? item.rotulo : undefined}
                // py-3 (não py-2.5): dá uns 44px de altura de toque, o mínimo
                // recomendado — este menu é usado por profissional no celular
                // saindo da clínica, não só pela equipe no computador.
                className={`flex items-center gap-2.5 px-3 py-3 rounded-lg mb-0.5 text-xs transition-colors ${
                  recolhido ? "md:justify-center" : ""
                } ${ativo ? "bg-white text-bordoEscuro font-semibold shadow-sm" : "text-white/60 hover:bg-white/5"}`}
              >
                <span className="shrink-0">{item.icone}</span>
                <span className={recolhido ? "md:hidden" : ""}>{item.rotulo}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title={recolhido ? "Sair" : undefined}
            className={`w-full text-xs text-white/60 hover:text-white/90 px-3 py-3 flex items-center gap-2.5 ${
              recolhido ? "md:justify-center" : "text-left"
            }`}
          >
            <span className="shrink-0">↩</span>
            <span className={recolhido ? "md:hidden" : ""}>Sair</span>
          </button>
        </div>
      </div>
    </>
  );
}
