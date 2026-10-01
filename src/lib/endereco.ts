import { prisma } from "@/lib/prisma";

type Partes = {
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
};

/** "Rua das Flores, 120 – sala 3 – Centro, São Paulo/SP" — só o que existe. */
export function resumoDoEndereco(e: Partes): string {
  const rua = [e.endereco, e.numero].filter(Boolean).join(", ");
  const local = [e.cidade, e.uf].filter(Boolean).join("/");
  return [rua, e.complemento, [e.bairro, local].filter(Boolean).join(", ")]
    .filter((parte) => parte && parte.length > 0)
    .join(" – ");
}

export const SELECAO_ENDERECO = {
  endereco: true,
  numero: true,
  complemento: true,
  bairro: true,
  cidade: true,
  uf: true,
} as const;

/**
 * Onde o atendimento acontece de fato: o endereço escolhido no pedido, ou o
 * principal da clínica quando o pedido não aponta para outro. Devolve a própria
 * clínica com as colunas de endereço trocadas — quem já lê `clinica.endereco`
 * continua lendo, agora o certo.
 */
export function comEnderecoDoPedido<C extends Partes, E extends Partes | null | undefined>(
  clinica: C,
  endereco: E
): C {
  if (!endereco) return clinica;
  return {
    ...clinica,
    endereco: endereco.endereco ?? null,
    numero: endereco.numero ?? null,
    complemento: endereco.complemento ?? null,
    bairro: endereco.bairro ?? null,
    cidade: endereco.cidade ?? null,
    uf: endereco.uf ?? null,
  } as C;
}

/** Um local onde a clínica atende. `id` vazio é o endereço principal do cadastro. */
export type LocalDeAtendimento = {
  id: string;
  rotulo: string;
  resumo: string;
  uf: string | null;
};

/**
 * Os endereços de atendimento da clínica: o principal (colunas do cadastro) e
 * os adicionais, como num aplicativo de entrega. O principal vem sempre
 * primeiro — é o padrão quando a pessoa não escolhe.
 */
export async function locaisDaClinica(clinicaId: string): Promise<LocalDeAtendimento[]> {
  const clinica = await prisma.clinica.findUnique({
    where: { id: clinicaId },
    select: {
      endereco: true,
      numero: true,
      complemento: true,
      bairro: true,
      cidade: true,
      uf: true,
      enderecos: { where: { ativo: true }, orderBy: { criadoEm: "asc" } },
    },
  });
  if (!clinica) return [];

  const locais: LocalDeAtendimento[] = [];
  if (clinica.endereco || clinica.uf) {
    locais.push({
      id: "",
      rotulo: "Endereço principal",
      resumo: resumoDoEndereco(clinica),
      uf: clinica.uf,
    });
  }
  for (const extra of clinica.enderecos) {
    locais.push({ id: extra.id, rotulo: extra.rotulo, resumo: resumoDoEndereco(extra), uf: extra.uf });
  }
  return locais;
}
