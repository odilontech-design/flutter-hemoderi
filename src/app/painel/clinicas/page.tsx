import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Campo, Cartao, Rotulo, Tabela, Titulo, Vazio } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { FormularioRecolhivel } from "@/components/FormularioRecolhivel";
import { BotaoAcao } from "@/components/BotaoAcao";
import { AcoesDeAcesso, SituacaoAcesso } from "@/components/AcessoDoCadastro";
import { CamposEndereco } from "@/components/CamposEndereco";
import { CampoDocumento } from "@/components/CampoDocumento";
import { alternarClinica, salvarClinica } from "@/app/actions/cadastros";

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
      <Titulo>Clínicas contratantes</Titulo>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Cartao className="lg:col-span-2">
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

        <FormularioRecolhivel titulo="Nova clínica">
          <FormularioAcao acao={salvarClinica} botao="Cadastrar clínica">
            <div>
              <Rotulo>Nome</Rotulo>
              <Campo name="nome" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CampoDocumento tipo="cnpj" name="cnpj" rotulo="CNPJ" />
              <div>
                <Rotulo>Telefone</Rotulo>
                <Campo name="telefone" placeholder="(11) 99999-0000" />
              </div>
            </div>
            <div>
              <Rotulo>E-mail</Rotulo>
              <Campo name="email" type="email" />
            </div>

            <CamposEndereco />
            <div>
              <Rotulo>Salas de atendimento simultâneo</Rotulo>
              <Campo name="salas" type="number" min={1} defaultValue={1} />
              <div className="text-[10px] text-gray-400 mt-1">
                Quantos atendimentos cabem ao mesmo tempo no endereço. É o que permite alocar
                dois profissionais no mesmo horário sem que o sistema veja conflito.
              </div>
            </div>
            <div className="text-[10px] text-gray-400 leading-relaxed">
              Com o e-mail preenchido, o acesso ao portal sai em um clique na própria lista
              (<strong>Gerar acesso</strong>) — a senha é sorteada pelo sistema e aparece na tela
              para você repassar.
            </div>
          </FormularioAcao>
        </FormularioRecolhivel>
      </div>
    </>
  );
}
