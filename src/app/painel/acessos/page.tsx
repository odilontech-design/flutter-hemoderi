import Link from "next/link";
import type { PapelUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirResponsavel } from "@/lib/sessao";
import { Cartao, Kpi, OCULTO_MOVEL, Tabela, Titulo, Vazio } from "@/components/ui";
import { BotaoAcao } from "@/components/BotaoAcao";
import { BotaoCredencial } from "@/components/BotaoCredencial";
import { alternarAcesso, redefinirSenha } from "@/app/actions/acessos";
import { ROTULO_PAPEL, perfilEfetivo } from "@/lib/papeis";
import { formatarData } from "@/lib/data";
import { type Vinculo } from "./NovoAcesso";
import { SeletorPerfil } from "./SeletorPerfil";

export const dynamic = "force-dynamic";

const NIVEIS: { chave: string; rotulo: string; papel?: PapelUsuario }[] = [
  { chave: "todos", rotulo: "Todos" },
  { chave: "interno", rotulo: ROTULO_PAPEL.INTERNO, papel: "INTERNO" },
  { chave: "clinica", rotulo: ROTULO_PAPEL.CLINICA, papel: "CLINICA" },
  { chave: "profissional", rotulo: ROTULO_PAPEL.PROFISSIONAL, papel: "PROFISSIONAL" },
];

/**
 * Gestão de acesso da operação.
 *
 * Responde as quatro perguntas que a equipe faz de verdade: quem entra, quem
 * não entra mais, quem ainda está com a senha que a equipe sorteou, e quais
 * cadastros existem sem nenhum acesso — que é o buraco silencioso, o
 * profissional cadastrado há duas semanas que nunca conseguiu ver a agenda
 * dele.
 *
 * O filtro por nível existe porque a lista mistura três públicos bem
 * diferentes (equipe, clínica, profissional) na mesma tabela — em uma
 * operação com dezenas de clínicas e profissionais, achar as poucas contas
 * da equipe interna no meio delas vira busca visual. Os KPIs do topo ficam
 * de fora do filtro de propósito: são visão geral da operação, não do
 * recorte que a pessoa está olhando agora.
 */
