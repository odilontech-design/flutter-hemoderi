"use client";

import { useState } from "react";
import { Botao } from "@/components/ui";
import type { Credencial as DadosCredencial } from "@/app/actions/acessos";

/**
 * A senha recém-sorteada, na tela de quem a gerou.
 *
 * Aparece uma vez só: o banco guarda o hash, então nem o sistema consegue
 * mostrar de novo. Por isso o aviso é explícito e o botão de copiar sai a
 * mensagem inteira, pronta para colar no WhatsApp — o jeito como a senha
 * realmente chega na clínica e no profissional. Deixar só o campo na tela
 * empurra o atendente a anotar num papel, que é exatamente o que a senha
 * provisória existe para evitar.
 */
export function Credencial({ credencial, aoFechar }: { credencial: DadosCredencial; aoFechar?: () => void }) {
  const [copiado, setCopiado] = useState<"" | "senha" | "mensagem">("");

  const mensagem = [
    `Olá, ${credencial.nome.split(" ")[0]}!`,
    "",
    `Seu acesso ao sistema da Hemoderi:`,
    `Endereço: ${typeof window === "undefined" ? "" : window.location.origin}/login`,
    `E-mail: ${credencial.email}`,
    `Senha provisória: ${credencial.senha}`,
    "",
    "Na primeira entrada o sistema pede para você escolher a sua senha definitiva.",
  ].join("\n");

  async function copiar(texto: string, qual: "senha" | "mensagem") {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      setTimeout(() => setCopiado(""), 2000);
    } catch {
      // Sem permissão de área de transferência (ou fora de HTTPS): a senha
      // está à vista logo acima para copiar à mão.
      setCopiado("");
    }
  }

  return (
    <div className="border border-green-300 bg-green-50 rounded-xl p-4 space-y-3">
      <div className="text-xs font-semibold text-green-800">
        {credencial.redefinida ? "Senha redefinida" : "Acesso criado"} · {credencial.nome}
      </div>

      <div className="text-[11px] text-green-900/70 break-all">{credencial.email}</div>

      <div className="bg-white border border-green-200 rounded-lg px-3 py-2.5 text-center">
        <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Senha provisória</div>
        <div className="font-mono font-bold text-base sm:text-lg text-bordo tracking-wider break-all">
          {credencial.senha}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Botao variante="secundario" onClick={() => copiar(credencial.senha, "senha")}>
          {copiado === "senha" ? "Copiado ✓" : "Copiar senha"}
        </Botao>
        <Botao variante="secundario" onClick={() => copiar(mensagem, "mensagem")}>
          {copiado === "mensagem" ? "Copiado ✓" : "Copiar mensagem"}
        </Botao>
        {aoFechar && (
          <Botao variante="secundario" onClick={aoFechar}>
            Fechar
          </Botao>
        )}
      </div>

      <div className="text-[10px] text-green-900/70 leading-relaxed">
        Anote ou copie agora: esta senha não aparece de novo — o sistema guarda só
        o resumo criptográfico dela. Na primeira entrada, {credencial.nome.split(" ")[0]} é
        obrigado a escolher a senha definitiva, que ninguém da equipe conhece.
      </div>
    </div>
  );
}
