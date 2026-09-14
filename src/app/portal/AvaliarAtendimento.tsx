"use client";

import { useState } from "react";
import { avaliarAtendimento } from "@/app/actions/avaliacoes";
import { FormularioAcao } from "@/components/FormularioAcao";
import { EscolherEstrelas, MostrarEstrelas } from "@/components/Estrelas";
import { Area, Botao, Rotulo } from "@/components/ui";
import { LIMITE_COMENTARIO } from "@/lib/avaliacao";

export type AvaliacaoAtual = { nota: number; comentario: string | null } | null;

/**
 * O formulário de avaliação de um atendimento.
 *
 * Em `compacto` ele começa fechado, como um botão numa linha de tabela — é
 * assim que ele aparece no histórico, onde abrir cinco formulários de uma vez
 * transformaria a lista num paredão. Fora do compacto, já vem aberto: no
 * cartão de pendentes o formulário É o conteúdo, e um clique a mais para
 * chegar nele é onde a taxa de resposta morre.
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

  if (!aberto) {
    return (
      <span className="inline-flex items-center gap-2">
        {atual && <MostrarEstrelas nota={atual.nota} />}
        <Botao variante="secundario" onClick={() => setAberto(true)}>
          {atual ? "Alterar" : "Avaliar"}
        </Botao>
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <FormularioAcao
        acao={avaliarAtendimento}
        botao={atual ? "Salvar alteração" : "Enviar avaliação"}
        // Não limpa ao salvar: a avaliação enviada continua na tela sendo a
        // resposta da clínica, não um formulário em branco que dá a impressão
        // de que nada foi gravado.
        limparAoSalvar={false}
      >
        <input type="hidden" name="pedidoId" value={pedidoId} />
        <EscolherEstrelas inicial={atual?.nota ?? 0} />
        <div>
          <Rotulo>Comentário (opcional)</Rotulo>
          <Area
            name="comentario"
            rows={2}
            maxLength={LIMITE_COMENTARIO}
            defaultValue={atual?.comentario ?? ""}
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
