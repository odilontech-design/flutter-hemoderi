"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Aviso, Botao } from "@/components/ui";
import type { Resultado } from "@/app/actions/pedidos";

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
}: {
  acao: (anterior: Resultado, dados: FormData) => Promise<Resultado>;
  botao?: string;
  children: React.ReactNode;
  className?: string;
  limparAoSalvar?: boolean;
}) {
  const [estado, enviar] = useFormState(acao, INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok && limparAoSalvar) formulario.current?.reset();
  }, [estado, limparAoSalvar]);

  return (
    <form ref={formulario} action={enviar} className={`space-y-3 ${className}`}>
      {children}
      {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      {estado.avisos?.length ? <Aviso tom="alerta">{estado.avisos.join(" ")}</Aviso> : null}
      <Botao type="submit">{botao}</Botao>
    </form>
  );
}
