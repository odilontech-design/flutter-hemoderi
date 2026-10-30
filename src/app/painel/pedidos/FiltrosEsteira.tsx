"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CONDICOES_PAGAMENTO } from "@/lib/pagamento";
import { PERIODOS_ESTEIRA, type FiltrosEsteira as Filtros } from "@/lib/filtros-esteira";

const CAMPO = "border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white min-h-[40px] sm:min-h-0 w-full";

/**
 * Busca e filtros da esteira (André, 30/10). Um formulário GET: a busca vai na
 * URL, então funciona com voltar/avançar e dá para mandar o link. As listas
 * aplicam na hora; o texto, ao apertar Enter ou "Buscar".
 */
export function FiltrosEsteira({
  etapa,
  filtros,
  profissionais,
  familias,
  ativo,
}: {
  etapa: string;
  filtros: Filtros;
  profissionais: { id: string; nome: string }[];
  familias: string[];
  ativo: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [periodo, setPeriodo] = useState(filtros.periodo || (filtros.de || filtros.ate ? "intervalo" : ""));
  const aplicar = () => form.current?.requestSubmit();

  return (
    <form ref={form} method="get" action="/painel/pedidos" className="mb-3 rounded-2xl border border-gray-200 bg-white p-3">
      <input type="hidden" name="filtro" value={etapa} />
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="search"
          name="q"
          defaultValue={filtros.q}
          placeholder="Buscar por código, clínica, doutor, paciente, profissional ou serviço…"
          aria-label="Buscar agendamentos"
          className={`${CAMPO} sm:flex-1 text-sm`}
        />
        <button type="submit" className="bg-bordo text-white text-xs font-semibold px-4 py-2 rounded-lg min-h-[40px] sm:min-h-0 hover:bg-bordoEscuro">
          Buscar
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
        <select
          name="periodo"
          aria-label="Período"
          value={periodo}
          onChange={(e) => {
            setPeriodo(e.target.value);
            if (e.target.value !== "intervalo") setTimeout(aplicar, 0);
          }}
          className={CAMPO}
        >
          {PERIODOS_ESTEIRA.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </select>
        <select name="prof" aria-label="Profissional" defaultValue={filtros.prof} onChange={aplicar} className={CAMPO}>
          <option value="">Todos os profissionais</option>
          <option value="sem">Sem profissional</option>
          {profissionais.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <select name="familia" aria-label="Equipamento" defaultValue={filtros.familia} onChange={aplicar} className={CAMPO}>
          <option value="">Todos os equipamentos</option>
          {familias.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select name="pagamento" aria-label="Condição de pagamento" defaultValue={filtros.pagamento} onChange={aplicar} className={CAMPO}>
          <option value="">Todas as condições de pagamento</option>
          {CONDICOES_PAGAMENTO.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {periodo === "intervalo" && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-gray-500">
            De
            <input type="date" name="de" defaultValue={filtros.de} className={CAMPO} />
          </label>
          <label className="text-[11px] text-gray-500">
            Até
            <input type="date" name="ate" defaultValue={filtros.ate} className={CAMPO} />
          </label>
          <button type="submit" className="border border-gray-300 text-bordo text-xs font-semibold px-3 py-2 rounded-lg min-h-[40px] sm:min-h-0">
            Aplicar
          </button>
        </div>
      )}

      {ativo && (
        <div className="mt-2 text-[11px]">
          <Link href={`/painel/pedidos?filtro=${etapa}`} className="font-semibold text-bordo hover:underline">
            Limpar busca e filtros
          </Link>
        </div>
      )}
    </form>
  );
}
