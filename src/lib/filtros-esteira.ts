import type { Prisma } from "@prisma/client";
import { somarDias } from "@/lib/data";

/**
 * Os filtros da esteira (André, 30/10: "mais opções de busca com filtros
 * inteligentes"). Todos vão na URL — dá para mandar o link de uma busca para
 * alguém da equipe — e valem também para os números das abas.
 */
export type FiltrosEsteira = {
  /** Texto livre: código, clínica, doutor, paciente, profissional, serviço ou contato. */
  q: string;
  /** "hoje" | "amanha" | "semana" | "passados" | "" — atalhos de período. */
  periodo: string;
  de: string;
  ate: string;
  /** Id do profissional, "sem" (sem profissional) ou "". */
  prof: string;
  /** Família do serviço (o equipamento). */
  familia: string;
  pagamento: string;
};

export const PERIODOS_ESTEIRA = [
  { valor: "", rotulo: "Qualquer data" },
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "amanha", rotulo: "Amanhã" },
  { valor: "semana", rotulo: "Próximos 7 dias" },
  { valor: "passados", rotulo: "Já passaram" },
  { valor: "intervalo", rotulo: "Escolher datas…" },
];

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function lerFiltrosEsteira(p: Record<string, string | undefined>): FiltrosEsteira {
  const texto = (v: string | undefined) => (v ?? "").trim().slice(0, 80);
  return {
    q: texto(p.q),
    periodo: PERIODOS_ESTEIRA.some((x) => x.valor === p.periodo) ? (p.periodo as string) : "",
    de: DATA_ISO.test(p.de ?? "") ? (p.de as string) : "",
    ate: DATA_ISO.test(p.ate ?? "") ? (p.ate as string) : "",
    prof: texto(p.prof),
    familia: texto(p.familia),
    pagamento: texto(p.pagamento),
  };
}

export function temFiltro(f: FiltrosEsteira): boolean {
  return Boolean(f.q || f.periodo || f.de || f.ate || f.prof || f.familia || f.pagamento);
}

/**
 * "2026-0051", "0051", "51" ou "2026-0051-DRERICMOTA": o número do
 * atendimento, quando a busca é um código. Null quando é texto.
 */
export function numeroDaBusca(q: string): number | null {
  const codigo = /^(?:\d{4}-)?0*(\d{1,6})(?:-[a-z0-9]*)?$/i.exec(q.trim());
  return codigo ? Number(codigo[1]) : null;
}

/** A cláusula do banco para os filtros, somada à da etapa. `hoje` é a data UTC do dia. */
export function ondeDosFiltros(f: FiltrosEsteira, hoje: Date): Prisma.PedidoWhereInput {
  const e: Prisma.PedidoWhereInput[] = [];

  if (f.q) {
    const contem = { contains: f.q, mode: "insensitive" as const };
    const numero = numeroDaBusca(f.q);
    e.push({
      OR: [
        ...(numero !== null ? [{ numero }] : []),
        { clinica: { nome: contem } },
        { doutorNome: contem },
        { pacienteNome: contem },
        { contatoClinica: contem },
        { procedimentoPaciente: contem },
        { profissional: { nome: contem } },
        { servico: { nome: contem } },
        { endereco: { rotulo: contem } },
      ],
    });
  }

  if (f.periodo === "hoje") e.push({ data: hoje });
  else if (f.periodo === "amanha") e.push({ data: somarDias(hoje, 1) });
  else if (f.periodo === "semana") e.push({ data: { gte: hoje, lte: somarDias(hoje, 6) } });
  else if (f.periodo === "passados") e.push({ data: { lt: hoje } });
  else if (f.de || f.ate) {
    e.push({
      data: {
        ...(f.de ? { gte: new Date(`${f.de}T00:00:00Z`) } : {}),
        ...(f.ate ? { lte: new Date(`${f.ate}T00:00:00Z`) } : {}),
      },
    });
  }

  if (f.prof === "sem") e.push({ profissionalId: null });
  else if (f.prof) e.push({ profissionalId: f.prof });

  if (f.familia) e.push({ servico: { familia: f.familia } });
  if (f.pagamento) e.push({ condicaoPagamento: f.pagamento });

  return e.length ? { AND: e } : {};
}

/** A query string dos filtros, para os links das abas não os perderem. */
export function consultaDosFiltros(f: FiltrosEsteira, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams(extra);
  for (const [chave, valor] of Object.entries(f)) if (valor) p.set(chave, valor);
  return p.toString();
}
