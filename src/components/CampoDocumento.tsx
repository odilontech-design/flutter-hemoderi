"use client";

import { useState } from "react";
import { Campo, Rotulo } from "@/components/ui";
import { apenasDigitos, cnpjValido, cpfValido, formatarCnpj, formatarCpf } from "@/lib/documento";

const ROTULO_SITUACAO: Record<string, string> = {
  ATIVA: "ativa",
  BAIXADA: "baixada",
  INAPTA: "inapta",
  SUSPENSA: "suspensa",
  NULA: "nula",
};

/**
 * CPF ou CNPJ com máscara, conferência do dígito verificador e, só para
 * CNPJ, a confirmação na Receita.
 *
 * Avisa ao sair do campo, não a cada tecla: reclamar de documento incompleto
 * enquanto a pessoa ainda digita é ruído, e ruído treina todo mundo a ignorar
 * o aviso que importa.
 *
 * O aviso não bloqueia o envio — a validação que vale é a da server action.
 * Aqui ele existe para pegar o dígito trocado no ato, que é quando custa
 * segundos em vez de uma nota fiscal recusada.
 *
 * CNPJ tem consulta pública oficial (BrasilAPI, espelho dos dados abertos da
 * Receita) e CPF não tem — é dado pessoal, e a Receita não expõe CPF de
 * terceiro sem autorização do titular. Por isso só o CNPJ ganha a segunda
 * conferência aqui; para CPF, o dígito verificador continua sendo o único
 * cheque que existe sem contratar um serviço pago de terceiro.
 */
export function CampoDocumento({
  tipo,
  name,
  rotulo,
  obrigatorio = false,
  inicial = "",
}: {
  tipo: "cpf" | "cnpj";
  name: string;
  rotulo: string;
  obrigatorio?: boolean;
  inicial?: string;
}) {
  const formatar = tipo === "cpf" ? formatarCpf : formatarCnpj;
  const conferir = tipo === "cpf" ? cpfValido : cnpjValido;

  const [valor, setValor] = useState(formatar(inicial));
  const [invalido, setInvalido] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [situacao, setSituacao] = useState<{ razaoSocial: string; status: string } | null>(null);
  const [erroConsulta, setErroConsulta] = useState("");

  async function consultarCnpj(digitos: string) {
    setSituacao(null);
    setErroConsulta("");
    setConsultando(true);
    try {
      // Consulta pelo NAVEGADOR de quem cadastra, não pelo servidor — mesmo
      // motivo do CEP em CamposEndereco.tsx: uma API externa fora do ar não
      // pode travar uma função serverless nem impedir o cadastro.
      const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
      if (!resposta.ok) {
        setErroConsulta(
          resposta.status === 404 ? "CNPJ não encontrado na Receita." : "Não deu para confirmar agora."
        );
        return;
      }
      const dados = await resposta.json();
      setSituacao({
        razaoSocial: dados.razao_social ?? "",
        status: String(dados.descricao_situacao_cadastral ?? "").toUpperCase(),
      });
    } catch {
      // Sem rede ou serviço fora: o cadastro segue com o dígito verificador
      // já conferido — a consulta é reforço, não pré-requisito.
      setErroConsulta("Não deu para confirmar na Receita agora. O dígito verificador já foi conferido.");
    } finally {
      setConsultando(false);
    }
  }

  return (
    <div>
      <Rotulo>{rotulo}</Rotulo>
      <Campo
        name={name}
        inputMode="numeric"
        required={obrigatorio}
        value={valor}
        maxLength={tipo === "cpf" ? 14 : 18}
        placeholder={tipo === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
        onChange={(e) => {
          setValor(formatar(e.target.value));
          if (invalido) setInvalido(false);
          if (situacao || erroConsulta) {
            setSituacao(null);
            setErroConsulta("");
          }
        }}
        onBlur={(e) => {
          const ok = e.target.value.length > 0 && conferir(e.target.value);
          setInvalido(e.target.value.length > 0 && !ok);
          if (tipo === "cnpj" && ok) void consultarCnpj(apenasDigitos(e.target.value));
        }}
      />
      {invalido && (
        <div className="text-[11px] text-red-600 mt-1">
          Esse {tipo.toUpperCase()} não confere. Verifique se algum dígito ficou trocado.
        </div>
      )}
      {consultando && <div className="text-[10px] text-gray-400 mt-1">Confirmando na Receita…</div>}
      {situacao && (
        <div
          className={`text-[11px] mt-1 ${situacao.status === "ATIVA" ? "text-gray-500" : "text-amber-700 font-semibold"}`}
        >
          {situacao.razaoSocial}
          {situacao.status && ` · ${ROTULO_SITUACAO[situacao.status] ?? situacao.status.toLowerCase()}`}
          {situacao.status && situacao.status !== "ATIVA" && " — confira antes de continuar"}
        </div>
      )}
      {erroConsulta && <div className="text-[10px] text-gray-400 mt-1">{erroConsulta}</div>}
    </div>
  );
}
