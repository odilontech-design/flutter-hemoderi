"use client";

import { useState, useTransition } from "react";
import { Area, Botao } from "@/components/ui";
import { aceitarAlocacao, recusarAlocacao, registrarCheckin } from "@/app/actions/pedidos";
import { obterLocalizacao } from "@/lib/geolocalizacao";

/**
 * Aceitar ou recusar um atendimento que a logística indicou.
 *
 * A recusa pede motivo e só existe aqui, antes do aceite: depois de aceitar,
 * sair do caso é decisão da logística (ata de 21/09). Por isso o botão de
 * recusar some da tela no instante em que a pessoa aceita — e não vira um
 * botão desabilitado com explicação, que é convite para tentar.
 */
export function AceiteAlocacao({ pedidoId }: { pedidoId: string }) {
  const [pendente, iniciar] = useTransition();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");

  function executar(acao: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro("");
    iniciar(async () => {
      const resultado = await acao();
      if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível concluir.");
    });
  }

  if (recusando) {
    return (
      <div className="space-y-2">
        <Area
          rows={2}
          placeholder="Por que não consegue atender? A logística precisa saber para remanejar."
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Botao
            variante="perigo"
            disabled={pendente || !motivo.trim()}
            onClick={() => executar(() => recusarAlocacao(pedidoId, motivo))}
          >
            Confirmar recusa
          </Botao>
          <Botao variante="secundario" disabled={pendente} onClick={() => setRecusando(false)}>
            Voltar
          </Botao>
        </div>
        {erro && <div className="text-[11px] text-red-600">{erro}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Botao disabled={pendente} onClick={() => executar(() => aceitarAlocacao(pedidoId))}>
        Aceitar atendimento
      </Botao>
      <Botao variante="secundario" disabled={pendente} onClick={() => setRecusando(true)}>
        Não consigo atender
      </Botao>
      {erro && <span className="text-[11px] text-red-600">{erro}</span>}
    </div>
  );
}

/**
 * Check-in de chegada. Pede a localização no clique — nunca antes, mesmo
 * motivo do relatório — e nunca trava por causa dela: sem permissão ou sem
 * sinal o check-in é registrado do mesmo jeito, só sem coordenada.
 */
export function BotaoCheckin({ pedidoId }: { pedidoId: string }) {
  const [pendente, iniciar] = useTransition();
  const [buscandoLocal, setBuscandoLocal] = useState(false);
  const [erro, setErro] = useState("");

  return (
    <div>
      <Botao
        disabled={pendente || buscandoLocal}
        onClick={async () => {
          setErro("");
          setBuscandoLocal(true);
          const posicao = await obterLocalizacao();
          setBuscandoLocal(false);
          iniciar(async () => {
            const resultado = await registrarCheckin(pedidoId, posicao);
            if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível registrar.");
          });
        }}
      >
        {buscandoLocal ? "Confirmando localização…" : "Cheguei no local"}
      </Botao>
      {erro && <div className="text-[11px] text-red-600 mt-1">{erro}</div>}
    </div>
  );
}
