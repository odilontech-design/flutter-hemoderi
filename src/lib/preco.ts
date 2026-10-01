import type { PrismaClient } from "@prisma/client";

/**
 * De onde sai o preço que a clínica paga.
 *
 * Quatro camadas, nesta ordem, e a primeira que existe decide:
 *
 *   1. NEGOCIADO — PrecoClinica, o par clínica × serviço. É o acordo fechado
 *      com aquele cliente e vence qualquer padronização; foi negociado
 *      justamente para ser exceção.
 *   2. PERFIL — PrecoTabela, as tabelas liberadas para a clínica (ata de
 *      01/10): "Mandic" cobra diferente de "Cursos" e de consultório
 *      particular. Com mais de uma tabela liberada que precifique o mesmo
 *      serviço, vale a de menor valor — a liberação é da equipe, e a
 *      clínica não deve pagar mais por ter sido liberada para duas.
 *   3. PRAÇA — PrecoRegiao, pela UF do endereço do atendimento (ata de
 *      28/09). O mesmo procedimento não custa o mesmo em toda parte.
 *   4. TABELA — Servico.valorPadraoCentavos, o preço público de referência.
 *
 * A ordem importa mais do que parece: inverter 1 e 3 faria uma mudança de
 * tabela regional atropelar silenciosamente um contrato assinado.
 */

/** O preço e de qual camada ele veio — a origem é o que a tela precisa dizer. */
export type PrecoResolvido = {
  valorCentavos: number;
  origem: "negociado" | "perfil" | "regiao" | "tabela";
  /** Nome da praça, quando foi ela que decidiu. */
  regiao?: string;
};

type Cliente = Pick<PrismaClient, "precoClinica" | "precoRegiao" | "regiaoPreco" | "precoTabela">;

/** Menor valor entre as tabelas liberadas que precificam o serviço. */
function menorDasTabelas(valores: number[]): number | undefined {
  return valores.length ? Math.min(...valores) : undefined;
}

/**
 * A praça de uma UF, ou nula quando o estado não está em praça nenhuma.
 *
 * Uma UF mora em uma praça só (ver o comentário do modelo): `findFirst` aqui
 * não é escolha arbitrária entre várias, é o único resultado possível quando
 * o cadastro fez o seu trabalho.
 */
export async function regiaoDaUf(
  prisma: Cliente,
  uf: string | null | undefined
): Promise<{ id: string; nome: string } | null> {
  const sigla = (uf ?? "").trim().toUpperCase();
  if (!sigla) return null;
  return prisma.regiaoPreco.findFirst({
    where: { ativa: true, ufs: { has: sigla } },
    select: { id: true, nome: true },
  });
}

/**
 * O preço de um serviço para uma clínica, com a origem junto.
 *
 * `uf` vem de fora porque quem chama já tem a clínica em mãos na maioria dos
 * casos — e porque o catálogo precisa precificar antes de a clínica existir,
 * quando tudo que se sabe é o estado informado no endereço.
 */
export async function precoDoServico(
  prisma: Cliente,
  {
    clinicaId,
    servicoId,
    uf,
    valorPadraoCentavos,
    tabelaIds = [],
  }: {
    clinicaId?: string | null;
    servicoId: string;
    uf?: string | null;
    valorPadraoCentavos: number;
    /** Tabelas de preço liberadas para a clínica (ver `tabelasDaClinica`). */
    tabelaIds?: string[];
  }
): Promise<PrecoResolvido> {
  if (clinicaId) {
    const negociado = await prisma.precoClinica.findUnique({
      where: { clinicaId_servicoId: { clinicaId, servicoId } },
      select: { valorCentavos: true },
    });
    if (negociado) return { valorCentavos: negociado.valorCentavos, origem: "negociado" };
  }

  if (tabelaIds.length > 0) {
    const doPerfil = await prisma.precoTabela.findMany({
      where: { tabelaId: { in: tabelaIds }, servicoId },
      select: { valorCentavos: true },
    });
    const menor = menorDasTabelas(doPerfil.map((p) => p.valorCentavos));
    if (menor !== undefined) return { valorCentavos: menor, origem: "perfil" };
  }

  const regiao = await regiaoDaUf(prisma, uf);
  if (regiao) {
    const daRegiao = await prisma.precoRegiao.findUnique({
      where: { regiaoId_servicoId: { regiaoId: regiao.id, servicoId } },
      select: { valorCentavos: true },
    });
    if (daRegiao) {
      return { valorCentavos: daRegiao.valorCentavos, origem: "regiao", regiao: regiao.nome };
    }
  }

  return { valorCentavos: valorPadraoCentavos, origem: "tabela" };
}

