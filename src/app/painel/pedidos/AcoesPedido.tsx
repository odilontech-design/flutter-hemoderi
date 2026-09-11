"use client";

import { useState, useTransition } from "react";
import type { StatusPedido } from "@prisma/client";
import { Botao, Selecao } from "@/components/ui";
import {
  alocarPedido,
  cancelarPedido,
  confirmarPedido,
  desalocarPedido,
  marcarResultadoInterno,
} from "@/app/actions/pedidos";

/**
 * As ações possíveis para o pedido no estado em que ele está.
 *
 * A tela só oferece o que a máquina de status permite (lib/pedido.ts). Botão
 * que aparece e depois recusa é a forma mais barata de fazer a equipe
 * desconfiar do sistema — e a recusa aqui é comum: alocar esbarra em agenda,
 * sala e equipamento.
 */
export function AcoesPedido({
  pedidoId,
  status,
  profissionais,
  profissionalSolicitadoId,
}: {
  pedidoId: string;
  status: StatusPedido;
  profissionais: { id: string; nome: string }[];
  /** Quem a clínica pediu no portal, quando pediu alguém. */
  profissionalSolicitadoId?: string | null;
}) {
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  // Já vem preenchido com quem a clínica pediu: confirmar o que foi pedido é
  // o caso comum, e obrigar a reencontrar o nome na lista é atrito à toa.
  const [profissionalId, setProfissionalId] = useState(profissionalSolicitadoId ?? "");

  function executar(acao: () => Promise<{ ok: boolean; erro?: string; avisos?: string[] }>) {
    setMensagem(null);
    iniciar(async () => {
      const resultado = await acao();
      if (!resultado.ok) {
        setMensagem({ texto: resultado.erro ?? "Não foi possível concluir.", erro: true });
      } else if (resultado.avisos?.length) {
        setMensagem({ texto: resultado.avisos.join(" "), erro: false });
      }
    });
  }

  const terminal = status === "REALIZADO" || status === "FALTOU" || status === "CANCELADO";
  if (terminal) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
      {status === "SOLICITADO" && (
        <Botao disabled={pendente} onClick={() => executar(() => confirmarPedido(pedidoId))}>
          Confirmar
        </Botao>
      )}

      {status === "CONFIRMADO" && (
        <>
          <Selecao
            value={profissionalId}
            onChange={(e) => setProfissionalId(e.target.value)}
            className="!w-auto !py-1.5 text-xs"
          >
            <option value="">Alocar profissional…</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.id === profissionalSolicitadoId ? " (pedido pela clínica)" : ""}
              </option>
            ))}
          </Selecao>
          <Botao
            disabled={pendente || !profissionalId}
            onClick={() => executar(() => alocarPedido(pedidoId, profissionalId))}
          >
            Alocar
          </Botao>
        </>
      )}

      {status === "ALOCADO" && (
        <>
          <Botao disabled={pendente} onClick={() => executar(() => marcarResultadoInterno(pedidoId, true))}>
            Marcar realizado
          </Botao>
          <Botao
            variante="secundario"
            disabled={pendente}
            onClick={() => executar(() => marcarResultadoInterno(pedidoId, false))}
          >
            Registrar falta
          </Botao>
          <Botao variante="secundario" disabled={pendente} onClick={() => executar(() => desalocarPedido(pedidoId))}>
            Desalocar
          </Botao>
        </>
      )}

      <Botao
        variante="perigo"
        disabled={pendente}
        onClick={() => {
          const motivo = window.prompt("Motivo do cancelamento (opcional):") ?? "";
          executar(() => cancelarPedido(pedidoId, motivo));
        }}
      >
        Cancelar
      </Botao>

      {mensagem && (
        <span className={`text-[11px] ${mensagem.erro ? "text-red-600" : "text-amber-700"}`}>{mensagem.texto}</span>
      )}
    </div>
  );
}
