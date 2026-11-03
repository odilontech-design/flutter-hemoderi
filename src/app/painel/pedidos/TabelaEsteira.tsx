import Link from "next/link";
import type { StatusPedido } from "@prisma/client";
import { SeloStatus } from "@/components/ui";
import { formatarDataCurta } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { codigoDoPedido } from "@/lib/numeracao";
import type { OrdemEsteira } from "@/lib/filtros-esteira";
import { RotulosDaTabela } from "@/components/RotulosDaTabela";

type Linha = {
  id: string;
  numero: number;
  data: Date;
  horaInicio: string;
  status: StatusPedido;
  valorServicoCentavos: number;
  doutorNome: string | null;
  clinica: { nome: string };
  servico: { nome: string; familia?: string | null };
  profissional: { nome: string } | null;
};

/**
 * A esteira em tabela (ata de 03/11): uma linha por serviço, com os
 * cabeçalhos clicáveis para ordenar por data, equipamento, clínica,
 * profissional, status e valor. As ações ficam no cartão — "abrir" leva a ele.
 */
export function TabelaEsteira({
  pedidos,
  ordem,
  linkDaOrdem,
}: {
  pedidos: Linha[];
  ordem: { coluna: OrdemEsteira; desc: boolean };
  linkDaOrdem: (valor: string) => string;
}) {
  const cabecalho = (rotulo: string, coluna?: OrdemEsteira) => {
    if (!coluna) return <th className="py-2 pr-3 font-semibold text-left whitespace-nowrap">{rotulo}</th>;
    const ativa = ordem.coluna === coluna;
    const proxima = ativa && !ordem.desc ? `-${coluna}` : coluna;
    return (
      <th className="py-2 pr-3 font-semibold text-left whitespace-nowrap">
        <Link href={linkDaOrdem(proxima)} className={`hover:underline ${ativa ? "text-bordo" : ""}`}>
          {rotulo} {ativa ? (ordem.desc ? "↓" : "↑") : <span className="text-gray-300">↕</span>}
        </Link>
      </th>
    );
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white px-0 sm:px-0">
      {/* No celular vira cartões, como as outras tabelas (globals.css). */}
      <RotulosDaTabela />
      <table className="tabela-cartoes min-w-full text-xs">
        <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
          <tr className="[&>th:first-child]:pl-4">
            {cabecalho("Data", "data")}
            {cabecalho("Hora")}
            {cabecalho("Código")}
            {cabecalho("Clínica", "clinica")}
            {cabecalho("Doutor(a)")}
            {cabecalho("Equipamento / serviço", "equipamento")}
            {cabecalho("Profissional", "profissional")}
            {cabecalho("Status", "status")}
            {cabecalho("Valor", "valor")}
            <th className="py-2 pr-4" />
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => (
            <tr key={p.id} className="border-b border-gray-100 last:border-0 align-top hover:bg-bege/30">
              <td className="py-2 pl-4 pr-3 whitespace-nowrap font-semibold">{formatarDataCurta(p.data)}</td>
              <td className="py-2 pr-3">{p.horaInicio}</td>
              <td className="py-2 pr-3 whitespace-nowrap text-bordo font-semibold">{codigoDoPedido(p.numero, p.clinica.nome, p.data)}</td>
              <td className="py-2 pr-3 min-w-[160px]">{p.clinica.nome}</td>
              <td className="py-2 pr-3 text-gray-600">{p.doutorNome ?? "—"}</td>
              <td className="py-2 pr-3 min-w-[180px]">
                <div className="text-gray-800">{p.servico.familia ?? "—"}</div>
                <div className="text-[10px] text-gray-500">{p.servico.nome}</div>
              </td>
              <td className="py-2 pr-3">{p.profissional?.nome ?? <span className="text-red-600 font-semibold">sem profissional</span>}</td>
              <td className="py-2 pr-3"><SeloStatus status={p.status} /></td>
              <td className="py-2 pr-3 whitespace-nowrap font-semibold text-bordo">{formatarReais(p.valorServicoCentavos)}</td>
              <td className="py-2 pr-4">
                <Link href={`/painel/pedidos/${p.id}`} className="text-[11px] font-semibold text-bordo hover:underline">
                  abrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
