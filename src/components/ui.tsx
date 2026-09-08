import type { StatusPedido } from "@prisma/client";
import { COR_STATUS, ROTULO_STATUS } from "@/lib/pedido";

export function Cartao({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`bg-white border border-gray-200 rounded-2xl p-5 ${className}`}>{children}</div>;
}

export function Titulo({ children, acao }: { children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5">
      <h1 className="font-display font-extrabold text-navy text-xl">{children}</h1>
      {acao}
    </div>
  );
}

export function Kpi({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string }) {
  return (
    <Cartao>
      <div className="text-[11px] text-gray-500 mb-1">{rotulo}</div>
      <div className="text-xl font-display font-extrabold text-navy">{valor}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-1">{sub}</div>}
    </Cartao>
  );
}

export function SeloStatus({ status }: { status: StatusPedido }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${COR_STATUS[status]}`}>
      {ROTULO_STATUS[status]}
    </span>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-gray-400 py-8 text-center">{children}</div>;
}

export function Rotulo({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-semibold text-gray-600 mb-1">{children}</label>;
}

const CAMPO =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy";

export function Campo(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CAMPO} ${props.className ?? ""}`} />;
}

export function Selecao(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CAMPO} ${props.className ?? ""}`} />;
}

export function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CAMPO} ${props.className ?? ""}`} />;
}

export function Botao({
  variante = "primario",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "perigo" }) {
  const estilos = {
    primario: "bg-navy text-white hover:bg-navyDeep",
    secundario: "bg-white text-navy border border-gray-300 hover:bg-gray-50",
    perigo: "bg-white text-hemo border border-hemo/40 hover:bg-hemo/5",
  }[variante];
  return (
    <button
      {...props}
      className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50 ${estilos} ${className}`}
    />
  );
}

export function Tabela({ cabecalho, children }: { cabecalho: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            {cabecalho.map((c) => (
              <th key={c} className="font-semibold py-2 pr-3 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Aviso({ children, tom = "info" }: { children: React.ReactNode; tom?: "info" | "alerta" | "erro" }) {
  const estilos = {
    info: "bg-sky-50 text-sky-800 border-sky-200",
    alerta: "bg-amber-50 text-amber-800 border-amber-200",
    erro: "bg-rose-50 text-rose-800 border-rose-200",
  }[tom];
  return <div className={`text-xs border rounded-lg px-3 py-2 ${estilos}`}>{children}</div>;
}