export default async function Acessos({ searchParams }: { searchParams: { nivel?: string } }) {
  const sessao = await exigirResponsavel();

  const nivel = NIVEIS.find((n) => n.chave === searchParams.nivel) ?? NIVEIS[0];

  const [usuarios, clinicas, profissionais] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: [{ desativadoEm: "asc" }, { papel: "asc" }, { nome: "asc" }],
      include: {
        clinica: { select: { nome: true, ativa: true } },
        profissional: { select: { nome: true, ativo: true } },
      },
    }),
    prisma.clinica.findMany({
      where: { ativa: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, email: true, usuarios: { select: { id: true }, take: 1 } },
    }),
    prisma.profissional.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, email: true, usuarios: { select: { id: true }, take: 1 } },
    }),
  ]);

  const paraVinculo = (c: { id: string; nome: string; email: string | null; usuarios: { id: string }[] }): Vinculo => ({
    id: c.id,
    nome: c.nome,
    email: c.email,
    temAcesso: c.usuarios.length > 0,
  });

  const listaClinicas = clinicas.map(paraVinculo);
  const listaProfissionais = profissionais.map(paraVinculo);

  const ativos = usuarios.filter((u) => !u.desativadoEm);
  const provisorias = ativos.filter((u) => u.senhaProvisoria);
  const semAcesso =
    listaClinicas.filter((c) => !c.temAcesso).length + listaProfissionais.filter((p) => !p.temAcesso).length;

  const usuariosFiltrados = nivel.papel ? usuarios.filter((u) => u.papel === nivel.papel) : usuarios;

  return (
    <>
      <Titulo
        acao={
          <Link
            href="/painel/acessos/novo"
            className="bg-bordo text-white text-xs font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-lg hover:bg-bordoEscuro"
          >
            + Novo acesso
          </Link>
        }
      >
        Acessos
      </Titulo>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Kpi rotulo="Acessos ativos" valor={String(ativos.length)} />
        <Kpi rotulo="Suspensos" valor={String(usuarios.length - ativos.length)} />
        <Kpi
          rotulo="Senha provisória"
          valor={String(provisorias.length)}
          sub={provisorias.length ? "ainda não entraram" : "todos já trocaram"}
        />
        <Kpi
          rotulo="Cadastros sem acesso"
          valor={String(semAcesso)}
          sub={semAcesso ? "clínicas e profissionais ativos" : "todos com acesso"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {NIVEIS.map((n) => {
          const quantos = n.papel ? usuarios.filter((u) => u.papel === n.papel).length : usuarios.length;
          return (
            <Link
              key={n.chave}
              href={`/painel/acessos?nivel=${n.chave}`}
              className={`text-[11px] font-semibold px-3 py-2.5 sm:py-1.5 rounded-full border ${
                n.chave === nivel.chave
                  ? "bg-bordo text-white border-bordo"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {n.rotulo} · {quantos}
            </Link>
          );
        })}
      </div>

      <Cartao>
        {usuariosFiltrados.length === 0 ? (
            <Vazio>
              {usuarios.length === 0 ? "Nenhum acesso criado." : `Nenhum acesso em ${nivel.rotulo.toLowerCase()}.`}
            </Vazio>
          ) : (
            <Tabela
              cabecalho={[
                "Pessoa",
                { texto: "Nível", ocultoMovel: true },
                { texto: "Perfil", ocultoMovel: true },
                { texto: "Vínculo", ocultoMovel: true },
                "Situação",
                { texto: "Senha", ocultoMovel: true },
                "Ações",
              ]}
            >
              {usuariosFiltrados.map((usuario) => {
                const ativo = !usuario.desativadoEm;
                const souEu = usuario.id === sessao.usuarioId;
                // Vínculo desativado corta o login mesmo com o acesso ativo:
                // a tela precisa dizer isso, senão a equipe redefine a senha
                // três vezes tentando resolver o que não é senha.
                const vinculoInativo =
                  (usuario.papel === "CLINICA" && usuario.clinica && !usuario.clinica.ativa) ||
                  (usuario.papel === "PROFISSIONAL" && usuario.profissional && !usuario.profissional.ativo);

                return (
                  <tr key={usuario.id} className="border-b border-gray-100 last:border-0 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-bordo">
                        {usuario.nome}
                        {souEu && <span className="ml-1 text-[10px] font-normal text-gray-400">(você)</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 break-all">{usuario.email}</div>
                    </td>
                    <td className={`py-2 pr-3 whitespace-nowrap ${OCULTO_MOVEL}`}>{ROTULO_PAPEL[usuario.papel]}</td>
                    <td className={`py-2 pr-3 whitespace-nowrap ${OCULTO_MOVEL}`}>
                      {usuario.papel !== "INTERNO" ? (
                        "—"
                      ) : (
                        <SeletorPerfil
                          usuarioId={usuario.id}
                          perfilAtual={perfilEfetivo(usuario.perfilInterno)}
                          desabilitado={!ativo}
                        />
                      )}
                    </td>
                    <td className={`py-2 pr-3 text-gray-500 ${OCULTO_MOVEL}`}>
                      {usuario.clinica?.nome ?? usuario.profissional?.nome ?? "—"}
                      {vinculoInativo && (
                        <div className="text-[10px] font-semibold text-amber-700">cadastro desativado</div>
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {ativo ? (
                        <span className="text-[10px] font-semibold text-green-700">Ativo</span>
                      ) : (
                        <span className="text-[10px] font-semibold text-red-600">
                          Suspenso em {formatarData(usuario.desativadoEm!)}
                        </span>
                      )}
                    </td>
                    <td className={`py-2 pr-3 whitespace-nowrap ${OCULTO_MOVEL}`}>
                      {usuario.senhaProvisoria ? (
                        <span className="text-[10px] font-semibold text-amber-700">provisória</span>
                      ) : usuario.senhaTrocadaEm ? (
                        <span className="text-[10px] text-gray-400">
                          trocada em {formatarData(usuario.senhaTrocadaEm)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">própria</span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-nowrap gap-1.5 whitespace-nowrap">
                        <BotaoCredencial
                          acao={redefinirSenha.bind(null, usuario.id)}
                          confirmar={`Gerar uma senha nova para ${usuario.nome}? A senha atual para de funcionar imediatamente.`}
                        >
                          Redefinir senha
                        </BotaoCredencial>
                        {!souEu && (
                          <BotaoAcao
                            acao={alternarAcesso.bind(null, usuario.id, !ativo)}
                            variante={ativo ? "perigo" : "secundario"}
                            confirmar={
                              ativo
                                ? `Suspender o acesso de ${usuario.nome}? A pessoa é desconectada na hora; o cadastro e o histórico continuam.`
                                : undefined
                            }
                          >
                            {ativo ? "Suspender" : "Reativar"}
                          </BotaoAcao>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Tabela>
          )}
      </Cartao>
    </>
  );
}
