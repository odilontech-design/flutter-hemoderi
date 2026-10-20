import { cnpjValido, cpfValido, formatarCnpj, formatarCpf } from "@/lib/documento";
import { formatarTelefoneBrasileiro, lerTelefoneBrasileiro, MENSAGEM_TELEFONE_INVALIDO } from "@/lib/telefone";

/**
 * Responsável financeiro da clínica (ata de 20/10): quem recebe a cobrança
 * quando não é a própria clínica. "A própria clínica" deixa os campos vazios
 * (vale o CNPJ e o telefone do cadastro); "outra pessoa ou empresa" exige
 * nome, CPF ou CNPJ e telefone — sem eles a cobrança não tem para quem ir.
 */
export type ResponsavelFinanceiro = {
  financeiroNome: string | null;
  financeiroDocumento: string | null;
  financeiroTelefone: string | null;
  financeiroEmail: string | null;
};

export const SEM_RESPONSAVEL_FINANCEIRO: ResponsavelFinanceiro = {
  financeiroNome: null,
  financeiroDocumento: null,
  financeiroTelefone: null,
  financeiroEmail: null,
};

export function lerResponsavelFinanceiro(
  campo: (nome: string) => string
): { ok: true; dados: ResponsavelFinanceiro } | { ok: false; erro: string } {
  if (campo("financeiroOutro") !== "sim") return { ok: true, dados: SEM_RESPONSAVEL_FINANCEIRO };

  const nome = campo("financeiroNome").trim();
  if (nome.length < 3) return { ok: false, erro: "Responsável financeiro: informe o nome da pessoa ou da empresa." };

  const digitos = campo("financeiroDocumento").replace(/\D/g, "");
  const documento =
    digitos.length === 11 && cpfValido(digitos)
      ? formatarCpf(digitos)
      : digitos.length === 14 && cnpjValido(digitos)
        ? formatarCnpj(digitos)
        : null;
  if (!documento) return { ok: false, erro: "Responsável financeiro: CPF ou CNPJ inválido — confira os dígitos." };

  const telefone = lerTelefoneBrasileiro(campo("financeiroTelefone"));
  if (!telefone) return { ok: false, erro: `Responsável financeiro: ${MENSAGEM_TELEFONE_INVALIDO}` };

  const email = campo("financeiroEmail").trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, erro: "Responsável financeiro: e-mail inválido." };
  }

  return {
    ok: true,
    dados: {
      financeiroNome: nome,
      financeiroDocumento: documento,
      financeiroTelefone: formatarTelefoneBrasileiro(telefone),
      financeiroEmail: email || null,
    },
  };
}

/** Lê do FormData do jeito que `lerResponsavelFinanceiro` espera. */
export function camposDoFormulario(dados: FormData) {
  return (nome: string) => String(dados.get(nome) ?? "");
}
