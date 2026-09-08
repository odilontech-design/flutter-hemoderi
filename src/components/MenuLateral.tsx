"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export type ItemMenu = { href: string; icone: string; rotulo: string };

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

  return (
    <>
      {/* Barra fixa no topo só em tela pequena: a equipe usa desktop, mas o
          profissional preenche o relatório no celular, saindo da clínica. */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-navyDeep text-white flex items-center gap-3 px-4 z-40">
        <button type="button" onClick={() => setAberto(true)} aria-label="Abrir menu" className="text-xl leading-none">
          ☰
        </button>
        <div className="font-display font-bold text-sm truncate">{titulo}</div>
      </div>

      {aberto && <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setAberto(false)} />}

      <div
        className={`bg-navyDeep text-white flex flex-col shrink-0 h-screen fixed md:sticky top-0 z-50 w-64 md:w-56
          transition-transform duration-200 ${aberto ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="p-4 border-b border-white/10">
          <div className="font-display font-bold text-sm truncate">{titulo}</div>
          <div className="text-[10px] text-white/50 mt-0.5">{subtitulo}</div>
          <div className="text-[9px] uppercase tracking-wide mt-2 text-teal">Dilon Saúde · Operações</div>
          <button
            type="button"
            onClick={() => setAberto(false)}
            aria-label="Fechar menu"
            className="md:hidden absolute top-4 right-4 text-white/60 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto">
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
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-0.5 text-xs transition-colors ${
                  ativo ? "bg-white/10 text-teal font-semibold" : "text-white/60 hover:bg-white/5"
                }`}
              >
                <span>{item.icone}</span>
                <span>{item.rotulo}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full text-left text-xs text-white/60 hover:text-white/90 px-3 py-2"
          >
            ↩ Sair
          </button>
        </div>
      </div>
    </>
  );
}
