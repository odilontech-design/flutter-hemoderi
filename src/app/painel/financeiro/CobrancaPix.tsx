"use client";

import { useState, useTransition } from "react";
import { Botao } from "@/components/ui";
import { gerarCobrancaPixFatura, consultarCobrancaPix, cancelarCobrancaPix } from "@/app/actions/cobrancas";

type Cobranca = {
  id: string;
  txid: string;
  valorCentavos: number;
  status: string;
  copiaECola: string | null;
  imagemQrUrl: string | null;
  pagoEm: string | null;
};

export function GerarPix({ faturaId }: { faturaId: string }) {
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();

  return (
    <span className="inline-flex items-center gap-2">
      <Botao
        variante="primario"
        disabled={pendente}
        onClick={() => {
          setErro("");
          iniciar(async () => {
            const r = await gerarCobrancaPixFatura(faturaId);
            if (!r.ok) setErro(r.erro ?? "Erro ao gerar Pix.");
          });
        }}
      >
        {pendente ? "Gerando…" : "Gerar Pix"}
      </Botao>
      {erro && <span className="text-[10px] text-red-600 ml-1">{erro}</span>}
    </span>
  );
}

export function DetalhePix({ cobranca }: { cobranca: Cobranca }) {
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();

  async function copiarCodigo() {
    if (!cobranca.copiaECola) return;
    try {
      await navigator.clipboard.writeText(cobranca.copiaECola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  if (cobranca.status === "CONCLUIDA") {
    return (
      <div className="text-[10px] text-emerald-700 font-semibold">
        Pago via Pix
        {cobranca.pagoEm && ` em ${new Date(cobranca.pagoEm).toLocaleDateString("pt-BR")}`}
      </div>
    );
  }

  if (cobranca.status === "CANCELADA") {
    return <div className="text-[10px] text-gray-400">Pix cancelado</div>;
  }

  if (cobranca.status === "EXPIRADA") {
    return <div className="text-[10px] text-amber-600">Pix expirado</div>;
  }

  return (
    <div className="mt-1 space-y-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        {cobranca.copiaECola && (
          <Botao variante="secundario" onClick={copiarCodigo}>
            {copiado ? "Copiado!" : "Copiar código Pix"}
          </Botao>
        )}
        <Botao
          variante="secundario"
          disabled={pendente}
          onClick={() => {
            setErro("");
            iniciar(async () => {
              const r = await consultarCobrancaPix(cobranca.id);
              if (!r.ok) setErro(r.erro ?? "Erro ao consultar.");
            });
          }}
        >
          {pendente ? "…" : "Atualizar status"}
        </Botao>
        <Botao
          variante="perigo"
          disabled={pendente}
          onClick={() => {
            if (!window.confirm("Cancelar esta cobrança Pix?")) return;
            setErro("");
            iniciar(async () => {
              const r = await cancelarCobrancaPix(cobranca.id);
              if (!r.ok) setErro(r.erro ?? "Erro ao cancelar.");
            });
          }}
        >
          Cancelar
        </Botao>
      </div>
      {cobranca.copiaECola && (
        <div className="text-[9px] text-gray-400 font-mono break-all max-w-xs">
          {cobranca.copiaECola.slice(0, 60)}…
        </div>
      )}
      {erro && <div className="text-[10px] text-red-600">{erro}</div>}
    </div>
  );
}
