"use client";

import { useState } from "react";
import { avaliarAtendimento } from "@/app/actions/avaliacoes";
import { FormularioAcao } from "@/components/FormularioAcao";
import { EscolherEstrelas, MostrarEstrelas } from "@/components/Estrelas";
import { Area, Botao, Rotulo } from "@/components/ui";
import { LIMITE_COMENTARIO } from "@/lib/avaliacao";

export type AvaliacaoAtual = { nota: number; comentario: string | null } | null;

/**
 * O formulário de avaliação de um atendimento — uma vez só.
 *
 * Em `compacto` ele começa fechado, como um botão numa linha de tabela — é
 * assim que ele aparece no histórico, onde abrir cinco formulários de uma vez
 * transformaria a lista num paredão. Fora do compacto, já vem aberto: no
 * cartão de pendentes o formulário É o conteúdo, e um clique a mais para
 * chegar nele é onde a taxa de resposta morre.
 *
 * Definitiva (ata de 21/09): já avaliado, só mostra a nota — sem botão de
 * abrir o formulário de novo. `avaliarAtendimento` recusa o reenvio no
 * servidor; aqui é só o reflexo disso na tela.
 */
export function AvaliarAtendimento({
  pedidoId,
  atual,
  compacto = false,
}: {
  pedidoId: string;
  atual: AvaliacaoAtual;
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(!compacto);

  if (atual) {
    return (
      <span className="inline-flex items-center gap-2">
        <MostrarEstrelas nota={atual.nota} />
      </span>
    );
  }

  if (!aberto) {
    return (
      <Botao variante="secundario" onClick={() => setAberto(true)}>
        Avaliar
      </Botao>
    );
  }

  return (
    <div className="space-y-2">
      <FormularioAcao acao={avaliarAtendimento} botao="Enviar avaliação" limparAoSalvar={false}>
        <input type="hidden" name="pedidoId" value={pedidoId} />
        <EscolherEstrelas inicial={0} />
        <div>
          <Rotulo>Comentário (opcional)</Rotulo>
          <Area
            name="comentario"
            rows={2}
            maxLength={LIMITE_COMENTARIO}
            placeholder="O que funcionou bem, o que pode melhorar…"
          />
        </div>
      </FormularioAcao>
      {compacto && (
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-[11px] text-gray-400 hover:text-bordo"
        >
          fechar
        </button>
      )}
    </div>
  );
}
