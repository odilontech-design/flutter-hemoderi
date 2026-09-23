import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Campo, Cartao, Rotulo, Selecao, Tabela, Titulo, Vazio } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { salvarProfissional } from "@/app/actions/cadastros";
import { CampoDocumento } from "@/components/CampoDocumento";
import { ImportarProfissionais } from "./ImportarProfissionais";
import { EditarProfissional } from "./EditarProfissional";

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

  const [profissionais, gruposRepasse] = await Promise.all([
    prisma.profissional.findMany({
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
    }),
    prisma.grupoRepasse.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

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
                { texto: "Conselho", ocultoMovel: true },
                { texto: "Repasse", ocultoMovel: true },
                { texto: "Avaliação", ocultoMovel: true },
                { texto: "Disponibilidade", ocultoMovel: true },
                "Acesso ao portal",
                "Ações",
              ]}
            >
              {profissionais.map((profissional) => {
                const nota = notas.find((n) => n.profissionalId === profissional.id);
                const media = nota?._avg.nota != null ? Math.round(nota._avg.nota * 10) / 10 : null;
                return (
                  <EditarProfissional
                    key={profissional.id}
                    profissional={profissional}
                    notaMedia={media}
                    notaQtd={nota?._count ?? 0}
                    gruposRepasse={gruposRepasse}
                  />
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Rotulo>UF</Rotulo>
                <Campo name="uf" placeholder="SP" maxLength={2} />
              </div>
              <div>
                <Rotulo>Grupo de repasse</Rotulo>
                <Selecao name="grupoRepasseId" defaultValue="">
                  <option value="">Nenhum</option>
                  {gruposRepasse.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
                </Selecao>
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
