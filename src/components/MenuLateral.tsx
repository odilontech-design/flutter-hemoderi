"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { version as versaoDoSistema } from "../../package.json";

export type ItemMenu = { href: string; icone: React.ReactNode; rotulo: string };

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

function IconeSair() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

/**
 * Logo da Hemoderi: ícone (gota + tubo) e nome lado a lado, os dois em
 * imagem — o nome não é texto composto na fonte do sistema, é o próprio
 * traçado da marca (extraído do arquivo oficial), para não depender de
 * nenhuma fonte parecida existir no aparelho de quem abre a tela.
 *
 * O nome mostrado aqui é sempre o da Hemoderi, nunca o `titulo` do menu: nos
 * portais da clínica e do profissional, `titulo` é o nome de quem está
 * logado — a marca no topo é sempre a da Hemoderi, e quem está logado
 * aparece embaixo, no bloco de `subtitulo`.
 *
 * Recolhido, só o ícone fica — controlado por `recolhido` via classe (igual
 * o resto do menu) e não por `if` de JavaScript, porque aqui "recolhido" só
 * existe a partir do breakpoint `md`: no celular a barra é sempre larga e o
 * nome sempre aparece.
 */
function Logo({ recolhido }: { recolhido: boolean }) {
  const [falhouIcone, setFalhouIcone] = useState(false);
  const [falhouTexto, setFalhouTexto] = useState(false);

  return (
    <div className="flex items-center gap-2 min-w-0">
      {falhouIcone ? (
        <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center font-display font-bold text-xs shrink-0">
          H
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- svg estático pequeno, sem otimização de imagem a ganhar aqui.
        <img
          src="/logo-hemoderi-icone.svg"
          alt="Hemoderi"
          className="w-8 h-8 object-contain shrink-0"
          onError={() => setFalhouIcone(true)}
        />
      )}
      {falhouTexto ? (
        <span className={`font-display font-bold text-lg truncate ${recolhido ? "md:hidden" : ""}`}>Hemoderi</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- idem.
        <img
          src="/logo-hemoderi-texto.svg"
          alt=""
          className={`h-6 w-auto max-w-full object-contain object-left ${recolhido ? "md:hidden" : ""}`}
          onError={() => setFalhouTexto(true)}
        />
      )}
    </div>
  );
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

export function MenuLateral({
  titulo,
  subtitulo,
  nomeUsuario,
  itens,
}: {
  titulo: string;
  /** Rótulo curto sob o título — "Portal da clínica", por exemplo. Opcional. */
  subtitulo?: string;
  /** Quem está logado agora, mostrado no rodapé junto do botão de sair. */
  nomeUsuario: string;
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

      {/* Sem `relative` aqui, de propósito: `relative` e `fixed` disputam a
          mesma propriedade e o Tailwind emite `relative` DEPOIS no CSS — a
          barra virava `relative` no celular, continuava ocupando os 256px de
          largura dela dentro do flex mesmo deslizada para fora da tela, e
          sobrava um terço da tela para o conteúdo, com o resto cortado pelo
          overflow-x-hidden do <main>. O botão de recolher (absolute) não
          precisa do `relative`: ele só aparece a partir do md, onde a barra é
          `sticky` — que também serve de âncora para filho posicionado. */}
      <div
        className={`bg-bordoEscuro text-white flex flex-col shrink-0 h-screen fixed md:sticky top-0 z-50 w-64
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
          <div className={`flex ${recolhido ? "md:justify-center" : ""}`}>
            <Logo recolhido={recolhido} />
          </div>
          {/* Só existe o que dizer aqui quando titulo é outra identidade além
              da Hemoderi (a clínica, o profissional) — a logo já diz
              "Hemoderi" sozinha, repetir por baixo seria redundante. */}
          {subtitulo && (
            <div className={`min-w-0 mt-3 ${recolhido ? "md:hidden" : ""}`}>
              <div className="font-display font-bold text-sm truncate">{titulo}</div>
              <div className="text-[10px] text-white/50 mt-0.5 truncate">{subtitulo}</div>
            </div>
          )}
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

        <div className="border-t border-white/10">
          <div className={`flex items-center gap-2 p-3 ${recolhido ? "md:justify-center" : ""}`}>
            <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-bold shrink-0">
              {iniciais(nomeUsuario)}
            </div>
            <div className={`min-w-0 flex-1 ${recolhido ? "md:hidden" : ""}`}>
              <div className="text-xs font-semibold truncate">{nomeUsuario}</div>
              {/* A troca de senha mora aqui porque vale para os três perfis:
                  clínica e profissional não têm tela de configuração, e sem
                  este link a única forma de trocar seria pedir à equipe — que
                  é justamente o que a senha provisória existe para evitar. */}
              <Link
                href="/trocar-senha"
                className="text-[10px] text-white/40 hover:text-white/80 transition-colors"
              >
                Trocar senha
              </Link>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sair"
              aria-label="Sair"
              className={`shrink-0 w-10 h-10 md:w-7 md:h-7 flex items-center justify-center rounded-full text-white/60
                hover:text-white hover:bg-white/10 active:scale-95 transition-all ${recolhido ? "md:hidden" : ""}`}
            >
              <IconeSair />
            </button>
          </div>
          {/* Colapsado, o botão de sair some da linha acima (não cabe ao lado
              do avatar) e reaparece aqui sozinho, centralizado. */}
          {recolhido && (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sair"
              aria-label="Sair"
              className="hidden md:flex w-full justify-center pb-3 text-white/60 hover:text-white transition-colors"
            >
              <IconeSair />
            </button>
          )}
          <div className={`px-3 pb-3 text-center text-[9px] text-white/35 ${recolhido ? "md:hidden" : ""}`}>
            v{versaoDoSistema} · Feito com ❤️ por Dilon Tech
          </div>
        </div>
      </div>
    </>
  );
}
