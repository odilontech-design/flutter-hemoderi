import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Tabela, Titulo, Vazio } from "@/components/ui";
import { BotaoAcao } from "@/components/BotaoAcao";
import { AcoesDeAcesso, SituacaoAcesso } from "@/components/AcessoDoCadastro";
import { alternarClinica } from "@/app/actions/cadastros";

export const dynamic = "force-dynamic";

export default async function Clinicas() {
  await exigirInterno();

  const clinicas = await prisma.clinica.findMany({
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

      <Cartao>
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
      </Cartao>
    </>
  );
}
