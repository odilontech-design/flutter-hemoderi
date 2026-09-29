"use client";

import { useState, useTransition } from "react";
import { Area, Botao } from "@/components/ui";
import { aceitarAlocacao, recusarAlocacao, registrarCheckin } from "@/app/actions/pedidos";
import { obterLocalizacao } from "@/lib/geolocalizacao";

/**
 * Aceitar ou recusar um atendimento que a logística indicou.
 *
 * A recusa só existe aqui, antes do aceite: depois de aceitar, sair do caso é
 * decisão da logística (ata de 21/09). Por isso o botão de recusar some da
 * tela no instante em que a pessoa aceita — e não vira um botão desabilitado
 * com explicação, que é convite para tentar.
 *
 * O motivo é opcional (ata de 28/09): ajuda a logística a remanejar, mas
 * exigir texto para poder recusar só trava quem está de fato indisponível.
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
          placeholder="Se puder, diga o motivo — ajuda a logística a remanejar. (opcional)"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Botao
            variante="perigo"
            disabled={pendente}
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
 *
 * Passado o horário, abre um campo de justificativa antes de confirmar (ata
 * de 28/09). O campo NÃO é obrigatório: o botão existe para a clínica saber
 * que alguém vem, e exigir texto para registrar a chegada atrasaria o aviso
 * que resolve o desencontro — que é o problema que ele veio resolver.
 */
export function BotaoCheckin({ pedidoId, atrasado }: { pedidoId: string; atrasado: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [buscandoLocal, setBuscandoLocal] = useState(false);
  const [justificando, setJustificando] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState("");

  function registrar() {
    setErro("");
    void (async () => {
      setBuscandoLocal(true);
      const posicao = await obterLocalizacao();
      setBuscandoLocal(false);
      iniciar(async () => {
        const resultado = await registrarCheckin(pedidoId, posicao, justificativa);
        if (!resultado.ok) setErro(resultado.erro ?? "Não foi possível registrar.");
      });
    })();
  }

  if (atrasado && !justificando) {
    return (
      <div>
        <Botao variante="secundario" onClick={() => setJustificando(true)}>
          Cheguei no local
        </Botao>
      </div>
    );
  }

  return (
    <div className={justificando ? "space-y-2 w-full" : ""}>
      {justificando && (
        <Area
          rows={2}
          autoFocus
          placeholder="Passou do horário. Se puder, diga o que atrasou — ajuda a central a avisar a clínica. (opcional)"
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
        />
      )}
      <Botao disabled={pendente || buscandoLocal} onClick={registrar}>
        {buscandoLocal ? "Confirmando localização…" : justificando ? "Confirmar chegada" : "Cheguei no local"}
      </Botao>
      {erro && <div className="text-[11px] text-red-600 mt-1">{erro}</div>}
    </div>
  );
}
