"use client";

import { useEffect } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trocarSenha } from "@/app/actions/acessos";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha";
import { Aviso, Botao, Campo, Rotulo } from "@/components/ui";
import type { Resultado } from "@/app/actions/pedidos";

const INICIAL: Resultado = { ok: false };

export function FormularioTrocarSenha({
  inicio,
  obrigatoria,
  email,
}: {
  inicio: string;
  obrigatoria: boolean;
  email: string;
}) {
  const [estado, enviar] = useFormState(trocarSenha, INICIAL);
  const router = useRouter();

  useEffect(() => {
    if (!estado.ok) return;
    // refresh antes do replace: a guarda da rota de destino lê senhaProvisoria
    // do banco, e sem invalidar o cache de rotas o Next pode servir a versão
    // renderizada quando a senha ainda era provisória — que redirecionaria de
    // volta para cá.
    router.refresh();
    router.replace(inicio);
  }, [estado, inicio, router]);

  return (
    <form action={enviar} className="space-y-3">
      {/* Invisível, mas o gerenciador de senhas do navegador precisa dele para
          saber de qual conta é a senha que está sendo trocada. */}
      <input type="hidden" name="email" value={email} autoComplete="username" readOnly />

      <div>
        <Rotulo>{obrigatoria ? "Senha que você recebeu" : "Senha atual"}</Rotulo>
        <Campo name="atual" type="password" required autoComplete="current-password" />
      </div>
      <div>
        <Rotulo>Nova senha</Rotulo>
        <Campo
          name="nova"
          type="password"
          required
          minLength={TAMANHO_MINIMO_SENHA}
          autoComplete="new-password"
        />
        <div className="text-[10px] text-gray-400 mt-1">
          Ao menos {TAMANHO_MINIMO_SENHA} caracteres. Prefira algo longo e fácil de lembrar
          a algo curto e cheio de símbolos.
        </div>
      </div>
      <div>
        <Rotulo>Repita a nova senha</Rotulo>
        <Campo name="confirmacao" type="password" required autoComplete="new-password" />
      </div>

      {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
      {estado.ok && <Aviso tom="info">Senha trocada. Levando você para o sistema…</Aviso>}

      <Botao type="submit" className="w-full py-2.5">
        Salvar nova senha
      </Botao>

      {!obrigatoria && (
        <Link href={inicio} className="block text-center text-[11px] text-gray-400 hover:text-bordo">
          Voltar sem trocar
        </Link>
      )}
    </form>
  );
}
