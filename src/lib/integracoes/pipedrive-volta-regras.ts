/**
 * Caminho de volta PipeDrive → sistema (20/11, Sthefany e Joyce): o que a
 * equipe corrige no negócio do PipeDrive passa para o agendamento. Só estes
 * campos, combinados com elas:
 *   - valor do negócio            → valor do serviço
 *   - Pagamento do Profissional    → repasse
 *   - Profissional Hemoderi        → profissional do atendimento
 *   - Nome do Paciente             → paciente
 *   - Pagamento Realizado = Sim    → baixa do pagamento no sistema
 * (O nome do negócio não tem campo próprio no sistema: o título é montado aqui.)
 *
 * Travas, para não abrir diferença no financeiro: valor do serviço com cobrança
 * já emitida ou paga e repasse/profissional com repasse já pago NÃO mudam
 * sozinhos — viram pendência para alguém conferir. Regras puras, sem rede.
 */

import { normalizar } from "./pipedrive-campos";

export type AvisoDoPipedrive = {
  negocioId: string | null;
  feitoPelaApi: boolean;
  ehNegocio: boolean;
  /**
   * Os campos que MUDARAM neste aviso (chaves como o PipeDrive as chama: "value"
   * e o hash de cada campo personalizado). Null quando o aviso não traz o valor
   * anterior — aí não dá para saber o que mudou e nada é aplicado sozinho.
   */
  camposMudados: string[] | null;
};

/** Os campos cujo valor difere entre o anterior e o atual (o v1 manda o objeto inteiro; o v2, só o que mudou). */
export function camposQueMudaram(anterior: unknown, atual: unknown): string[] | null {
  if (!anterior || typeof anterior !== "object") return null;
  const ant = anterior as Record<string, unknown>;
  const cur = (atual && typeof atual === "object" ? atual : {}) as Record<string, unknown>;
  const mudou = (a: unknown, b: unknown) => JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  const chaves: string[] = [];
  for (const k of Object.keys(ant)) {
    if (k === "custom_fields") {
      const a = (ant.custom_fields ?? {}) as Record<string, unknown>;
      const c = (cur.custom_fields ?? {}) as Record<string, unknown>;
      for (const h of Object.keys(a)) if (mudou(a[h], c[h])) chaves.push(h);
    } else if (mudou(ant[k], cur[k])) {
      chaves.push(k);
    }
  }
  return chaves;
}

/** Lê o aviso (webhook v1 ou v2): qual negócio, e se foi a própria integração que mexeu. */
export function lerAvisoDoPipedrive(corpo: unknown): AvisoDoPipedrive {
  const c = (corpo ?? {}) as { meta?: Record<string, unknown>; data?: { id?: unknown } | null; current?: { id?: unknown } | null; previous?: unknown };
  const meta = c.meta ?? {};
  const entidade = String(meta.entity ?? meta.object ?? "").toLowerCase();
  const id = meta.entity_id ?? meta.id ?? c.data?.id ?? c.current?.id ?? null;
  const origem = String(meta.change_source ?? "").toLowerCase();
  return {
    negocioId: id !== null && id !== undefined && /^\d+$/.test(String(id)) ? String(id) : null,
    feitoPelaApi: origem === "api",
    ehNegocio: entidade === "deal",
    camposMudados: camposQueMudaram(c.previous, c.data ?? c.current),
  };
}

export type NegocioLido = {
  valorCentavos: number | null;
  repasseCentavos: number | null;
  profissional: string | null;
  paciente: string | null;
  /** true = "Sim", false = "Não", null = em branco. */
  pago: boolean | null;
};

export type PedidoParaVolta = {
  valorServicoCentavos: number;
  valorRepasseCentavos: number;
  profissionalId: string | null;
  profissionalNome: string | null;
  paciente: string | null;
  /** Pago por Pix, cartão ou fatura — nada a fazer com o "Sim" do PipeDrive. */
  pagoNoSistema: boolean;
  /** Baixa que veio do PipeDrive antes (o "Não" desfaz só esta). */
  baixaPeloPipedrive: boolean;
  cobrancaEmitida: boolean;
  repassePago: boolean;
};

