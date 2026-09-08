import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Campo, Cartao, Rotulo, Tabela, Titulo, Vazio } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { BotaoAcao } from "@/components/BotaoAcao";
import { alternarProfissional, salvarProfissional } from "@/app/actions/cadastros";
import { formatarPercent } from "@/lib/dinheiro";

export const dynamic = "force-dynamic";

export default async function Profissionais() {
  await exigirInterno();

  const profissionais = await prisma.profissional.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    include: { _count: { select: { pedidos: true, disponibilidades: true } } },
  });

  return (
    <>
      <Titulo>Profissionais</Titulo>

      <div className="grid lg:grid-cols-3 gap-3">
        <Cartao className="lg:col-span-2">
          {profissionais.length === 0 ? (
            <Vazio>Nenhum profissional cadastrado.</Vazio>
          ) : (
            <Tabela cabecalho={["Profissional", "Conselho", "Repasse", "Disponibilidade", "Atendimentos", ""]}>
              {profissionais.map((profissional) => (
                <tr key={profissional.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-3">
                    <div className="font-semibold text-navy">{profissional.nome}</div>
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
                      <span className="text-hemo font-semibold">não declarada</span>
                    ) : (
                      `${profissional._count.disponibilidades} janela(s)`
                    )}
                  </td>
                  <td className="py-2 pr-3 text-gray-500">{profissional._count.pedidos}</td>
                  <td className="py-2">
                    <BotaoAcao
                      acao={alternarProfissional.bind(null, profissional.id, !profissional.ativo)}
                      variante={profissional.ativo ? "perigo" : "secundario"}
                    >
                      {profissional.ativo ? "Desativar" : "Reativar"}
                    </BotaoAcao>
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>

        <Cartao>
          <div className="font-display font-bold text-navy text-sm mb-3">Novo profissional</div>
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
            <div className="text-[10px] text-gray-400">
              Repasse vazio usa o percentual padrão da operação. Serviço com regra própria vence
              este percentual.
            </div>
          </FormularioAcao>
        </Cartao>
      </div>
    </>
  );
}
