import { formatarData } from "@/lib/data";
import { formatarReais } from "@/lib/dinheiro";
import { EMITENTE, NOTA_DE_DISPENSA, type ReciboDados } from "@/lib/recibo";
import { BotaoImprimir } from "./BotaoImprimir";

/** O recibo na forma do modelo da equipe: cabeçalho da empresa, dados do pagador, itens e total. */
export function Recibo({ recibo, cnpj, voltar }: { recibo: ReciboDados; cnpj: string; voltar: string }) {
  const { pagador } = recibo;
  return (
    <div className="min-h-screen bg-gray-100 print:bg-white py-6 print:py-0">
      <div className="max-w-3xl mx-auto mb-3 px-4 flex items-center justify-between print:hidden">
        <a href={voltar} className="text-xs font-semibold text-bordo hover:underline">
          ← Voltar
        </a>
        <BotaoImprimir />
      </div>

      <div className="max-w-3xl mx-auto bg-white shadow-sm print:shadow-none px-10 py-10 text-[13px] text-gray-900 leading-relaxed">
        <header className="flex items-start justify-between gap-6 border-b border-gray-300 pb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-recibo.png" alt="Hemoderi" className="h-20 w-auto" />
          <div className="text-right text-xs">
            <div className="font-bold text-sm">{EMITENTE.nome}</div>
            <div>CNPJ: {cnpj}</div>
            <div>{EMITENTE.endereco}</div>
            <div>{EMITENTE.cidade}</div>
          </div>
        </header>

        <div className="flex items-end justify-between mt-6 mb-5">
          <h1 className="text-xl font-bold">Recibo</h1>
          <div className="text-right text-xs">
            <div>
              <span className="text-gray-500">Número</span> <strong>{recibo.numero}</strong>
            </div>
            <div>
              <span className="text-gray-500">Data de emissão</span> <strong>{formatarData(recibo.emissao)}</strong>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 border border-gray-300 p-3 text-xs">
          <div className="col-span-2">Nome: {pagador.nome}</div>
          <div className="col-span-2">Endereço: {pagador.endereco}</div>
          <div>Município: {pagador.municipio}</div>
          <div>Estado: {pagador.uf}</div>
          <div>CEP: {pagador.cep}</div>
          <div>CPF/CNPJ: {pagador.documento}</div>
          <div>Cond. Pgto.: {recibo.condicao}</div>
          {recibo.cirurgiao && <div>Cirurgião: {recibo.cirurgiao}</div>}
        </div>

        <table className="w-full mt-5 text-xs border-collapse">
          <thead>
            <tr className="border-y border-gray-400 text-left">
              <th className="py-1.5 pr-2 w-14">Unid</th>
              <th className="py-1.5 pr-2 w-14">Quant</th>
              <th className="py-1.5 pr-2">Discriminação</th>
              <th className="py-1.5 pr-2 text-right w-28">Unitário</th>
              <th className="py-1.5 text-right w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {recibo.itens.map((item, i) => (
              <tr key={i} className="border-b border-gray-200 align-top">
                <td className="py-1.5 pr-2">{item.unidade}</td>
                <td className="py-1.5 pr-2">{item.quantidade}</td>
                <td className="py-1.5 pr-2">{item.descricao}</td>
                <td className="py-1.5 pr-2 text-right whitespace-nowrap">{formatarReais(item.unitarioCentavos)}</td>
                <td className="py-1.5 text-right whitespace-nowrap">{formatarReais(item.totalCentavos)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between mt-6 border-t border-gray-400 pt-2">
          <p className="text-[10px] text-gray-500 max-w-md">{NOTA_DE_DISPENSA}</p>
          <div className="text-right">
            <span className="text-gray-500 text-xs mr-3">Total</span>
            <strong className="text-base">{formatarReais(recibo.totalCentavos)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
