"use client";

import { useState, useTransition } from "react";
import type { PerfilInterno } from "@prisma/client";
import { Botao, Selecao } from "@/components/ui";
import { perfilPermite } from "@/lib/papeis";
import { alocarGrupo, alocarServicos, cancelarGrupo, confirmarGrupo, desalocarGrupo } from "@/app/actions/pedidos";
import { AcaoComMotivo, CampoAjudaDeCusto } from "./AcoesPedido";

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
  servicosConfirmados,
}: {
  grupoId: string;
  perfil: PerfilInterno;
  solicitados: number;
  confirmados: number;
  alocados: number;
  profissionais: { id: string; nome: string }[];
  /** Os serviços confirmados, cada um com quem pode atendê-lo (apto e livre). */
  servicosConfirmados: { pedidoId: string; nome: string; hora: string; profissionais: { id: string; nome: string }[] }[];
}) {
  const [pendente, iniciar] = useTransition();
  const [ajudaCusto, setAjudaCusto] = useState("");
  // Um profissional por serviço (ata de 05/10): cada serviço da visita pode ir
  // para alguém diferente, com a própria ajuda de custo.
  const [porServico, setPorServico] = useState(false);
  const [escolhas, setEscolhas] = useState<Record<string, { profissionalId: string; ajudaCusto: string }>>({});
  const escolha = (id: string) => escolhas[id] ?? { profissionalId: "", ajudaCusto: "" };
  const alterar = (id: string, mudanca: Partial<{ profissionalId: string; ajudaCusto: string }>) =>
    setEscolhas((atuais) => ({ ...atuais, [id]: { ...escolha(id), ...mudanca } }));
  const atribuicoes = servicosConfirmados
    .filter((s) => escolha(s.pedidoId).profissionalId)
    .map((s) => ({ pedidoId: s.pedidoId, ...escolha(s.pedidoId) }));
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

      {confirmados > 1 && podeAlocar && (
        <button
          type="button"
          onClick={() => setPorServico((v) => !v)}
          className="text-[11px] font-semibold text-bordo hover:underline"
        >
          {porServico ? "← Alocar todos no mesmo profissional" : "Um profissional por serviço →"}
        </button>
      )}

      {confirmados > 1 && podeAlocar && porServico && (
        <div className="w-full space-y-2 rounded-xl border border-gray-200 p-3">
          <div className="text-[11px] text-gray-500">
            Escolha quem atende cada serviço. O serviço sem profissional escolhido continua confirmado,
            esperando alocação. Só aparecem profissionais aptos e livres no horário de cada um.
          </div>
          {servicosConfirmados.map((servico) => (
            <div key={servico.pedidoId} className="flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-56 text-xs text-gray-800">
                <span className="font-semibold text-gray-500">{servico.hora}</span> · {servico.nome}
              </div>
              <Selecao
                aria-label={`Profissional — ${servico.nome}`}
                value={escolha(servico.pedidoId).profissionalId}
                onChange={(e) => alterar(servico.pedidoId, { profissionalId: e.target.value })}
                className="!w-auto !py-1.5 !min-h-[40px] sm:!min-h-0 text-xs"
              >
                <option value="">Escolher profissional…</option>
                {servico.profissionais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Selecao>
              <CampoAjudaDeCusto
                valor={escolha(servico.pedidoId).ajudaCusto}
                onChange={(valor) => alterar(servico.pedidoId, { ajudaCusto: valor })}
              />
            </div>
          ))}
          <Botao
            disabled={pendente || atribuicoes.length === 0}
            onClick={() => executar(() => alocarServicos(grupoId, atribuicoes))}
          >
            Alocar {atribuicoes.length > 1 ? `os ${atribuicoes.length} serviços` : "o serviço"}
          </Botao>
        </div>
      )}

      {confirmados > 0 && podeAlocar && !(porServico && confirmados > 1) && (
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
          <CampoAjudaDeCusto valor={ajudaCusto} onChange={setAjudaCusto} />
          <Botao
            disabled={pendente || !profissionalId}
            onClick={() => executar(() => alocarGrupo(grupoId, profissionalId, ajudaCusto))}
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
