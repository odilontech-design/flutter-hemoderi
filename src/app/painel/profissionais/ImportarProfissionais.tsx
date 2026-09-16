"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { importarProfissionais, type ResultadoImportacao } from "@/app/actions/acessos";
import { Area, Aviso, Botao, Rotulo } from "@/components/ui";

const INICIAL: ResultadoImportacao = { ok: false };

/**
 * A planilha de profissionais colada direto na tela.
 *
 * Sem upload de arquivo de propósito: o que chega é uma planilha no WhatsApp
 * ou no e-mail, e colar as células é um passo a menos que baixar, converter e
 * subir. O formato é adivinhado na leitura (tabulação, vírgula ou
 * ponto-e-vírgula), então quem importa não precisa saber qual tem em mãos.
 *
 * A senha do lote é UMA só, mostrada uma vez só — não uma por linha. É o
 * mesmo cuidado de sempre (o banco guarda só o hash, então nem o sistema
 * consegue mostrar de novo), mas a mensagem muda: em vez de sessenta
 * credenciais para copiar uma a uma, é um aviso único que a equipe manda
 * para todo mundo de uma vez, e a lista abaixo é só para conferir quem
 * entrou.
 */
export function ImportarProfissionais() {
  const [estado, enviar] = useFormState(importarProfissionais, INICIAL);
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  if (!aberto) {
    return (
      <Botao variante="secundario" onClick={() => setAberto(true)}>
        Importar planilha de profissionais
      </Botao>
    );
  }

  const mensagem = estado.senhaPadrao
    ? [
        "Olá! Seu acesso ao sistema da Hemoderi:",
        "",
        `Endereço: ${typeof window === "undefined" ? "" : window.location.origin}/login`,
        "E-mail: o mesmo que você recebeu este aviso",
        `Senha provisória: ${estado.senhaPadrao}`,
        "",
        "Na primeira entrada o sistema pede para você escolher a sua senha definitiva.",
      ].join("\n")
    : "";

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de área de transferência: a senha está visível acima
      // para copiar à mão.
    }
  }

  return (
    <div className="space-y-3">
      {estado.senhaPadrao && estado.importados && estado.importados.length > 0 && (
        <div className="border border-green-300 bg-green-50 rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-green-800">
            {estado.importados.length} profissional(is) importado(s) — mesma senha para todos
          </div>

          <div className="bg-white border border-green-200 rounded-lg px-3 py-2.5 text-center">
            <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">
              Senha provisória do lote
            </div>
            <div className="font-mono font-bold text-base sm:text-lg text-bordo tracking-wider break-all">
              {estado.senhaPadrao}
            </div>
          </div>

          <Botao variante="secundario" onClick={copiar}>
            {copiado ? "Copiado ✓" : "Copiar mensagem para enviar"}
          </Botao>

          <div className="text-[10px] text-green-900/70 leading-relaxed">
            Anote ou copie agora: esta senha não aparece de novo — o sistema guarda só o resumo
            criptográfico dela. Vale só até a primeira entrada de cada um: o sistema obriga a
            escolher uma senha definitiva, que ninguém da equipe conhece — nem esta, repetida.
          </div>

          <ul className="text-[11px] text-green-900/80 space-y-0.5 pt-1 border-t border-green-200">
            {estado.importados.map((p) => (
              <li key={p.email}>
                {p.nome} <span className="text-green-900/50">· {p.email}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {estado.jaExistiam && estado.jaExistiam.length > 0 && (
        <Aviso tom="alerta">
          <strong>{estado.jaExistiam.length} já estavam cadastrados</strong> e foram pulados (nada
          foi sobrescrito): {estado.jaExistiam.join(", ")}
        </Aviso>
      )}

      {estado.problemas && estado.problemas.length > 0 && (
        <Aviso tom="erro">
          <strong>{estado.problemas.length} linha(s) não deram para importar:</strong>
          <ul className="mt-1 space-y-0.5">
            {estado.problemas.map((problema, i) => (
              <li key={i}>
                {problema.linha > 0 && `linha ${problema.linha}: `}
                {problema.motivo} — <span className="text-gray-500">{problema.conteudo}</span>
              </li>
            ))}
          </ul>
        </Aviso>
      )}

      <form action={enviar} className="space-y-3">
        <div>
          <Rotulo>Cole a planilha aqui</Rotulo>
          <Area
            name="planilha"
            rows={8}
            required
            className="font-mono text-[11px]"
            placeholder={"Ana\tRibeiro\tana@exemplo.com\nBruno\tTavares\tbruno@exemplo.com"}
          />
          <div className="text-[10px] text-gray-400 mt-1">
            Um profissional por linha, com nome e e-mail. Serve colar direto do Excel, ou um CSV.
            Quem já existe é pulado — nada é sobrescrito. Todo mundo importado numa mesma colagem
            recebe a mesma senha provisória, para avisar todo mundo de uma vez.
          </div>
        </div>
        {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
        <div className="flex flex-wrap gap-2">
          <Botao type="submit">Importar e gerar acessos</Botao>
          <Botao variante="secundario" onClick={() => setAberto(false)} type="button">
            Fechar
          </Botao>
        </div>
      </form>
    </div>
  );
}
