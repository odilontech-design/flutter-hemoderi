import { MenuLateral } from "@/components/MenuLateral";
import { Provedores } from "@/components/Provedores";
import { exigirProfissional } from "@/lib/sessao";

export const dynamic = "force-dynamic";

const ITENS = [
  { href: "/profissional", icone: "📅", rotulo: "Minha agenda" },
  { href: "/profissional/disponibilidade", icone: "⏱", rotulo: "Disponibilidade" },
  { href: "/profissional/ganhos", icone: "◐", rotulo: "Meus ganhos" },
];

export default async function LayoutProfissional({ children }: { children: React.ReactNode }) {
  const sessao = await exigirProfissional();

  return (
    <Provedores>
      <div className="flex">
        <MenuLateral titulo={sessao.profissionalNome} subtitulo="Portal do profissional" itens={ITENS} />
        <main className="flex-1 min-h-screen overflow-x-hidden p-4 pt-20 md:p-8">{children}</main>
      </div>
    </Provedores>
  );
}
