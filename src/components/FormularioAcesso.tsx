"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Aviso, Botao } from "@/components/ui";
import { Credencial } from "@/components/Credencial";
import type { ResultadoAcesso } from "@/app/actions/acessos";

const INICIAL: ResultadoAcesso = { ok: false };

/**
 * Irmão do FormularioAcao para as ações que devolvem uma senha.
 *
 * Existe separado porque FormularioAcao é tipado em Resultado, que só carrega
 * ok/erro — não tem onde a senha sorteada caber. Fundir os dois obrigaria
 * toda tela de cadastro a conhecer um campo que só esta usa.
 */
export function FormularioAcesso({
  acao,
  botao = "Criar acesso",
  children,
}: {
  acao: (anterior: ResultadoAcesso, dados: FormData) => Promise<ResultadoAcesso>;
  botao?: string;
  children: React.ReactNode;
}) {
  const [estado, enviar] = useFormState(acao, INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);

  return (
    <div className="space-y-3">
      {estado.credencial && <Credencial credencial={estado.credencial} />}
      <form ref={formulario} action={enviar} className="space-y-3">
        {children}
        {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
        <Botao type="submit">{botao}</Botao>
      </form>
    </div>
  );
}
