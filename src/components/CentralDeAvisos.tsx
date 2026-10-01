"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { precisaAvisar, type Aviso } from "@/lib/avisos";

/** De quanto em quanto tempo os avisos são consultados — só com a aba à vista. */
const INTERVALO_MS = 60_000;

const chaveDoMarcador = (area: string, chave: string) => `hemoderi:aviso:${area}:${chave}`;

/**
 * Os pop-ups de "chegou trabalho": nova solicitação, relatório recebido,
 * atendimento novo para o profissional. Substitui o antigo aviso de fila, que
 * só cobria a fila de cada perfil.
 *
 * O "já vi isso" é gravado quando a pessoa FECHA o aviso ou clica nele — nunca
 * no instante em que ele aparece. Marcar ao exibir faria um aviso perdido numa
 * troca de tela sumir para sempre, justamente o trabalho que ninguém pegou.
 * Marcando na ação, o aviso insiste enquanto houver serviço parado e só volta
 * a aparecer quando chega coisa mais nova.
 *
 * Consulta só com a aba visível (cada consulta é uma invocação de função) e na
 * hora em que a pessoa volta para a aba. O marcador fica no navegador: é uma
 * preferência de leitura, não um dado da operação.
 */
export function CentralDeAvisos({ area }: { area: "painel" | "profissional" }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  // O que já foi dado por lido nesta sessão, para o aviso não voltar a cada
  // consulta depois de fechado, mesmo sem localStorage.
  const lidos = useRef<Record<string, string>>({});

  function marcarComoLido(aviso: Aviso) {
    lidos.current[aviso.chave] = aviso.marca;
    setAvisos((atuais) => atuais.filter((a) => a.chave !== aviso.chave));
    try {
      window.localStorage.setItem(chaveDoMarcador(area, aviso.chave), aviso.marca);
    } catch {
      // Sem armazenamento (aba anônima, cookies bloqueados): o marcador vale
      // só para esta sessão, que é melhor do que não avisar.
    }
  }

  useEffect(() => {
    let cancelado = false;

    async function consultar() {
      try {
        const resposta = await fetch(`/api/avisos?area=${area}`);
        if (!resposta.ok) return;
        const { avisos: recebidos }: { avisos: Aviso[] } = await resposta.json();
        if (cancelado) return;

        const novos = recebidos.filter((aviso) => {
          let visto: string | null = lidos.current[aviso.chave] ?? null;
          if (visto === null) {
            try {
              visto = window.localStorage.getItem(chaveDoMarcador(area, aviso.chave));
            } catch {
              // idem
            }
          }
          return precisaAvisar(aviso, visto);
        });
        setAvisos(novos);
      } catch {
        // Rede instável ou sessão expirada: o aviso é um extra, e falhar em
        // silêncio é melhor do que interromper quem está trabalhando.
      }
    }

    const consultarSeVisivel = () => {
      if (document.visibilityState === "visible") consultar();
    };

    consultar();
    const timer = setInterval(consultarSeVisivel, INTERVALO_MS);
    document.addEventListener("visibilitychange", consultarSeVisivel);
    return () => {
      cancelado = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", consultarSeVisivel);
    };
  }, [area]);

  if (avisos.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      // No portal do profissional o botão do WhatsApp ocupa o canto de baixo.
      className={`fixed left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50 flex flex-col gap-2 ${
        area === "profissional" ? "bottom-20 sm:bottom-24" : "bottom-4 sm:bottom-6"
      }`}
    >
      {avisos.map((aviso) => (
        <div key={aviso.chave} className="bg-white border border-bordo/30 rounded-2xl shadow-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-display font-bold text-bordo">{aviso.titulo}</div>
              <div className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">{aviso.texto}</div>
            </div>
            <button
              type="button"
              onClick={() => marcarComoLido(aviso)}
              aria-label="Fechar aviso"
              className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0"
            >
              ×
            </button>
          </div>
          <Link
            href={aviso.href}
            onClick={() => marcarComoLido(aviso)}
            className="mt-3 inline-flex items-center justify-center w-full bg-bordo text-white text-xs font-semibold px-3 py-2.5 rounded-lg hover:bg-bordoEscuro"
          >
            {aviso.rotuloLink}
          </Link>
        </div>
      ))}
    </div>
  );
}
