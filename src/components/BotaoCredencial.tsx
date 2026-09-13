"use client";

import { useState, useTransition } from "react";
import { Botao } from "@/components/ui";
import { Credencial } from "@/components/Credencial";
import type { Credencial as DadosCredencial, ResultadoAcesso } from "@/app/actions/acessos";

/**
 * Gerar acesso / redefinir senha a partir de uma linha de tabela.
 *
 * A senha aparece numa sobreposição, não dentro da célula: a linha da tabela
 * não tem largura para um bloco com senha, dois botões e aviso, e espremer
 * isso ali é como a senha acaba cortada pelo overflow — que numa senha que
 * só aparece uma vez significa perdê-la.
 */
export function BotaoCredencial({
  acao,
  children,
  variante = "secundario",
  confirmar,
}: {
  acao: () => Promise<ResultadoAcesso>;
  children: React.ReactNode;
  variante?: "primario" | "secundario" | "perigo";
  confirmar?: string;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const [credencial, setCredencial] = useState<DadosCredencial | null>(null);

  return (
    <>
      <span className="inline-flex items-center gap-2">
        <Botao
          variante={variante}
          disabled={pendente}
          onClick={() => {
            if (confirmar && !window.confirm(confirmar)) return;
            setErro("");
            iniciar(async () => {
              const resultado = await acao();
              if (resultado.ok && resultado.credencial) setCredencial(resultado.credencial);
              else setErro(resultado.erro ?? "Não foi possível concluir.");
            });
          }}
        >
          {pendente ? "…" : children}
        </Botao>
        {erro && <span className="text-[11px] text-red-600">{erro}</span>}
      </span>

      {credencial && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          // Clicar fora fecha, mas só fora: um clique no botão de copiar não
          // pode derrubar a única tela onde a senha existe.
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) setCredencial(null);
          }}
        >
          <div className="bg-white rounded-2xl p-4 w-full max-w-sm">
            <Credencial credencial={credencial} aoFechar={() => setCredencial(null)} />
          </div>
        </div>
      )}
    </>
  );
}
