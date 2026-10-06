import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Tabela, Titulo, Vazio } from "@/components/ui";
import { BotaoAcao } from "@/components/BotaoAcao";
import { AcoesDeAcesso, SituacaoAcesso } from "@/components/AcessoDoCadastro";
import { alternarClinica } from "@/app/actions/cadastros";
import { ROTULO_PERFIL_CLIENTE } from "@/lib/visibilidade";
import { TriagemCadastro } from "./TriagemCadastro";
import { PreCadastros } from "./PreCadastros";

export const dynamic = "force-dynamic";

export default async function Clinicas({
  searchParams,
}: {
  searchParams: { aba?: string; busca?: string; pagina?: string; clientes?: string };
}) {
  const sessao = await exigirInterno();
  const abaPre = searchParams.aba === "pre";
  const totalPre = await prisma.clinica.count({ where: { preCadastro: true } });

  const [tabelas, pendentes] = await Promise.all([
    prisma.tabelaPreco.findMany({
      where: { ativa: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, perfil: true },
    }),
    // A fila da triagem (ata de 01/10): autocadastros que ainda não foram
    // conferidos. O mais antigo primeiro — quem espera há mais tempo.
    prisma.clinica.findMany({
      where: { statusCadastro: "PENDENTE" },
      orderBy: { criadaEm: "asc" },
      select: {
        id: true,
        nome: true,
        cnpj: true,
        telefone: true,
        email: true,
        cidade: true,
        uf: true,
        perfilDeclarado: true,
        criadaEm: true,
      },
    }),
  ]);

  const clinicas = abaPre
    ? []
    : await prisma.clinica.findMany({
    // Pré-cadastros do CRM têm aba própria: são milhares e não são clientes
    // ativos ainda.
    where: { preCadastro: false },
    orderBy: [{ ativa: "desc" }, { nome: "asc" }],
    include: {
      _count: { select: { pedidos: true } },
      // Mesma razão da lista de profissionais: "essa clínica já consegue
      // abrir o portal?" é pergunta de cadastro, não de outra tela.
      usuarios: {
        select: { id: true, desativadoEm: true, senhaProvisoria: true },
        orderBy: { criadoEm: "asc" },
      },
    },
  });

  return (
    <>
      <Titulo
        acao={
          <Link
            href="/painel/clinicas/novo"
            className="bg-bordo text-white text-xs font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-lg hover:bg-bordoEscuro"
          >
            + Nova clínica
          </Link>
        }
      >
        Clínicas contratantes
      </Titulo>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link
          href="/painel/clinicas"
          className={`text-[11px] font-semibold px-3 py-2.5 sm:py-1.5 rounded-full border ${
            !abaPre ? "bg-bordo text-white border-bordo" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          Clientes
        </Link>
        {(totalPre > 0 || abaPre) && (
          <Link
            href="/painel/clinicas?aba=pre"
            className={`text-[11px] font-semibold px-3 py-2.5 sm:py-1.5 rounded-full border ${
              abaPre ? "bg-bordo text-white border-bordo" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Pré-cadastros do CRM · {totalPre}
          </Link>
        )}
        {sessao.perfil === "RESPONSAVEL" && (
          <Link href="/painel/clinicas/importar-crm" className="ml-auto text-[11px] font-semibold text-bordo hover:underline">
            Importar base do CRM →
          </Link>
        )}
      </div>

      {abaPre && <PreCadastros busca={searchParams.busca} pagina={searchParams.pagina} soClientes={searchParams.clientes === "1"} />}

      {!abaPre && pendentes.length > 0 && (
        <Cartao className="mb-3 border-amber-200 bg-amber-50/40">
          <div className="font-display font-bold text-bordo text-sm mb-1">
            Cadastros aguardando triagem ({pendentes.length})
          </div>
          <div className="text-[11px] text-gray-500 leading-relaxed">
            Clientes que se cadastraram sozinhos. Confira o perfil que declararam — o agendamento só é
            liberado depois da sua aprovação.
          </div>
          <div className="divide-y divide-amber-200/70">
            {pendentes.map((pendente) => (
              <div key={pendente.id} className="py-4 first:pt-3 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link href={`/painel/clinicas/${pendente.id}`} className="font-semibold text-bordo hover:underline text-sm">
                    {pendente.nome}
                  </Link>
                  <span className="text-[11px] text-gray-600">
                    declarou:{" "}
                    <strong>{pendente.perfilDeclarado ? ROTULO_PERFIL_CLIENTE[pendente.perfilDeclarado] : "—"}</strong>
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {[pendente.email, pendente.telefone, pendente.cnpj, [pendente.cidade, pendente.uf].filter(Boolean).join("/")]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <TriagemCadastro
                  clinicaId={pendente.id}
                  perfilDeclarado={pendente.perfilDeclarado}
                  tabelas={tabelas}
                />
              </div>
            ))}
          </div>
        </Cartao>
      )}

      {!abaPre && <Cartao>
        {clinicas.length === 0 ? (
            <Vazio>Nenhuma clínica cadastrada.</Vazio>
          ) : (
            <Tabela cabecalho={["Clínica", "Cidade", "Pedidos", "Link do portal", "Acesso ao portal", "Ações"]}>
              {clinicas.map((clinica) => (
                <tr key={clinica.id} className="border-b border-gray-100 last:border-0 align-top">
                  <td className="py-2 pr-3">
                    <Link
                      href={`/painel/clinicas/${clinica.id}`}
                      className="font-semibold text-bordo hover:underline"
                    >
                      {clinica.nome}
                    </Link>
                    <div className="text-[10px] text-gray-400">{clinica.telefone ?? "sem telefone"}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {clinica.perfis.length > 0
                        ? clinica.perfis.map((p) => ROTULO_PERFIL_CLIENTE[p]).join(" · ")
                        : "sem perfil"}
                      {clinica.statusCadastro === "PENDENTE" && (
                        <span className="ml-1.5 font-semibold text-amber-700">em triagem</span>
                      )}
                      {clinica.statusCadastro === "RECUSADO" && (
                        <span className="ml-1.5 font-semibold text-red-600">recusado</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-gray-500">
                    {clinica.cidade ?? "—"}
                    {clinica.uf ? `/${clinica.uf}` : ""}
                    {clinica.endereco && (
                      <div className="text-[10px] text-gray-400">
                        {clinica.endereco}
                        {clinica.numero ? `, ${clinica.numero}` : ""}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-gray-500">
                    {clinica._count.pedidos}
                    <div className="text-[10px] text-gray-400">{clinica.salas} sala(s)</div>
                  </td>
                  <td className="py-2 pr-3">
                    <code className="text-[10px] text-gray-500">/portal/agendar/{clinica.slug}</code>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <SituacaoAcesso acessos={clinica.usuarios} />
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1.5 whitespace-nowrap">
                      <AcoesDeAcesso
                        tipo="clinica"
                        cadastroId={clinica.id}
                        nome={clinica.nome}
                        acessos={clinica.usuarios}
                      />
                      <BotaoAcao
                        acao={alternarClinica.bind(null, clinica.id, !clinica.ativa)}
                        variante={clinica.ativa ? "perigo" : "secundario"}
                        confirmar={
                          clinica.ativa
                            ? `Desativar ${clinica.nome} bloqueia o portal dela na hora. Os pedidos e o histórico continuam. Confirma?`
                            : undefined
                        }
                      >
                        {clinica.ativa ? "Desativar" : "Reativar"}
                      </BotaoAcao>
                    </div>
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
      </Cartao>}
    </>
  );
}
