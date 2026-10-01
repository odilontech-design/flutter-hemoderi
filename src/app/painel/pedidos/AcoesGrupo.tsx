"use client";

import { useState, useTransition } from "react";
import type { PerfilInterno } from "@prisma/client";
import { Botao, Selecao } from "@/components/ui";
import { perfilPermite } from "@/lib/papeis";
import { alocarGrupo, cancelarGrupo, confirmarGrupo, desalocarGrupo } from "@/app/actions/pedidos";
import { AcaoComMotivo } from "./AcoesPedido";

/**
 * As ações de um agendamento com VÁRIOS serviços (mesmo grupo), no lugar de
 * repetir os mesmos botões em cada serviço: confirmar, alocar e cancelar valem
 * para a visita inteira. Cada botão age só nos serviços que estão no status
 * em que a ação faz sentido — "Alocar" não toca num serviço ainda solicitado.
 */
export function AcoesGrupo({
  grupoId,
  perfil,
  solicitados,
  confirmados,
  alocados,
  profissionais,
}: {
  grupoId: string;
  perfil: PerfilInterno;
  solicitados: number;
  confirmados: number;
  alocados: number;
  profissionais: { id: string; nome: string }[];
}) {
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [profissionalId, setProfissionalId] = useState("");

  function executar(acao: () => Promise<{ ok: boolean; erro?: string; avisos?: string[] }>) {
    setMensagem(null);
    iniciar(async () => {
      const resultado = await acao();
      if (!resultado.ok) setMensagem({ texto: resultado.erro ?? "Não foi possível concluir.", erro: true });
      else if (resultado.avisos?.length) setMensagem({ texto: resultado.avisos.join(" "), erro: false });
    });
  }

  const podeAlocar = perfilPermite(perfil, "LOGISTICA");
  const podeCancelar = perfilPermite(perfil, "COMERCIAL");

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
      {solicitados > 0 && (
        <Botao disabled={pendente} onClick={() => executar(() => confirmarGrupo(grupoId))}>
          Confirmar {solicitados > 1 ? `os ${solicitados} serviços` : "o serviço"}
        </Botao>
      )}

      {confirmados > 0 && podeAlocar && (
        <>
          <Selecao
            aria-label="Profissional para alocar em todos os serviços"
            value={profissionalId}
            onChange={(e) => setProfissionalId(e.target.value)}
            className="!w-auto !py-1.5 !min-h-[40px] sm:!min-h-0 text-xs"
          >
            <option value="">Alocar profissional…</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Selecao>
          <Botao
            disabled={pendente || !profissionalId}
            onClick={() => executar(() => alocarGrupo(grupoId, profissionalId))}
          >
            Alocar {confirmados > 1 ? `os ${confirmados} serviços` : "o serviço"}
          </Botao>
        </>
      )}

      {alocados > 0 && podeAlocar && (
        <AcaoComMotivo
          rotulo="Desalocar todos"
          variante="secundario"
          disabled={pendente}
          placeholder="Motivo da realocação"
          onConfirmar={(motivo) => executar(() => desalocarGrupo(grupoId, motivo))}
        />
      )}

      {podeCancelar && (
        <AcaoComMotivo
          rotulo="Cancelar todos"
          variante="perigo"
          disabled={pendente}
          placeholder="Motivo do cancelamento"
          onConfirmar={(motivo) => executar(() => cancelarGrupo(grupoId, motivo))}
        />
      )}

      {mensagem && (
        <div className={`w-full text-[11px] ${mensagem.erro ? "text-red-600" : "text-amber-700"}`}>{mensagem.texto}</div>
      )}
    </div>
  );
}
