"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { Aviso, Botao } from "@/components/ui";
import type { Resultado } from "@/app/actions/pedidos";
import { useConfirmarSalvo } from "@/components/ConfirmacaoSalvo";

const INICIAL: Resultado = { ok: false };

/**
 * Formulário de cadastro com o resultado da server action na tela.
 *
 * Existe para que toda tela de cadastro trate erro do mesmo jeito: a mensagem
 * aparece embaixo do próprio formulário e os campos continuam preenchidos.
 * Um cadastro que some quando a validação recusa é o que faz a pessoa digitar
 * tudo de novo — e desistir na segunda vez.
 */
export function FormularioAcao({
  acao,
  botao = "Salvar",
  children,
  className = "",
  limparAoSalvar = true,
  aoSalvar,
  tela = true,
}: {
  acao: (anterior: Resultado, dados: FormData) => Promise<Resultado>;
  botao?: string;
  children: React.ReactNode;
  className?: string;
  limparAoSalvar?: boolean;
  /** Chamado quando a ação volta `ok` — usado, por exemplo, para voltar à lista depois de cadastrar. */
  aoSalvar?: (estado: Resultado) => void;
  /** Abre a tela de confirmação do envio (reunião de 28/10). Padrão: sim. */
  tela?: boolean;
}) {
  const [estado, enviar] = useFormState(acao, INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const avisarSalvo = useConfirmarSalvo();
  // Fica ao lado do botão até o próximo envio: o aviso do rodapé some, este não.
  const [salvo, setSalvo] = useState("");

  useEffect(() => {
    if (!estado.ok) return;
    setSalvo(avisarSalvo("Enviado", { tela, titulo: "Enviado com sucesso", detalhes: estado.avisos }));
    if (limparAoSalvar) formulario.current?.reset();
    aoSalvar?.(estado);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aoSalvar só dispara na mudança de `estado`, não a cada nova identidade de função.
  }, [estado, limparAoSalvar]);

  return (
    <form ref={formulario} action={enviar} onSubmit={() => setSalvo("")} className={`space-y-3 ${className}`}>
      {children}
      {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      {estado.avisos?.length ? <Aviso tom="alerta">{estado.avisos.join(" ")}</Aviso> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Botao type="submit">{botao}</Botao>
        {salvo && <span className="text-[11px] font-semibold text-green-700">✓ {salvo}</span>}
      </div>
    </form>
  );
}
