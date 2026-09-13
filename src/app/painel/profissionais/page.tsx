import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Campo, Cartao, Rotulo, Tabela, Titulo, Vazio } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { BotaoAcao } from "@/components/BotaoAcao";
import { AcoesDeAcesso, SituacaoAcesso } from "@/components/AcessoDoCadastro";
import { alternarProfissional, salvarProfissional } from "@/app/actions/cadastros";
import { formatarPercent } from "@/lib/dinheiro";

export const dynamic = "force-dynamic";

export default async function Profissionais() {
  await exigirInterno();

  const profissionais = await prisma.profissional.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    include: {
      _count: { select: { pedidos: true, disponibilidades: true } },
      // O acesso ao portal faz parte do cadastro, não de outra tela: a
      // pergunta "esse profissional já consegue ver a agenda dele?" nasce
      // aqui, olhando a lista.
      usuarios: {
        select: { id: true, desativadoEm: true, senhaProvisoria: true },
        orderBy: { criadoEm: "asc" },
      },
    },
  });

  return (
    <>
      <Titulo>Profissionais</Titulo>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Cartao className="lg:col-span-2">
          {profissionais.length === 0 ? (
            <Vazio>Nenhum profissional cadastrado.</Vazio>
          ) : (
            <Tabela
              cabecalho={["Profissional", "Conselho", "Repasse", "Disponibilidade", "Acesso ao portal", "Ações"]}
            >
              {profissionais.map((profissional) => (
                <tr key={profissional.id} className="border-b border-gray-100 last:border-0 align-top">
                  <td className="py-2 pr-3">
                    <div className="font-semibold text-bordo">{profissional.nome}</div>
                    <div className="text-[10px] text-gray-400">
                      {profissional.especialidade ?? profissional.telefone ?? "—"}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-gray-500">
                    {profissional.conselho ? `${profissional.conselho} ${profissional.registro ?? ""}` : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    {profissional.repassePercentPadrao != null
                      ? formatarPercent(profissional.repassePercentPadrao)
                      : <span className="text-gray-400">padrão</span>}
                  </td>
                  <td className="py-2 pr-3">
                    {profissional._count.disponibilidades === 0 ? (
                      <span className="text-red-600 font-semibold">não declarada</span>
                    ) : (
                      `${profissional._count.disponibilidades} janela(s)`
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <SituacaoAcesso acessos={profissional.usuarios} />
                    <div className="text-[10px] text-gray-400">{profissional._count.pedidos} atendimento(s)</div>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1.5 whitespace-nowrap">
                      <AcoesDeAcesso
                        tipo="profissional"
                        cadastroId={profissional.id}
                        nome={profissional.nome}
                        acessos={profissional.usuarios}
                      />
                      <BotaoAcao
                        acao={alternarProfissional.bind(null, profissional.id, !profissional.ativo)}
                        variante={profissional.ativo ? "perigo" : "secundario"}
                        confirmar={
                          profissional.ativo
                            ? `Desativar ${profissional.nome}? O portal dele para na hora e ele sai das telas de alocação; a agenda e o histórico continuam.`
                            : undefined
                        }
                      >
                        {profissional.ativo ? "Desativar" : "Reativar"}
                      </BotaoAcao>
                    </div>
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>

        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-3">Novo profissional</div>
          <FormularioAcao acao={salvarProfissional} botao="Cadastrar profissional">
            <div>
              <Rotulo>Nome</Rotulo>
              <Campo name="nome" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Rotulo>CPF</Rotulo>
                <Campo name="cpf" />
              </div>
              <div>
                <Rotulo>Telefone</Rotulo>
                <Campo name="telefone" />
              </div>
            </div>
            <div>
              <Rotulo>E-mail</Rotulo>
              <Campo name="email" type="email" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Rotulo>Conselho</Rotulo>
                <Campo name="conselho" placeholder="COREN-SP" />
              </div>
              <div>
                <Rotulo>Registro</Rotulo>
                <Campo name="registro" />
              </div>
            </div>
            <div>
              <Rotulo>Especialidade</Rotulo>
              <Campo name="especialidade" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Rotulo>Chave PIX</Rotulo>
                <Campo name="chavePix" />
              </div>
              <div>
                <Rotulo>Repasse (%)</Rotulo>
                <Campo name="repassePercentPadrao" placeholder="60" />
              </div>
            </div>
            <div className="text-[10px] text-gray-400 leading-relaxed">
              Repasse vazio usa o percentual padrão da operação. Serviço com regra própria vence
              este percentual.
              <br />
              Com o e-mail preenchido, o acesso ao portal sai em um clique na própria lista
              (<strong>Gerar acesso</strong>) — a senha é sorteada pelo sistema e aparece na tela
              para você repassar.
            </div>
          </FormularioAcao>
        </Cartao>
      </div>
    </>
  );
}
