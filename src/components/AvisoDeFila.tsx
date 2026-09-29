"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Pendencias = {
  etapa: string;
  rotulo: string;
  propria: boolean;
  total: number;
  movimentadoEm: string | null;
};

/** De quanto em quanto tempo a fila é consultada. */
const INTERVALO_MS = 60_000;

/**
 * O aviso de que caiu trabalho na sua fila (ata de 28/09).
 *
 * A equipe não fica olhando a esteira: a Joyce está no WhatsApp com um
 * profissional, a Ana está ao telefone com a clínica. O pedido confirmado
 * espera até alguém lembrar de atualizar a página — e esse intervalo é o que
 * atrasa a alocação.
 *
 * Consulta em vez de conexão viva: a fila muda algumas vezes por hora, não
 * por segundo, e um socket aberto por atendente custaria mais operação do que
 * entrega. Um minuto é bem menor que o tempo que a pessoa levaria para
 * perceber sozinha.
 *
 * O "já vi isso" é gravado quando a pessoa FECHA ou abre a fila — nunca no
 * instante em que o aviso aparece. A diferença importa: marcar como lido ao
 * exibir faria um aviso perdido numa troca de tela (ou numa recarga) sumir
 * para sempre, justamente o trabalho que ninguém pegou. Marcando na ação,
 * o aviso insiste enquanto houver serviço parado e só se cala quando alguém
 * responde — e aí só volta se chegar coisa mais nova.
 *
 * O marcador fica no navegador (por isso a chave inclui a etapa): é uma
 * preferência de leitura, não um dado da operação.
 */
export function AvisoDeFila() {
  const [fila, setFila] = useState<Pendencias | null>(null);
  const [visivel, setVisivel] = useState(false);
  // O que a pessoa já deu por lido nesta sessão, para o aviso não voltar a
  // cada consulta depois de fechado.
  const lido = useRef<string | null>(null);

  function marcarComoLido() {
    setVisivel(false);
    if (!fila?.movimentadoEm) return;
    lido.current = fila.movimentadoEm;
    try {
      window.localStorage.setItem(`hemoderi:fila-vista:${fila.etapa}`, fila.movimentadoEm);
    } catch {
      // Navegador sem armazenamento (aba anônima, cookies bloqueados): o
      // marcador vale só para esta sessão, que é melhor do que não avisar.
    }
  }

  useEffect(() => {
    let cancelado = false;

    async function consultar() {
      try {
        const resposta = await fetch("/api/esteira/pendencias");
        if (!resposta.ok) return;
        const dados: Pendencias = await resposta.json();
        if (cancelado || !dados.propria || dados.total === 0 || !dados.movimentadoEm) return;

        let visto: string | null = null;
        try {
          visto = window.localStorage.getItem(`hemoderi:fila-vista:${dados.etapa}`);
        } catch {
          // idem
        }

        const referencia = lido.current ?? visto;
        if (referencia && referencia >= dados.movimentadoEm) return;

        setFila(dados);
        setVisivel(true);
      } catch {
        // Rede instável ou sessão expirada: o aviso é um extra, e falhar em
        // silêncio é melhor do que interromper quem está trabalhando.
      }
    }

    consultar();
    const timer = setInterval(consultar, INTERVALO_MS);
    return () => {
      cancelado = true;
      clearInterval(timer);
    };
  }, []);

  if (!visivel || !fila) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-80 z-50 bg-white border border-bordo/30 rounded-2xl shadow-lg p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-display font-bold text-bordo">Chegou trabalho na sua fila</div>
          <div className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
            {fila.total} agendamento{fila.total === 1 ? "" : "s"} em{" "}
            <strong className="text-bordo">{fila.rotulo}</strong>.
          </div>
        </div>
        <button
          type="button"
          onClick={marcarComoLido}
          aria-label="Fechar aviso"
          className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0"
        >
          ×
        </button>
      </div>
      <Link
        href={`/painel/pedidos?filtro=${fila.etapa}`}
        onClick={marcarComoLido}
        className="mt-3 inline-flex items-center justify-center w-full bg-bordo text-white text-xs font-semibold px-3 py-2.5 rounded-lg hover:bg-bordoEscuro"
      >
        Ver a fila →
      </Link>
    </div>
  );
}
