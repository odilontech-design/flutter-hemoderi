"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { importarProfissionais, type ResultadoImportacao } from "@/app/actions/acessos";
import { Area, Aviso, Botao, Rotulo } from "@/components/ui";
import { Credencial } from "@/components/Credencial";

const INICIAL: ResultadoImportacao = { ok: false };

/**
 * A planilha de profissionais colada direto na tela.
 *
 * Sem upload de arquivo de propósito: o que chega é uma planilha no WhatsApp
 * ou no e-mail, e colar as células é um passo a menos que baixar, converter e
 * subir. O formato é adivinhado na leitura (tabulação, vírgula ou
 * ponto-e-vírgula), então quem importa não precisa saber qual tem em mãos.
 */
export function ImportarProfissionais() {
  const [estado, enviar] = useFormState(importarProfissionais, INICIAL);
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <Botao variante="secundario" onClick={() => setAberto(true)}>
        Importar planilha de profissionais
      </Botao>
    );
  }

  return (
    <div className="space-y-3">
      {estado.credenciais && estado.credenciais.length > 0 && (
        <div className="space-y-3">
          <Aviso tom="info">
            <strong>{estado.credenciais.length} profissional(is) importado(s).</strong> As senhas
            aparecem uma vez só — copie agora. Cada um troca a dele na primeira entrada.
          </Aviso>
          {estado.credenciais.map((credencial) => (
            <Credencial key={credencial.email} credencial={credencial} />
          ))}
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
            Quem já existe é pulado — nada é sobrescrito.
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
