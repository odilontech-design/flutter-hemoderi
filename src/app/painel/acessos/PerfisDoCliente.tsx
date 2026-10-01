"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { alternarPerfilDaClinica } from "@/app/actions/clientes";
import { ROTULO_PERFIL_CLIENTE, TODOS_OS_PERFIS } from "@/lib/visibilidade";

/**
 * Os perfis do cliente — Odontologia, Medicina, Estética, Curso, Mandic e
 * Parceiro — num botão compacto que abre uma janelinha com as opções.
 *
 * Seis chips soltos em cada linha estouravam a tabela; aqui a linha mostra só
 * o resumo ("Odontologia, Mandic") e as opções aparecem sob demanda. Cada chip
 * liga/desliga na hora — mais de um perfil é normal (quem atende e dá curso).
 * O perfil é da CLÍNICA, não da pessoa: dois acessos dela mostram o mesmo.
 *
 * A janelinha é `fixed`, posicionada pelo botão, e não `absolute`: a tabela
 * tem overflow-x-auto e cortaria qualquer coisa que saísse dela.
 */
export function PerfisDoCliente({
  clinicaId,
  perfisAtuais,
  desabilitado,
}: {
  clinicaId: string;
  perfisAtuais: string[];
  desabilitado?: boolean;
}) {
  const [perfis, setPerfis] = useState<string[]>(perfisAtuais);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const janela = useRef<HTMLDivElement>(null);

  const aberto = posicao !== null;

  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setPosicao(null);
    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!janela.current?.contains(alvo) && !botao.current?.contains(alvo)) fechar();
    };
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  function abrir() {
    if (aberto) return setPosicao(null);
    const r = botao.current!.getBoundingClientRect();
    // 256px é a largura da janelinha; mantém dentro da tela.
    setPosicao({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 264)) });
  }

  const resumo = TODOS_OS_PERFIS.filter((p) => perfis.includes(p))
    .map((p) => ROTULO_PERFIL_CLIENTE[p])
    .join(", ");

  return (
    <div>
      <button
        ref={botao}
        type="button"
        disabled={desabilitado}
        aria-expanded={aberto}
        onClick={abrir}
        className={`inline-flex items-center gap-1.5 max-w-[11rem] text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border disabled:opacity-60 ${
          perfis.length === 0
            ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
            : "bg-white text-bordo border-gray-300 hover:bg-gray-50"
        }`}
      >
        <span className="truncate">{perfis.length === 0 ? "Definir perfil" : resumo}</span>
        <span aria-hidden className="text-[9px] shrink-0">▾</span>
      </button>

      {aberto && (
        <div
          ref={janela}
          style={{ top: posicao.top, left: posicao.left }}
          className="fixed z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3"
        >
          <div className="text-[11px] font-semibold text-gray-700 mb-2">Perfil do cliente</div>
          <div className="flex flex-wrap gap-1.5">
            {TODOS_OS_PERFIS.map((perfil) => {
              const ligado = perfis.includes(perfil);
              return (
                <button
                  key={perfil}
                  type="button"
                  disabled={pendente}
                  aria-pressed={ligado}
                  onClick={() => {
                    const anteriores = perfis;
                    setPerfis(ligado ? perfis.filter((p) => p !== perfil) : [...perfis, perfil]);
                    setErro("");
                    iniciar(async () => {
                      const r = await alternarPerfilDaClinica(clinicaId, perfil, !ligado);
                      if (!r.ok) {
                        setPerfis(anteriores);
                        setErro(r.erro ?? "Não foi possível alterar.");
                      }
                    });
                  }}
                  className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-full border transition-colors disabled:opacity-60 ${
                    ligado
                      ? "bg-bordo text-white border-bordo"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {ROTULO_PERFIL_CLIENTE[perfil]}
                </button>
              );
            })}
          </div>
          <div className="text-[10px] text-gray-400 mt-2 leading-snug">
            {perfis.length === 0
              ? "Sem perfil, o cliente vê só o catálogo não restrito e o preço padrão."
              : "Define o catálogo e a tabela de preço do cliente. Pode marcar mais de um."}
          </div>
          {erro && <div className="text-[10px] text-red-600 mt-1">{erro}</div>}
        </div>
      )}
    </div>
  );
}
