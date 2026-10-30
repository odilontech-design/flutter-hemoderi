"use client";

import { useEffect, useRef } from "react";

/**
 * No celular a tabela vira uma pilha de cartões (globals.css, .tabela-cartoes)
 * e cada célula precisa dizer o que é — o cabeçalho some. Este marcador copia
 * o texto de cada <th> para o `data-rotulo` das células da mesma coluna, e
 * repete quando as linhas mudam (filtros, atualização da página).
 */
export function RotulosDaTabela() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const tabela = ref.current?.parentElement?.querySelector("table");
    if (!tabela) return;
    const rotular = () => {
      const titulos = Array.from(tabela.querySelectorAll("thead th")).map((th) => th.textContent?.trim() ?? "");
      tabela.querySelectorAll("tbody tr").forEach((tr) => {
        let coluna = 0;
        Array.from(tr.children).forEach((td) => {
          const rotulo = titulos[coluna] ?? "";
          if (td.getAttribute("data-rotulo") !== rotulo) td.setAttribute("data-rotulo", rotulo);
          coluna += Number((td as HTMLTableCellElement).colSpan) || 1;
        });
      });
    };
    rotular();
    const observador = new MutationObserver(rotular);
    observador.observe(tabela, { childList: true, subtree: true });
    return () => observador.disconnect();
  }, []);
  return <span ref={ref} hidden />;
}