/**
 * O mesmo que acima, para uma lista de serviços de uma vez.
 *
 * Existe porque o catálogo mostra trinta e quatro serviços numa tela só:
 * resolver um a um seriam setenta idas ao banco por visita, e é o tipo de
 * consulta que só dói quando o catálogo cresce — ou seja, tarde demais.
 */
export async function precosDosServicos(
  prisma: Cliente,
  {
    clinicaId,
    uf,
    servicos,
    tabelaIds = [],
  }: {
    clinicaId?: string | null;
    uf?: string | null;
    servicos: { id: string; valorPadraoCentavos: number }[];
    tabelaIds?: string[];
  }
): Promise<Map<string, PrecoResolvido>> {
  const ids = servicos.map((s) => s.id);

  const negociados = clinicaId
    ? await prisma.precoClinica.findMany({
        where: { clinicaId, servicoId: { in: ids } },
        select: { servicoId: true, valorCentavos: true },
      })
    : [];
  const porNegociado = new Map(negociados.map((p) => [p.servicoId, p.valorCentavos]));

  const doPerfil =
    tabelaIds.length > 0
      ? await prisma.precoTabela.findMany({
          where: { tabelaId: { in: tabelaIds }, servicoId: { in: ids } },
          select: { servicoId: true, valorCentavos: true },
        })
      : [];
  const porPerfil = new Map<string, number>();
  for (const p of doPerfil) {
    const atual = porPerfil.get(p.servicoId);
    porPerfil.set(p.servicoId, atual === undefined ? p.valorCentavos : Math.min(atual, p.valorCentavos));
  }

  const regiao = await regiaoDaUf(prisma, uf);
  const daRegiao = regiao
    ? await prisma.precoRegiao.findMany({
        where: { regiaoId: regiao.id, servicoId: { in: ids } },
        select: { servicoId: true, valorCentavos: true },
      })
    : [];
  const porRegiao = new Map(daRegiao.map((p) => [p.servicoId, p.valorCentavos]));

  return new Map(
    servicos.map((servico): [string, PrecoResolvido] => {
      const negociado = porNegociado.get(servico.id);
      if (negociado !== undefined) {
        return [servico.id, { valorCentavos: negociado, origem: "negociado" }];
      }
      const perfil = porPerfil.get(servico.id);
      if (perfil !== undefined) {
        return [servico.id, { valorCentavos: perfil, origem: "perfil" }];
      }
      const regional = porRegiao.get(servico.id);
      if (regional !== undefined && regiao) {
        return [servico.id, { valorCentavos: regional, origem: "regiao", regiao: regiao.nome }];
      }
      return [servico.id, { valorCentavos: servico.valorPadraoCentavos, origem: "tabela" }];
    })
  );
}

/**
 * Ids das tabelas de preço ativas liberadas para a clínica. Separado de
 * `precoDoServico` para a cadeia continuar testável com um dublê só de
 * preços — quem chama busca uma vez e reaproveita para vários serviços.
 */
export async function tabelasDaClinica(
  prisma: Pick<PrismaClient, "tabelaPreco">,
  clinicaId: string
): Promise<string[]> {
  const tabelas = await prisma.tabelaPreco.findMany({
    where: { ativa: true, clinicas: { some: { id: clinicaId } } },
    select: { id: true },
  });
  return tabelas.map((t) => t.id);
}
