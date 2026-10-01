import { MenuLateral } from "@/components/MenuLateral";
import { Provedores } from "@/components/Provedores";
import { CentralDeAvisos } from "@/components/CentralDeAvisos";
import { exigirInterno } from "@/lib/sessao";
import { perfilPermite } from "@/lib/papeis";
import { agendamentoPublicoAtivo } from "@/lib/agendamento-publico";
import {
  IconeAcessos,
  IconeAgenda,
  IconeAgendamentos,
  IconeCatalogo,
  IconeClinicas,
  IconeDisponibilidade,
  IconeFinanceiro,
  IconeHoje,
  IconePedidosSite,
  IconeProfissionais,
} from "@/components/icones/MenuIcones";

// Tudo aqui depende da sessão e do banco: nada pode ser pré-renderizado.
export const dynamic = "force-dynamic";

const ITENS = [
  { href: "/painel", icone: <IconeHoje />, rotulo: "Hoje" },
  { href: "/painel/pedidos", icone: <IconeAgendamentos />, rotulo: "Agendamentos" },
  { href: "/painel/solicitacoes", icone: <IconePedidosSite />, rotulo: "Pedidos do site" },
  { href: "/painel/agenda", icone: <IconeAgenda />, rotulo: "Agenda" },
  { href: "/painel/disponibilidade", icone: <IconeDisponibilidade />, rotulo: "Disponibilidade" },
  { href: "/painel/clinicas", icone: <IconeClinicas />, rotulo: "Clínicas" },
  { href: "/painel/profissionais", icone: <IconeProfissionais />, rotulo: "Profissionais" },
  { href: "/painel/catalogo", icone: <IconeCatalogo />, rotulo: "Serviços e equipamentos" },
  { href: "/painel/financeiro", icone: <IconeFinanceiro />, rotulo: "Financeiro" },
  { href: "/painel/cupons", icone: <IconeCatalogo />, rotulo: "Cupons de desconto" },
  { href: "/painel/integracoes", icone: <IconeCatalogo />, rotulo: "Integração PipeDrive" },
  { href: "/painel/acessos", icone: <IconeAcessos />, rotulo: "Acessos" },
];

// As duas telas que expõem repasse por profissional e gestão de acesso —
// exatamente o que a reunião de 14/09 pediu para tirar do dia a dia de quem
// é só atendente. Tirar do menu não substitui a guarda (`exigirResponsavel`
// em cada página e ação): é só o que evita a pessoa clicar em algo que a
// própria tela vai recusar.
const ITENS_SO_RESPONSAVEL = new Set(["/painel/financeiro", "/painel/cupons", "/painel/acessos", "/painel/integracoes"]);

// A grade de disponibilidade é a mesa da logística (ata de 28/09). Quem não
// aloca não precisa dela no menu — mesma lógica dos itens de responsável:
// esconder não substitui a guarda da própria página, é só evitar o clique
// que a tela vai recusar. perfilPermite deixa RESPONSAVEL passar sozinho.
const ITENS_SO_LOGISTICA = new Set(["/painel/disponibilidade"]);

// "Pedidos do site" só trata o que vem do agendamento público. Com a página
// pública desligada não há o que tratar, e o item no menu só confunde.
const ITENS_DO_SITE = new Set(["/painel/solicitacoes"]);

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const sessao = await exigirInterno();
  const podeLogistica = perfilPermite(sessao.perfil, "LOGISTICA");
  const sitePublico = agendamentoPublicoAtivo();
  const itens = ITENS.filter((item) => {
    if (ITENS_DO_SITE.has(item.href)) return sitePublico;
    if (ITENS_SO_RESPONSAVEL.has(item.href)) return sessao.perfil === "RESPONSAVEL";
    if (ITENS_SO_LOGISTICA.has(item.href)) return podeLogistica;
    return true;
  });

  return (
    <Provedores>
      <div className="flex">
        <MenuLateral
          titulo="Hemoderi"
          nomeUsuario={sessao.nome}
          itens={itens}
          trocaPerfil={
            sessao.profissionalId
              ? { href: "/profissional", rotulo: "Ir para portal profissional" }
              : undefined
          }
        />
        <main className="flex-1 min-h-screen overflow-x-hidden p-4 pt-20 md:p-8">{children}</main>
        <CentralDeAvisos area="painel" />
      </div>
    </Provedores>
  );
}
