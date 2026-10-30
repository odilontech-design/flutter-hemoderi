"use client";

import { useEffect, useId, useRef, useState } from "react";
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
export function CamposEndereco({
  inicial,
  /** Avisa quando o endereço deixou de estar em branco — usado pelo
   *  agendamento público para só então pedir a identificação. */
  aoPreencher,
}: {
  inicial?: Endereco;
  aoPreencher?: (preenchido: boolean) => void;
}) {
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

  useEffect(() => {
    aoPreencher?.(encontrado);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só a mudança de `encontrado` interessa, não a identidade da função.
  }, [encontrado]);

  // O CEP que gerou o endereço na tela: digitar outro apaga o anterior e busca
  // de novo sozinho ao completar 8 dígitos (André, 30/10: "quando a pessoa
  // digita um CEP errado ela não consegue trocar").
  const consultado = useRef(String(inicial?.cep ?? "").replace(/\D/g, ""));
  const idDoCep = useId();

  function trocarCep(valor: string) {
    const formatado = formatarCep(valor);
    setCep(formatado);
    const limpo = formatado.replace(/\D/g, "");
    if (limpo === consultado.current) return;
    // Endereço de outro CEP não pode continuar na tela.
    if (consultado.current) {
      consultado.current = "";
      setLogradouro("");
      setBairro("");
      setCidade("");
      setUf("");
      setEncontrado(false);
      setManual(false);
    }
    setErro("");
    if (limpo.length === 8) void buscar(limpo);
  }

  function limparCep() {
    trocarCep("");
    document.getElementById(idDoCep)?.focus();
  }

  function preencherAMao() {
    setManual(true);
    setEncontrado(true);
    setErro("");
  }

  async function buscar(valor: string) {
    const limpo = valor.replace(/\D/g, "");
    if (!cepValido(limpo)) return;
    if (limpo === consultado.current && encontrado) return;
    consultado.current = limpo;

    setBuscando(true);
    setErro("");
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const dados = await resposta.json();
      if (dados.erro) {
        setErro("CEP não encontrado. Corrija o número ou preencha o endereço à mão.");
        setEncontrado(false);
        setManual(false);
        return;
      }
      setLogradouro(dados.logradouro ?? "");
      setBairro(dados.bairro ?? "");
      setCidade(dados.localidade ?? "");
      setUf(dados.uf ?? "");
      setEncontrado(true);
      // CEP geral da cidade (sem rua): a rua e o bairro ficam para digitar.
      setManual(!dados.logradouro);
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

  // "Não sei o CEP" (André, 29/10: o profissional teve que sair do app para
  // procurar no Google). Busca pela rua, cidade e UF no ViaCEP e deixa a pessoa
  // escolher — rua repetida em vários CEPs (Avenida Brasil) vira uma lista, não um chute.
  const [procurando, setProcurando] = useState(false);
  const [buscaUf, setBuscaUf] = useState(uf || "SP");
  const [buscaCidade, setBuscaCidade] = useState(cidade);
  const [buscaRua, setBuscaRua] = useState("");
  const [opcoes, setOpcoes] = useState<{ cep: string; logradouro: string; bairro: string; complemento: string }[] | null>(null);
  const [buscandoRua, setBuscandoRua] = useState(false);

  async function procurarPelaRua() {
    if (buscaRua.trim().length < 3 || buscaCidade.trim().length < 3 || buscaUf.trim().length !== 2) {
      setErro("Informe o estado (2 letras), a cidade e pelo menos 3 letras da rua.");
      return;
    }
    setBuscandoRua(true);
    setErro("");
    try {
      const url = `https://viacep.com.br/ws/${encodeURIComponent(buscaUf.trim())}/${encodeURIComponent(buscaCidade.trim())}/${encodeURIComponent(buscaRua.trim())}/json/`;
      const lista = (await (await fetch(url)).json()) as { cep: string; logradouro: string; bairro: string; complemento: string }[];
      setOpcoes(Array.isArray(lista) ? lista.slice(0, 30) : []);
    } catch {
      setErro("Não deu para buscar agora. Tente de novo ou preencha o CEP.");
    } finally {
      setBuscandoRua(false);
    }
  }

  function escolherOpcao(o: { cep: string }) {
    setCep(formatarCep(o.cep));
    setProcurando(false);
    setOpcoes(null);
    void buscar(o.cep);
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <Rotulo>CEP</Rotulo>
          <div className="relative">
            <Campo
              id={idDoCep}
              name="cep"
              inputMode="numeric"
              required
              value={cep}
              maxLength={9}
              placeholder="01310-100"
              onChange={(e) => trocarCep(e.target.value)}
              onBlur={(e) => buscar(e.target.value)}
              className="pr-10"
            />
            {cep && (
              <button
                type="button"
                onClick={limparCep}
                aria-label="Apagar o CEP e digitar outro"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full text-gray-400 hover:text-bordo hover:bg-gray-50 text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            {buscando ? "Buscando…" : "O endereço vem do CEP."}{" "}
            <button type="button" onClick={() => setProcurando((a) => !a)} className="font-semibold text-bordo hover:underline">
              Não sei o CEP
            </button>
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

      {procurando && (
        <div className="rounded-xl border border-bordo/30 bg-bege/40 p-3 space-y-2">
          <div className="text-[11px] font-semibold text-bordo">Achar o CEP pelo endereço</div>
          <div className="grid grid-cols-4 gap-2">
            <input value={buscaUf} onChange={(e) => setBuscaUf(e.target.value.toUpperCase().slice(0, 2))} aria-label="Estado" placeholder="UF" className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
            <input value={buscaCidade} onChange={(e) => setBuscaCidade(e.target.value)} aria-label="Cidade" placeholder="Cidade" className="col-span-3 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
          </div>
          <div className="flex gap-2">
            <input value={buscaRua} onChange={(e) => setBuscaRua(e.target.value)} aria-label="Rua" placeholder="Rua ou avenida" className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
            <button type="button" onClick={procurarPelaRua} disabled={buscandoRua} className="rounded-lg bg-bordo px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
              {buscandoRua ? "Buscando…" : "Buscar"}
            </button>
          </div>
          {opcoes && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
              {opcoes.length === 0 && <div className="p-2 text-[11px] text-gray-500">Nada encontrado. Confira a grafia da rua e da cidade.</div>}
              {opcoes.map((o) => (
                <button type="button" key={o.cep} onClick={() => escolherOpcao(o)} className="block w-full px-2 py-1.5 text-left text-[11px] hover:bg-bege/60">
                  <span className="font-semibold text-gray-800">{o.logradouro}</span>
                  <span className="text-gray-500"> · {o.bairro || "—"}{o.complemento ? ` · ${o.complemento}` : ""} · {o.cep}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {erro && (
        <div className="text-[11px] text-amber-700">
          {erro}{" "}
          {!manual && (
            <button type="button" onClick={preencherAMao} className="font-semibold text-bordo hover:underline">
              Preencher à mão
            </button>
          )}
        </div>
      )}

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
