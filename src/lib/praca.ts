/**
 * A praça do atendimento, para o repasse (ata de 20/10): as mesmas seis da
 * planilha que o pós-venda preenche. Sai do endereço do atendimento — UF e,
 * em São Paulo, a cidade, porque a Grande São Paulo e o interior pagam
 * diferente.
 */
export const PRACAS = [
  { chave: "GRANDE_SP", rotulo: "Grande São Paulo" },
  { chave: "INTERIOR_SP", rotulo: "Interior SP (até 150 km)" },
  { chave: "RJ", rotulo: "Rio de Janeiro" },
  { chave: "PR", rotulo: "Paraná" },
  { chave: "ES", rotulo: "Espírito Santo" },
  { chave: "OUTROS", rotulo: "Demais estados" },
] as const;

export type ChavePraca = (typeof PRACAS)[number]["chave"];

export function rotuloDaPraca(chave: string): string {
  return PRACAS.find((p) => p.chave === chave)?.rotulo ?? chave;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Os 39 municípios da Região Metropolitana de São Paulo (IBGE). */
const GRANDE_SAO_PAULO = new Set(
  [
    "Arujá", "Barueri", "Biritiba-Mirim", "Caieiras", "Cajamar", "Carapicuíba", "Cotia", "Diadema",
    "Embu das Artes", "Embu-Guaçu", "Ferraz de Vasconcelos", "Francisco Morato", "Franco da Rocha",
    "Guararema", "Guarulhos", "Itapecerica da Serra", "Itapevi", "Itaquaquecetuba", "Jandira", "Juquitiba",
    "Mairiporã", "Mauá", "Mogi das Cruzes", "Osasco", "Pirapora do Bom Jesus", "Poá", "Ribeirão Pires",
    "Rio Grande da Serra", "Salesópolis", "Santa Isabel", "Santana de Parnaíba", "Santo André",
    "São Bernardo do Campo", "São Caetano do Sul", "São Lourenço da Serra", "São Paulo", "Suzano",
    "Taboão da Serra", "Vargem Grande Paulista",
    // grafias antigas que ainda aparecem nos cadastros
    "Embu",
  ].map(normalizar)
);

export function pracaDoAtendimento(local: { uf?: string | null; cidade?: string | null }): ChavePraca {
  const uf = (local.uf ?? "").trim().toUpperCase();
  if (uf === "SP") return GRANDE_SAO_PAULO.has(normalizar(local.cidade ?? "")) ? "GRANDE_SP" : "INTERIOR_SP";
  if (uf === "RJ" || uf === "PR" || uf === "ES") return uf;
  return "OUTROS";
}