export type DecisaoDaVolta = {
  valorServicoCentavos?: number;
  valorRepasseCentavos?: number;
  profissionalId?: string;
  paciente?: string;
  /** true dá baixa; false desfaz a baixa feita pelo PipeDrive. */
  baixa?: boolean;
  feitas: string[];
  conflitos: string[];
};

const reais = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;

/** "Sim"/"Não" do PipeDrive, sem se importar com acento e caixa. */
export function simOuNao(rotulo: string | null | undefined): boolean | null {
  const n = normalizar(rotulo ?? "");
  if (n === "sim") return true;
  if (n === "nao") return false;
  return null;
}

export function decidirVolta(negocio: NegocioLido, pedido: PedidoParaVolta, profissionais: { id: string; nome: string }[]): DecisaoDaVolta {
  const d: DecisaoDaVolta = { feitas: [], conflitos: [] };

  if (negocio.valorCentavos !== null && negocio.valorCentavos > 0 && negocio.valorCentavos !== pedido.valorServicoCentavos) {
    if (pedido.cobrancaEmitida) {
      d.conflitos.push(`Valor do negócio mudou para ${reais(negocio.valorCentavos)} (no sistema: ${reais(pedido.valorServicoCentavos)}), mas a cobrança já foi emitida ou paga.`);
    } else {
      d.valorServicoCentavos = negocio.valorCentavos;
      d.feitas.push(`valor do serviço: de ${reais(pedido.valorServicoCentavos)} para ${reais(negocio.valorCentavos)}`);
    }
  }

  const nomeNoPipe = negocio.profissional?.trim();
  if (nomeNoPipe && normalizar(nomeNoPipe) !== normalizar(pedido.profissionalNome ?? "")) {
    const alvo = normalizar(nomeNoPipe);
    const iguais = profissionais.filter((p) => normalizar(p.nome) === alvo);
    // A lista do PipeDrive pode ter o nome mais curto ("Iara Martins" ↔ "Iara Martins Silva"): vale se for um só.
    const achados = iguais.length > 0 ? iguais : profissionais.filter((p) => {
      const n = normalizar(p.nome);
      return n.includes(alvo) || alvo.includes(n);
    });
    if (pedido.repassePago) {
      d.conflitos.push(`Profissional mudou para ${nomeNoPipe}, mas o repasse de ${pedido.profissionalNome ?? "—"} já foi pago.`);
    } else if (achados.length !== 1) {
      d.conflitos.push(`Profissional mudou para ${nomeNoPipe}, mas ${achados.length ? "há mais de um" : "não há"} profissional com esse nome no sistema.`);
    } else if (achados[0].id !== pedido.profissionalId) {
      d.profissionalId = achados[0].id;
      d.feitas.push(`profissional: de ${pedido.profissionalNome ?? "—"} para ${achados[0].nome}`);
    }
  }

  if (negocio.repasseCentavos !== null && negocio.repasseCentavos >= 0 && negocio.repasseCentavos !== pedido.valorRepasseCentavos) {
    if (pedido.repassePago) {
      d.conflitos.push(`Pagamento do profissional mudou para ${reais(negocio.repasseCentavos)} (no sistema: ${reais(pedido.valorRepasseCentavos)}), mas o repasse já foi pago.`);
    } else if (!pedido.profissionalId && !d.profissionalId) {
      d.conflitos.push(`Pagamento do profissional mudou para ${reais(negocio.repasseCentavos)}, mas o atendimento não tem profissional no sistema.`);
    } else {
      d.valorRepasseCentavos = negocio.repasseCentavos;
      d.feitas.push(`repasse: de ${reais(pedido.valorRepasseCentavos)} para ${reais(negocio.repasseCentavos)}`);
    }
  }

  const paciente = negocio.paciente?.trim();
  if (paciente && paciente !== (pedido.paciente ?? "").trim()) {
    d.paciente = paciente;
    d.feitas.push(`paciente: de ${pedido.paciente?.trim() || "—"} para ${paciente}`);
  }

  if (negocio.pago === true && !pedido.pagoNoSistema && !pedido.baixaPeloPipedrive) {
    d.baixa = true;
    d.feitas.push("pagamento: baixa dada (Pagamento Realizado = Sim)");
  } else if (negocio.pago === false && pedido.baixaPeloPipedrive) {
    d.baixa = false;
    d.feitas.push("pagamento: baixa desfeita (Pagamento Realizado = Não)");
  }

  return d;
}
