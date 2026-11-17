"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { signOut } from "next-auth/react";
import { excluirMinhaConta } from "@/app/actions/conta";
import { Campo, Aviso, Botao, Cartao } from "@/components/ui";
import { desregistrarAparelho } from "@/lib/ponte-app";
import type { Resultado } from "@/app/actions/pedidos";

function BotaoExcluir() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" variante="perigo" disabled={pending}>
      {pending ? "Excluindo…" : "Excluir minha conta"}
    </Botao>
  );
}

/**
 * Excluir a própria conta, de dentro do app (exigência da Apple e do Google).
 * Pede a senha e uma confirmação; ao concluir, sai da conta.
 */
export function ExcluirConta({ tipo }: { tipo: "clinica" | "profissional" }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useFormState<Resultado, FormData>(async (anterior, dados) => {
    const r = await excluirMinhaConta(anterior, dados);
    if (r.ok) {
      await desregistrarAparelho();
      void signOut({ callbackUrl: "/login" });
    }
    return r;
  }, { ok: false });

  return (
    <Cartao>
      <div className="font-display font-bold text-bordo text-sm mb-1">Excluir minha conta</div>
      <p className="text-[11px] text-gray-500 leading-relaxed mb-2">
        {tipo === "profissional"
          ? "Encerra o seu acesso e apaga o seu nome, e-mail, telefone e a agenda do Google conectada. O histórico de atendimentos, relatórios e repasses é mantido pelo prazo que a lei exige, sem ligação com a sua conta."
          : "Encerra o seu acesso e apaga o seu nome, e-mail e telefone. Os agendamentos, relatórios e cobranças da clínica são mantidos pelo prazo que a lei exige."}{" "}
        Saiba mais na{" "}
        <a href="/privacidade" className="underline">política de privacidade</a>.
      </p>
      {!aberto ? (
        <Botao type="button" variante="perigoSuave" onClick={() => setAberto(true)}>
          Quero excluir a minha conta
        </Botao>
      ) : (
        <form action={acao} className="space-y-2">
          <label className="block text-[11px] text-gray-600">
            Digite a sua senha para confirmar
            <Campo name="senha" type="password" autoComplete="current-password" required className="mt-1 max-w-xs" />
          </label>
          <label className="flex items-start gap-2 text-[11px] text-gray-700">
            <input type="checkbox" name="confirmo" value="sim" required className="mt-0.5" />
            Entendo que o meu acesso será encerrado e que isso não pode ser desfeito.
          </label>
          {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
          <div className="flex gap-2">
            <BotaoExcluir />
            <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
          </div>
        </form>
      )}
    </Cartao>
  );
}
