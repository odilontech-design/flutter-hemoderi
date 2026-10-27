"use client";

import { useEffect, useRef, useState } from "react";

const TAMANHO = 220;
const CENTRO = TAMANHO / 2;
const RAIO_NUMEROS = 82;

function doisDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

function lerHora(valor: string): { h: number; m: number } | null {
  const partes = /^(\d{1,2}):(\d{2})$/.exec(valor);
  if (!partes) return null;
  const h = Number(partes[1]);
  const m = Number(partes[2]);
  return h < 24 && m < 60 ? { h, m } : null;
}

/** Ponto na circunferência, com 0 no alto e crescendo no sentido horário. */
function ponto(grau: number, raio: number): { x: number; y: number } {
  const rad = ((grau - 90) * Math.PI) / 180;
  return { x: CENTRO + raio * Math.cos(rad), y: CENTRO + raio * Math.sin(rad) };
}

/**
 * Horário num relógio analógico (pedido do André, 27/10): toque na hora, depois
 * no minuto — o ponteiro acompanha o dedo ou o mouse. Vale o mesmo `value`
 * "HH:MM" do campo de horário comum, então o resto do formulário não muda.
 *
 * Com `name`, vai junto no envio do formulário (uso sem estado do pai).
 */
export function CampoHora({
  value,
  defaultValue = "",
  onChange,
  name,
  required,
  rotulo = "Horário",
  className = "",
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (valor: string) => void;
  name?: string;
  required?: boolean;
  rotulo?: string;
  className?: string;
}) {
  const controlado = value !== undefined;
  const [interno, setInterno] = useState(defaultValue);
  const atual = controlado ? value : interno;
  const [aberto, setAberto] = useState(false);
  const [fase, setFase] = useState<"hora" | "minuto">("hora");
  const [h12, setH12] = useState(12);
  const [pm, setPm] = useState(false);
  const [minuto, setMinuto] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const face = useRef<SVGSVGElement>(null);

  function abrir() {
    const lida = lerHora(atual);
    const agora = lida ?? { h: 9, m: 0 };
    setPm(agora.h >= 12);
    setH12(agora.h % 12 === 0 ? 12 : agora.h % 12);
    setMinuto(agora.m);
    setFase("hora");
    setAberto(true);
  }

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  function confirmar() {
    const h24 = (h12 % 12) + (pm ? 12 : 0);
    const texto = `${doisDigitos(h24)}:${doisDigitos(minuto)}`;
    if (!controlado) setInterno(texto);
    onChange?.(texto);
    setAberto(false);
  }

  function escolherPeloPonteiro(e: React.PointerEvent<SVGSVGElement>, terminou: boolean) {
    const caixa = face.current?.getBoundingClientRect();
    if (!caixa) return;
    const x = e.clientX - (caixa.left + caixa.width / 2);
    const y = e.clientY - (caixa.top + caixa.height / 2);
    const grau = ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360;
    if (fase === "hora") {
      const h = Math.round(grau / 30) % 12;
      setH12(h === 0 ? 12 : h);
      if (terminou) setFase("minuto");
    } else {
      setMinuto(Math.round(grau / 6) % 60);
    }
  }

  const grauDoPonteiro = fase === "hora" ? (h12 % 12) * 30 : minuto * 6;
  const ponta = ponto(grauDoPonteiro, RAIO_NUMEROS - 6);
  const numeros = fase === "hora" ? Array.from({ length: 12 }, (_, i) => i + 1) : Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div ref={raiz} className={`relative inline-block ${className}`}>
      {name && <input type="hidden" name={name} value={atual} />}
      <button
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={`${rotulo}: ${atual || "não escolhido"}`}
        className="inline-flex w-40 items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:border-bordo/50"
      >
        <span className={atual ? "" : "text-gray-400"}>{atual || "--:--"}</span>
        <span aria-hidden>🕒</span>
      </button>
      {required && !atual && <input tabIndex={-1} aria-hidden required value="" onChange={() => undefined} className="absolute inset-0 -z-10 opacity-0" />}

      {aberto && (
        <div role="dialog" aria-label="Escolher horário" className="absolute left-0 top-full z-50 mt-1 w-[260px] rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-baseline gap-1 font-display text-3xl font-bold">
              <button type="button" onClick={() => setFase("hora")} className={fase === "hora" ? "text-bordo" : "text-gray-400"}>
                {doisDigitos((h12 % 12) + (pm ? 12 : 0))}
              </button>
              <span className="text-gray-400">:</span>
              <button type="button" onClick={() => setFase("minuto")} className={fase === "minuto" ? "text-bordo" : "text-gray-400"}>
                {doisDigitos(minuto)}
              </button>
            </div>
            <div className="flex overflow-hidden rounded-lg border border-gray-300 text-xs font-semibold">
              {[false, true].map((tarde) => (
                <button
                  key={String(tarde)}
                  type="button"
                  onClick={() => setPm(tarde)}
                  className={`px-2.5 py-1.5 ${pm === tarde ? "bg-bordo text-white" : "bg-white text-gray-600"}`}
                >
                  {tarde ? "PM" : "AM"}
                </button>
              ))}
            </div>
          </div>

          <svg
            ref={face}
            viewBox={`0 0 ${TAMANHO} ${TAMANHO}`}
            width="100%"
            className="touch-none select-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              escolherPeloPonteiro(e, false);
            }}
            onPointerMove={(e) => e.buttons > 0 && escolherPeloPonteiro(e, false)}
            onPointerUp={(e) => escolherPeloPonteiro(e, true)}
          >
            <circle cx={CENTRO} cy={CENTRO} r={CENTRO - 4} className="fill-bege/60" />
            <line x1={CENTRO} y1={CENTRO} x2={ponta.x} y2={ponta.y} className="stroke-bordo" strokeWidth={2} />
            <circle cx={CENTRO} cy={CENTRO} r={4} className="fill-bordo" />
            <circle cx={ponta.x} cy={ponta.y} r={17} className="fill-bordo" />
            {numeros.map((n, i) => {
              const grau = fase === "hora" ? (n % 12) * 30 : i * 30;
              const p = ponto(grau, RAIO_NUMEROS);
              const selecionado = fase === "hora" ? n === h12 : n === minuto;
              return (
                <text
                  key={n}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={`pointer-events-none text-[13px] font-semibold ${selecionado ? "fill-white" : "fill-gray-700"}`}
                >
                  {fase === "hora" ? n : doisDigitos(n)}
                </text>
              );
            })}
          </svg>

          <div className="mt-1 text-center text-[10px] text-gray-400">
            {fase === "hora" ? "Toque na hora" : "Toque no minuto (de 1 em 1, arrastando)"}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setAberto(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="button" onClick={confirmar} className="rounded-lg bg-bordo px-3 py-1.5 text-xs font-semibold text-white hover:bg-bordoEscuro">
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
