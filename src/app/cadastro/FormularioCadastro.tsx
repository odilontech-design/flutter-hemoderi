"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { CONSELHOS } from "@/lib/conselhos";
import { CamposEndereco } from "@/components/CamposEndereco";
import { CampoDocumento } from "@/components/CampoDocumento";
import { autocadastrar } from "@/app/actions/autocadastro";
import type { Resultado } from "@/app/actions/pedidos";
import { PERFIS_DO_AUTOCADASTRO, ROTULO_PERFIL_CLIENTE } from "@/lib/visibilidade";

const INICIAL: Resultado = { ok: false };

export function FormularioCadastro() {
  const [estado, enviar] = useFormState(autocadastrar, INICIAL);
  const [perfil, setPerfil] = useState("");

  if (estado.ok) {
    return (
      <div className="space-y-3">
        <Aviso>
          <div className="font-semibold mb-1">Cadastro concluído!</div>
          Já pode entrar com o e-mail e a senha que você escolheu: o catálogo e o agendamento estão liberados.
        </Aviso>
        <Link
          href="/login"
          className="inline-flex bg-bordo text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-bordoEscuro"
        >
          Entrar no portal
        </Link>
      </div>
    );
  }

  return (
    <form action={enviar} className="space-y-4">
      {/* Isca para robôs: fora da tela e fora da ordem de tabulação. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input name="site" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <Rotulo>Você atua em</Rotulo>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
          {PERFIS_DO_AUTOCADASTRO.map((valor) => (
            <label
              key={valor}
              className={`cursor-pointer rounded-xl border p-3 text-xs font-semibold text-center transition-colors ${
                perfil === valor ? "border-bordo bg-bordo text-white" : "border-gray-200 hover:border-bordo/40 text-bordo"
              }`}
            >
              <input
                type="radio"
                name="perfil"
                value={valor}
                required
                checked={perfil === valor}
                onChange={() => setPerfil(valor)}
                className="sr-only"
              />
              {ROTULO_PERFIL_CLIENTE[valor]}
            </label>
          ))}
        </div>
        <div className="text-[10px] text-gray-400 mt-1">
          Define o catálogo e a tabela de preço que você enxerga.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Rotulo>Nome da clínica ou consultório</Rotulo>
          <Campo name="nome" required />
        </div>
        <div>
          <Rotulo>Seu nome (responsável)</Rotulo>
          <Campo name="responsavel" required autoComplete="name" />
        </div>
        <div>
          <Rotulo>Conselho de classe</Rotulo>
          <Selecao name="conselho" required defaultValue="">
            <option value="">Selecione…</option>
            {CONSELHOS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Selecao>
        </div>
        <div>
          <Rotulo>Número do registro</Rotulo>
          <Campo name="registroConselho" required maxLength={20} placeholder="12345 ou SP-12345" />
        </div>
        <div>
          <Rotulo>E-mail</Rotulo>
          <Campo name="email" type="email" required autoComplete="username" />
        </div>
        <div>
          <Rotulo>Telefone / WhatsApp</Rotulo>
          <Campo name="telefone" required placeholder="(11) 99999-0000" autoComplete="tel" />
        </div>
      </div>

      <CampoDocumento tipo="cnpj" name="cnpj" rotulo="CNPJ ou CPF" obrigatorio />

      <div>
        <div className="font-display font-bold text-bordo text-sm mb-2">Onde atendemos você</div>
        <div className="space-y-2">
          <CamposEndereco />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Rotulo>Senha</Rotulo>
          <Campo name="senha" type="password" required minLength={8} autoComplete="new-password" />
        </div>
        <div>
          <Rotulo>Confirme a senha</Rotulo>
          <Campo name="confirmacao" type="password" required minLength={8} autoComplete="new-password" />
        </div>
      </div>
      <div className="text-[10px] text-gray-400 -mt-2">Mínimo de 8 caracteres.</div>

      {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}

      <Botao type="submit">Criar cadastro</Botao>
    </form>
  );
}
