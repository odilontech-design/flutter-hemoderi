"use client";

import { useEffect, useRef, useState } from "react";
import { pixDoAgendamento, type PixDoAgendamento } from "@/app/actions/cobrancas";
import { Aviso, Botao } from "@/components/ui";
import { formatarReais } from "@/lib/dinheiro";

/**
 * O QR Code do Pix no resumo do agendamento (pedido de 29/10): a clínica que
 * escolheu Pix paga ali mesmo — QR para ler no app do banco, copia-e-cola para
 * colar. Enquanto o código está na tela, confere o pagamento a cada 15s por até
 * 10 minutos; depois, o botão "Já paguei" faz a conferência na hora.
 */
export function PagarComPix({
  pedidoId,
  valorCentavos,
  pagoEm,
  disponivel,
  motivoIndisponivel,
}: {
  pedidoId: string;
  valorCentavos: number;
  pagoEm: string | null;
  disponivel: boolean;
  motivoIndisponivel?: string;
}) {
  const [pix, setPix] = useState<PixDoAgendamento | null>(pagoEm ? { ok: true, pago: true, pagoEm } : null);
  const [carregando, setCarregando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const inicio = useRef(0);

  const pago = Boolean(pix?.pago);
  const mostrando = Boolean(pix?.copiaECola) && !pago;

  async function chamar(gerar: boolean) {
    setCarregando(true);
    try {
      const resposta = await pixDoAgendamento(pedidoId, gerar);
      setPix((atual) => (resposta.ok || !atual?.copiaECola ? resposta : atual));
      return resposta;
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!mostrando) return;
    inicio.current = Date.now();
    const intervalo = setInterval(async () => {
      if (Date.now() - inicio.current > 10 * 60 * 1000) return clearInterval(intervalo);
      const r = await pixDoAgendamento(pedidoId, false);
      if (r.ok && r.pago) {
        setPix(r);
        clearInterval(intervalo);
      }
    }, 15_000);
    return () => clearInterval(intervalo);
  }, [mostrando, pedidoId]);

  async function copiar() {
    if (!pix?.copiaECola) return;
    try {
      await navigator.clipboard.writeText(pix.copiaECola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      // Sem permissão de área de transferência: o texto segue selecionável na tela.
    }
  }

  if (pago) {
    return (
      <Aviso tom="info">
        <div className="font-semibold">✓ Pix recebido</div>
        <div className="text-[11px]">
          Pagamento de {formatarReais(valorCentavos)} confirmado
          {pix?.pagoEm ? ` em ${new Date(pix.pagoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}. Obrigado!
        </div>
      </Aviso>
    );
  }

  return (
    <div className="rounded-2xl border border-bordo/30 bg-white p-4">
      <div className="font-display font-bold text-bordo text-sm">Pagamento por Pix</div>
      <div className="text-[11px] text-gray-500 mb-3 leading-relaxed">
        Valor: <strong className="text-gray-800">{formatarReais(valorCentavos)}</strong>. Gere o QR Code e pague pelo app do seu banco.
      </div>

      {!disponivel && <Aviso tom="alerta">{motivoIndisponivel}</Aviso>}

      {disponivel && !mostrando && (
        <Botao type="button" disabled={carregando} onClick={() => chamar(true)}>
          {carregando ? "Gerando…" : "Gerar QR Code do Pix"}
        </Botao>
      )}

      {pix && !pix.ok && pix.erro && <div className="mt-2 text-[11px] text-red-700">{pix.erro}</div>}

      {mostrando && pix && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR já vem como imagem embutida. */}
            <img src={pix.imagem} alt="QR Code do Pix" width={200} height={200} className="rounded-lg border border-gray-200" />
            <div className="min-w-0 flex-1 basis-60 space-y-2">
              <div className="text-[11px] text-gray-500">Ou use o Pix copia e cola:</div>
              <textarea
                readOnly
                value={pix.copiaECola}
                rows={4}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-lg border border-gray-300 p-2 text-[10px] font-mono text-gray-700"
              />
              <div className="flex flex-wrap gap-2">
                <Botao type="button" variante="secundario" onClick={copiar}>
                  {copiado ? "Copiado ✓" : "Copiar código"}
                </Botao>
                <Botao type="button" variante="secundario" disabled={carregando} onClick={() => chamar(false)}>
                  {carregando ? "Conferindo…" : "Já paguei"}
                </Botao>
              </div>
            </div>
          </div>
          <div className="text-[10px] text-gray-400">
            O pagamento é conferido sozinho, em alguns segundos. O recebedor aparece no app do banco como a Hemoderi.
          </div>
        </div>
      )}
    </div>
  );
}
