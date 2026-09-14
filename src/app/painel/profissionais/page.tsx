import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Campo, Cartao, Rotulo, Tabela, Titulo, Vazio } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { BotaoAcao } from "@/components/BotaoAcao";
import { AcoesDeAcesso, SituacaoAcesso } from "@/components/AcessoDoCadastro";
import { alternarProfissional, salvarProfissional } from "@/app/actions/cadastros";
import { formatarPercent, formatarReais } from "@/lib/dinheiro";
import { estrelas, formatarMedia } from "@/lib/avaliacao";
import { CampoDocumento } from "@/components/CampoDocumento";
import { ImportarProfissionais } from "./ImportarProfissionais";

export const dynamic = "force-dynamic";

export default async function Profissionais() {
  await exigirInterno();

  // A nota vem de um groupBy separado, não de um include: trazer todas as
  // avaliações de cada profissional só para tirar a média carregaria o
  // histórico inteiro da operação numa tela de lista.
  const notas = await prisma.avaliacao.groupBy({
    by: ["profissionalId"],
    _avg: { nota: true },
    _count: true,
  });

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
              cabecalho={[
                "Profissional",
                "Conselho",
                "Repasse",
                "Avaliação",
                "Disponibilidade",
                "Acesso ao portal",
                "Ações",
              ]}
            >
              {profissionais.map((profissional) => {
                const nota = notas.find((n) => n.profissionalId === profissional.id);
                const media = nota?._avg.nota != null ? Math.round(nota._avg.nota * 10) / 10 : null;
                return (
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
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {profissional.repasseFixoCentavos != null ? (
                      formatarReais(profissional.repasseFixoCentavos)
                    ) : profissional.repassePercentPadrao != null ? (
                      formatarPercent(profissional.repassePercentPadrao)
                    ) : (
                      <span className="text-gray-400">padrão</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {media === null ? (
                      <span className="text-gray-300">sem avaliação</span>
                    ) : (
                      <>
                        <span className="text-amber-500">{estrelas(media)}</span>
                        <div className="text-[10px] text-gray-400">
                          {formatarMedia(media)} em {nota?._count}
                        </div>
                      </>
                    )}
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
                    <div className="text-[10px]">
                      {profissional.googleAgendaId ? (
                        <span className="text-green-700" title={profissional.googleAgendaId}>
                          Google Agenda ✓
                        </span>
                      ) : (
                        <span className="text-gray-400">sem Google Agenda</span>
                      )}
                    </div>
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
                );
              })}
            </Tabela>
          )}
        </Cartao>

        <Cartao>
          <div className="mb-4 pb-4 border-b border-gray-100">
            <ImportarProfissionais />
          </div>

          <div className="font-display font-bold text-bordo text-sm mb-3">Novo profissional</div>
          <FormularioAcao acao={salvarProfissional} botao="Cadastrar profissional">
            <div>
              <Rotulo>Nome</Rotulo>
              <Campo name="nome" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CampoDocumento tipo="cpf" name="cpf" rotulo="CPF" />
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
            <div>
              <Rotulo>Agenda do Google (opcional)</Rotulo>
              <Campo name="googleAgendaId" type="email" placeholder="profissional@gmail.com" />
              <div className="text-[10px] text-gray-400 mt-1">
                E-mail da conta Google dele. Só funciona depois que ele compartilhar a própria agenda
                com a conta de serviço da Hemoderi — o passo a passo está no portal do profissional.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Rotulo>Chave PIX</Rotulo>
                <Campo name="chavePix" />
              </div>
              <div>
                <Rotulo>Repasse por atendimento (R$)</Rotulo>
                <Campo name="repasseFixoCentavos" placeholder="150,00" inputMode="decimal" />
              </div>
            </div>
            <div className="text-[10px] text-gray-400 leading-relaxed">
              O repasse é valor fechado por atendimento. Vazio, cai no percentual padrão da
              operação; serviço com regra própria vence os dois.
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
