import { formatarCep, formatarCnpj, formatarCpf } from "@/lib/documento";

/**
 * O recibo que a Hemoderi entrega à clínica depois do pagamento (modelo do
 * André, 30/10): número, data, quem pagou, os serviços e o total. Quem emite é
 * a empresa prestadora, desobrigada de nota fiscal — o texto da dispensa vai
 * no rodapé, como no modelo em Word.
 */

export const EMITENTE = {
  nome: "Naiara Coutinho Leal Serviços Médicos",
  endereco: "Rua Francisco Pires Ribeiro, 282 – VL Costa Melo",
  cidade: "São Paulo – SP – CEP - 03625-040",
};

export const NOTA_DE_DISPENSA =
  "*“Empresa desobrigada a emissão de documentos fiscais nos termos da legislação fiscal (Resolução CGSN nº 140/18 e Decreto municipal  nº 53.151/12)”";

export type ItemDoRecibo = {
  unidade: string;
  quantidade: number;
  descricao: string;
  unitarioCentavos: number;
  totalCentavos: number;
};

export type ReciboDados = {
  /** "0681 – 2026" */
  numero: string;
  emissao: Date;
  pagador: {
    nome: string;
    endereco: string;
    municipio: string;
    uf: string;
    cep: string;
    documento: string;
  };
  condicao: string;
  cirurgiao: string | null;
  itens: ItemDoRecibo[];
  totalCentavos: number;
};

/** "0681 – 2026": o número do atendimento com quatro dígitos, e o ano. */
export function numeroDoRecibo(numero: number, ano: number, prefixo = ""): string {
  return `${prefixo}${String(numero).padStart(4, "0")} – ${ano}`;
}

/** CPF (11 dígitos) ou CNPJ, formatado; vazio quando não há documento. */
export function formatarDocumento(valor: string | null | undefined): string {
  const digitos = (valor ?? "").replace(/\D/g, "");
  if (!digitos) return "";
  return digitos.length <= 11 ? formatarCpf(digitos) : formatarCnpj(digitos);
}

type ClinicaDoRecibo = {
  nome: string;
  cnpj: string | null;
  financeiroNome: string | null;
  financeiroDocumento: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
};

/**
 * Quem consta como pagador: o responsável financeiro, quando a clínica indicou
 * um, senão a própria clínica — a mesma regra da cobrança.
 */
export function pagadorDoRecibo(clinica: ClinicaDoRecibo): ReciboDados["pagador"] {
  const rua = [clinica.endereco, clinica.numero].filter(Boolean).join(", ");
  return {
    nome: clinica.financeiroNome || clinica.nome,
    endereco: [rua, clinica.complemento, clinica.bairro].filter(Boolean).join(", "),
    municipio: clinica.cidade ?? "",
    uf: clinica.uf ?? "",
    cep: clinica.cep ? formatarCep(clinica.cep) : "",
    documento: formatarDocumento(clinica.financeiroNome ? clinica.financeiroDocumento : clinica.cnpj),
  };
}

export function totalDosItens(itens: ItemDoRecibo[]): number {
  return itens.reduce((soma, i) => soma + i.totalCentavos, 0);
}

/**
 * O que vai na discriminação (André, 30/10): "locação" e o nome do
 * equipamento, só isso — como no modelo ("Locação de equipamento - Centrífuga
 * para PRF"). Serviço sem equipamento (palestra, cobertura fotográfica) sai
 * com o próprio nome.
 */
export function discriminacaoDoServico(servico: { nome: string; tipoEquipamento: string | null }): string {
  return servico.tipoEquipamento ? `Locação de equipamento - ${servico.tipoEquipamento}` : servico.nome;
}
