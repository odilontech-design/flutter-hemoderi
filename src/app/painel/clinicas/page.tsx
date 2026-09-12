import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Campo, Cartao, Rotulo, Tabela, Titulo, Vazio } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { BotaoAcao } from "@/components/BotaoAcao";
import { alternarClinica, salvarClinica } from "@/app/actions/cadastros";

export const dynamic = "force-dynamic";

export default async function Clinicas() {
  await exigirInterno();

  const clinicas = await prisma.clinica.findMany({
    orderBy: [{ ativa: "desc" }, { nome: "asc" }],
    include: { _count: { select: { pedidos: true } } },
  });

  return (
    <>
      <Titulo>Clínicas contratantes</Titulo>

      <div className="grid lg:grid-cols-3 gap-3">
        <Cartao className="lg:col-span-2">
          {clinicas.length === 0 ? (
            <Vazio>Nenhuma clínica cadastrada.</Vazio>
          ) : (
            <Tabela cabecalho={["Clínica", "Cidade", "Salas", "Pedidos", "Link do portal", ""]}>
              {clinicas.map((clinica) => (
                <tr key={clinica.id} className="border-b border-gray-100 last:border-0">
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
                  </td>
                  <td className="py-2 pr-3">{clinica.salas}</td>
                  <td className="py-2 pr-3 text-gray-500">{clinica._count.pedidos}</td>
                  <td className="py-2 pr-3">
                    <code className="text-[10px] text-gray-500">/portal/agendar/{clinica.slug}</code>
                  </td>
                  <td className="py-2">
                    <BotaoAcao
                      acao={alternarClinica.bind(null, clinica.id, !clinica.ativa)}
                      variante={clinica.ativa ? "perigo" : "secundario"}
                      confirmar={
                        clinica.ativa
                          ? "Desativar bloqueia o acesso da clínica ao portal. Confirma?"
                          : undefined
                      }
                    >
                      {clinica.ativa ? "Desativar" : "Reativar"}
                    </BotaoAcao>
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>

        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-3">Nova clínica</div>
          <FormularioAcao acao={salvarClinica} botao="Cadastrar clínica">
            <div>
              <Rotulo>Nome</Rotulo>
              <Campo name="nome" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Rotulo>CNPJ</Rotulo>
                <Campo name="cnpj" />
              </div>
              <div>
                <Rotulo>Telefone</Rotulo>
                <Campo name="telefone" placeholder="(11) 99999-0000" />
              </div>
            </div>
            <div>
              <Rotulo>E-mail</Rotulo>
              <Campo name="email" type="email" />
            </div>
            <div>
              <Rotulo>Endereço</Rotulo>
              <Campo name="endereco" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Rotulo>Cidade</Rotulo>
                <Campo name="cidade" />
              </div>
              <div>
                <Rotulo>UF</Rotulo>
                <Campo name="uf" maxLength={2} />
              </div>
            </div>
            <div>
              <Rotulo>Salas de atendimento simultâneo</Rotulo>
              <Campo name="salas" type="number" min={1} defaultValue={1} />
              <div className="text-[10px] text-gray-400 mt-1">
                Quantos atendimentos cabem ao mesmo tempo no endereço. É o que permite alocar
                dois profissionais no mesmo horário sem que o sistema veja conflito.
              </div>
            </div>
          </FormularioAcao>
        </Cartao>
      </div>
    </>
  );
}
