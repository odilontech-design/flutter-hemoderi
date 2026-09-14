"use client";

import { useState } from "react";
import { Campo, Rotulo } from "@/components/ui";
import { cnpjValido, cpfValido, formatarCnpj, formatarCpf } from "@/lib/documento";

/**
 * CPF ou CNPJ com máscara e conferência do dígito verificador.
 *
 * Avisa ao sair do campo, não a cada tecla: reclamar de documento incompleto
 * enquanto a pessoa ainda digita é ruído, e ruído treina todo mundo a ignorar
 * o aviso que importa.
 *
 * O aviso não bloqueia o envio — a validação que vale é a da server action.
 * Aqui ele existe para pegar o dígito trocado no ato, que é quando custa
 * segundos em vez de uma nota fiscal recusada.
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
        }}
        onBlur={(e) => setInvalido(e.target.value.length > 0 && !conferir(e.target.value))}
      />
      {invalido && (
        <div className="text-[11px] text-red-600 mt-1">
          Esse {tipo.toUpperCase()} não confere. Verifique se algum dígito ficou trocado.
        </div>
      )}
    </div>
  );
}
