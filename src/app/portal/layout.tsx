import { MenuLateral } from "@/components/MenuLateral";
import { Provedores } from "@/components/Provedores";
import { exigirClinica } from "@/lib/sessao";

export const dynamic = "force-dynamic";

const ITENS = [
  { href: "/portal", icone: "◉", rotulo: "Meus agendamentos" },
  { href: "/portal/agendar", icone: "📅", rotulo: "Agendar" },
];

export default async function LayoutPortal({ children }: { children: React.ReactNode }) {
  const sessao = await exigirClinica();

  return (
    <Provedores>
      <div className="flex">
        <MenuLateral titulo={sessao.clinicaNome} subtitulo="Portal da clínica" itens={ITENS} />
        <main className="flex-1 min-h-screen overflow-x-hidden p-4 pt-20 md:p-8">{children}</main>
      </div>
    </Provedores>
  );
}
