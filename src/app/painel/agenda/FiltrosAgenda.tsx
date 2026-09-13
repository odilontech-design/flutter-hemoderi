"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Campo, Rotulo, Selecao } from "@/components/ui";
import { OPCOES_STATUS, PERIODOS, urlAgenda, type ValoresFiltro } from "./filtros";

/**
 * Filtros da agenda. Tudo vai para a URL, e não para estado local: a equipe
 * manda "abre essa tela aqui" no WhatsApp o dia inteiro, e um link que não
 * carrega o que a pessoa estava vendo não serve para isso. De quebra, o botão
 * voltar do navegador funciona como se espera.
 */
export function FiltrosAgenda({
  valores,
  profissionais,
  clinicas,
  servicos,
  temFiltroAtivo,
}: {
  valores: ValoresFiltro;
  profissionais: { id: string; nome: string }[];
  clinicas: { id: string; nome: string }[];
  servicos: { id: string; nome: string }[];
  temFiltroAtivo: boolean;
}) {
  const router = useRouter();

  function trocar(campo: keyof ValoresFiltro, valor: string) {
    router.push(urlAgenda(valores, { [campo]: valor }));
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <Rotulo>Data</Rotulo>
          <Campo type="date" value={valores.data} onChange={(e) => trocar("data", e.target.value)} />
        </div>
        <div>
          <Rotulo>Período</Rotulo>
          <Selecao value={valores.dias} onChange={(e) => trocar("dias", e.target.value)}>
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </Selecao>
        </div>
        <div>
          <Rotulo>Profissional</Rotulo>
          <Selecao value={valores.profissional} onChange={(e) => trocar("profissional", e.target.value)}>
            <option value="">Todos</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Selecao>
        </div>
        <div>
          <Rotulo>Clínica</Rotulo>
          <Selecao value={valores.clinica} onChange={(e) => trocar("clinica", e.target.value)}>
            <option value="">Todas</option>
            {clinicas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
        </div>
        <div>
          <Rotulo>Serviço</Rotulo>
          <Selecao value={valores.servico} onChange={(e) => trocar("servico", e.target.value)}>
            <option value="">Todos</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Selecao>
        </div>
        <div>
          <Rotulo>Status</Rotulo>
          <Selecao value={valores.status} onChange={(e) => trocar("status", e.target.value)}>
            {OPCOES_STATUS.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </Selecao>
        </div>
      </div>

      {temFiltroAtivo && (
        <div className="mt-3">
          <Link
            href={urlAgenda({ ...valores, profissional: "", clinica: "", servico: "", status: "" })}
            className="text-[11px] font-semibold text-bordo hover:underline"
          >
            Limpar filtros
          </Link>
        </div>
      )}
    </div>
  );
}
