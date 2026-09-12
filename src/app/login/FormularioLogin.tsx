"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Botao, Campo, Rotulo } from "@/components/ui";

export function FormularioLogin() {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setErro("");

    const dados = new FormData(evento.currentTarget);
    const resposta = await signIn("credentials", {
      email: String(dados.get("email") ?? ""),
      senha: String(dados.get("senha") ?? ""),
      redirect: false,
    });

    if (resposta?.error) {
      // Uma mensagem só para credencial errada e conta desativada: dizer qual
      // dos dois é confirma para quem tenta adivinhar que o e-mail existe.
      setErro("E-mail ou senha inválidos.");
      setEnviando(false);
      return;
    }

    // A raiz redireciona conforme o papel.
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={entrar} className="space-y-3">
      <div>
        <Rotulo>E-mail</Rotulo>
        <Campo name="email" type="email" required autoComplete="username" />
      </div>
      <div>
        <Rotulo>Senha</Rotulo>
        <Campo name="senha" type="password" required autoComplete="current-password" />
      </div>
      {erro && <div className="text-[11px] text-red-600">{erro}</div>}
      <Botao type="submit" disabled={enviando} className="w-full py-2.5">
        {enviando ? "Entrando…" : "Entrar"}
      </Botao>
    </form>
  );
}
