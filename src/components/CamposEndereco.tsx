"use client";

import { useState } from "react";
import { Campo, Rotulo } from "@/components/ui";
import { cepValido, formatarCep } from "@/lib/documento";

type Endereco = {
  cep?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
};

/**
 * Endereço preenchido pelo CEP.
 *
 * Só número e complemento ficam livres. O resto vem da consulta e fica
 * bloqueado de propósito: endereço digitado à mão é o que faz o profissional
 * rodar quarteirão procurando uma clínica cadastrada com o nome da rua
 * errado — e o erro só aparece no dia do atendimento.
 *
 * A consulta é feita pelo NAVEGADOR de quem cadastra, não pelo servidor:
 * assim uma indisponibilidade do serviço de CEP não derruba o cadastro nem
 * prende uma função serverless esperando resposta.
 */
export function CamposEndereco({ inicial }: { inicial?: Endereco }) {
  const [cep, setCep] = useState(formatarCep(inicial?.cep ?? ""));
  const [logradouro, setLogradouro] = useState(inicial?.endereco ?? "");
  const [bairro, setBairro] = useState(inicial?.bairro ?? "");
  const [cidade, setCidade] = useState(inicial?.cidade ?? "");
  const [uf, setUf] = useState(inicial?.uf ?? "");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  // Endereço já carregado (ou vindo do cadastro) libera número e complemento.
  const [encontrado, setEncontrado] = useState(Boolean(inicial?.endereco));
  // Sem resposta do serviço de CEP: os campos deixam de vir bloqueados da
  // consulta e passam a aceitar digitação — travá-los vazios e travados
  // prenderia o cadastro por causa de um serviço de terceiro fora do ar.
  const [manual, setManual] = useState(false);

  async function buscar(valor: string) {
    const limpo = valor.replace(/\D/g, "");
    if (!cepValido(limpo)) return;

    setBuscando(true);
    setErro("");
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const dados = await resposta.json();
      if (dados.erro) {
        setErro("CEP não encontrado. Confira o número.");
        setEncontrado(false);
        setManual(false);
        return;
      }
      setLogradouro(dados.logradouro ?? "");
      setBairro(dados.bairro ?? "");
      setCidade(dados.localidade ?? "");
      setUf(dados.uf ?? "");
      setEncontrado(true);
      setManual(false);
    } catch {
      // Sem rede ou serviço fora: liberar a digitação é melhor que travar o
      // cadastro inteiro por causa de um serviço de terceiro.
      setErro("Não deu para consultar o CEP agora. Preencha o endereço à mão.");
      setEncontrado(true);
      setManual(true);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <Rotulo>CEP</Rotulo>
          <Campo
            name="cep"
            inputMode="numeric"
            required
            value={cep}
            maxLength={9}
            placeholder="01310-100"
            onChange={(e) => setCep(formatarCep(e.target.value))}
            onBlur={(e) => buscar(e.target.value)}
          />
          <div className="text-[10px] text-gray-400 mt-1">
            {buscando ? "Buscando…" : "O endereço vem do CEP."}
          </div>
        </div>
        <div className="sm:col-span-2">
          <Rotulo>Logradouro</Rotulo>
          <Campo
            name="endereco"
            value={logradouro}
            readOnly={!manual}
            required
            onChange={(e) => manual && setLogradouro(e.target.value)}
          />
        </div>
      </div>

      {erro && <div className="text-[11px] text-amber-700">{erro}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <Rotulo>Número</Rotulo>
          <Campo name="numero" required disabled={!encontrado} defaultValue="" />
        </div>
        <div>
          <Rotulo>Complemento</Rotulo>
          <Campo name="complemento" disabled={!encontrado} />
        </div>
        <div>
          <Rotulo>Bairro</Rotulo>
          <Campo
            name="bairro"
            value={bairro}
            readOnly={!manual}
            onChange={(e) => manual && setBairro(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Rotulo>Cidade</Rotulo>
            <Campo
              name="cidade"
              value={cidade}
              readOnly={!manual}
              onChange={(e) => manual && setCidade(e.target.value)}
            />
          </div>
          <div>
            <Rotulo>UF</Rotulo>
            <Campo
              name="uf"
              value={uf}
              readOnly={!manual}
              maxLength={2}
              onChange={(e) => manual && setUf(e.target.value.toUpperCase())}
            />
          </div>
        </div>
      </div>
    </>
  );
}
