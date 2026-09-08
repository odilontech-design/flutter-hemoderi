import { MenuLateral } from "@/components/MenuLateral";
import { Provedores } from "@/components/Provedores";
import { exigirInterno } from "@/lib/sessao";

// Tudo aqui depende da sessão e do banco: nada pode ser pré-renderizado.
export const dynamic = "force-dynamic";

const ITENS = [
  { href: "/painel", icone: "◈", rotulo: "Hoje" },
  { href: "/painel/pedidos", icone: "◉", rotulo: "Esteira" },
  { href: "/painel/agenda", icone: "📅", rotulo: "Agenda" },
  { href: "/painel/clinicas", icone: "🏥", rotulo: "Clínicas" },
  { href: "/painel/profissionais", icone: "👤", rotulo: "Profissionais" },
  { href: "/painel/catalogo", icone: "📦", rotulo: "Serviços e equipamentos" },
  { href: "/painel/financeiro", icone: "◐", rotulo: "Financeiro" },
  { href: "/painel/acessos", icone: "🔑", rotulo: "Acessos" },
];

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const sessao = await exigirInterno();

  return (
    <Provedores>
      <div className="flex">
        <MenuLateral titulo="Hemoderi" subtitulo={sessao.nome} itens={ITENS} />
        <main className="flex-1 min-h-screen overflow-x-hidden p-4 pt-20 md:p-8">{children}</main>
      </div>
    </Provedores>
  );
}
