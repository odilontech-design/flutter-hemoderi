import { prisma } from "@/lib/prisma";
import { exigirInterno } from "@/lib/sessao";
import { Campo, Cartao, Rotulo, Selecao, Tabela, Titulo, Vazio } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { criarAcesso } from "@/app/actions/cadastros";
import { ROTULO_PAPEL } from "@/lib/papeis";
import { formatarData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Acessos() {
  await exigirInterno();

  const [usuarios, clinicas, profissionais] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: [{ papel: "asc" }, { nome: "asc" }],
      include: {
        clinica: { select: { nome: true } },
        profissional: { select: { nome: true } },
      },
    }),
    prisma.clinica.findMany({ where: { ativa: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.profissional.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  return (
    <>
      <Titulo>Acessos</Titulo>

      <div className="grid lg:grid-cols-3 gap-3">
        <Cartao className="lg:col-span-2">
          {usuarios.length === 0 ? (
            <Vazio>Nenhum acesso criado.</Vazio>
          ) : (
            <Tabela cabecalho={["Nome", "E-mail", "Nível", "Vínculo", "Criado em"]}>
              {usuarios.map((usuario) => (
                <tr key={usuario.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-3 font-semibold text-bordo">{usuario.nome}</td>
                  <td className="py-2 pr-3 text-gray-500">{usuario.email}</td>
                  <td className="py-2 pr-3">{ROTULO_PAPEL[usuario.papel]}</td>
                  <td className="py-2 pr-3 text-gray-500">
                    {usuario.clinica?.nome ?? usuario.profissional?.nome ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-gray-400">{formatarData(usuario.criadoEm)}</td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>

        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-3">Novo acesso</div>
          <FormularioAcao acao={criarAcesso} botao="Criar acesso">
            <div>
              <Rotulo>Nome</Rotulo>
              <Campo name="nome" required />
            </div>
            <div>
              <Rotulo>E-mail</Rotulo>
              <Campo name="email" type="email" required />
            </div>
            <div>
              <Rotulo>Senha inicial</Rotulo>
              <Campo name="senha" type="password" minLength={8} required />
            </div>
            <div>
              <Rotulo>Nível</Rotulo>
              <Selecao name="papel" defaultValue="CLINICA">
                <option value="INTERNO">Equipe Hemoderi</option>
                <option value="CLINICA">Clínica contratante</option>
                <option value="PROFISSIONAL">Profissional</option>
              </Selecao>
            </div>
            <div>
              <Rotulo>Vínculo (clínica ou profissional)</Rotulo>
              <Selecao name="vinculoId" defaultValue="">
                <option value="">— para acesso interno —</option>
                <optgroup label="Clínicas">
                  {clinicas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Profissionais">
                  {profissionais.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </optgroup>
              </Selecao>
              <div className="text-[10px] text-gray-400 mt-1">
                O vínculo define o escopo inteiro da conta: a clínica só vê os pedidos dela, o
                profissional só vê a agenda dele.
              </div>
            </div>
          </FormularioAcao>
        </Cartao>
      </div>
    </>
  );
}
