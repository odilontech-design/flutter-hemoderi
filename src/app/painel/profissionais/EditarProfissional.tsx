"use client";

import { useState } from "react";
import { salvarProfissional, alternarProfissional } from "@/app/actions/cadastros";
import { FormularioAcao } from "@/components/FormularioAcao";
import { BotaoAcao } from "@/components/BotaoAcao";
import { Botao, Campo, OCULTO_MOVEL, Rotulo, Selecao } from "@/components/ui";
import { AcoesDeAcesso, SituacaoAcesso } from "@/components/AcessoDoCadastro";
import { CampoDocumento } from "@/components/CampoDocumento";
import { formatarPercent, formatarReais } from "@/lib/dinheiro";
import { estrelas, formatarMedia } from "@/lib/avaliacao";

type Profissional = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  conselho: string | null;
  registro: string | null;
  especialidade: string | null;
  chavePix: string | null;
  googleAgendaId: string | null;
  uf: string | null;
  grupoRepasseId: string | null;
  repassePercentPadrao: number | null;
  repasseFixoCentavos: number | null;
  ativo: boolean;
  _count: { pedidos: number; disponibilidades: number };
  usuarios: { id: string; desativadoEm: Date | null; senhaProvisoria: boolean }[];
};

/** Centavos → texto editável ("1234,56"), o mesmo formato do catálogo. */
function centavosParaTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

/**
 * Uma linha do cadastro de profissionais, com edição de todo campo — mesmo
 * padrão do catálogo (EditarServico): fechada é a linha compacta de sempre,
 * aberta vira um formulário completo, porque corrigir um cadastro é tão
 * comum quanto criar um novo e não merece uma tela à parte.
 */
export function EditarProfissional({
  profissional,
  notaMedia,
  notaQtd,
  gruposRepasse,
}: {
  profissional: Profissional;
  notaMedia: number | null;
  notaQtd: number;
  gruposRepasse: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <tr className="border-b border-gray-100 last:border-0 align-top">
        <td className="py-2 pr-3">
          <div className="font-semibold text-bordo">{profissional.nome}</div>
          <div className="text-[10px] text-gray-400">
            {profissional.especialidade ?? profissional.telefone ?? "—"}
            {profissional.uf && ` · ${profissional.uf}`}
          </div>
        </td>
        <td className={`py-2 pr-3 text-gray-500 ${OCULTO_MOVEL}`}>
          {profissional.conselho ? `${profissional.conselho} ${profissional.registro ?? ""}` : "—"}
        </td>
        <td className={`py-2 pr-3 whitespace-nowrap ${OCULTO_MOVEL}`}>
          {profissional.repasseFixoCentavos != null ? (
            formatarReais(profissional.repasseFixoCentavos)
          ) : profissional.repassePercentPadrao != null ? (
            formatarPercent(profissional.repassePercentPadrao)
          ) : (
            <span className="text-gray-400">padrão</span>
          )}
        </td>
        <td className={`py-2 pr-3 whitespace-nowrap ${OCULTO_MOVEL}`}>
          {notaMedia === null ? (
            <span className="text-gray-300">sem avaliação</span>
          ) : (
            <>
              <span className="text-amber-500">{estrelas(notaMedia)}</span>
              <div className="text-[10px] text-gray-400">
                {formatarMedia(notaMedia)} em {notaQtd}
              </div>
            </>
          )}
        </td>
        <td className={`py-2 pr-3 ${OCULTO_MOVEL}`}>
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
            <Botao variante="secundario" onClick={() => setAberto((v) => !v)}>
              {aberto ? "Fechar" : "Editar"}
            </Botao>
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

      {aberto && (
        <tr className="border-b border-gray-100 last:border-0 bg-bege/40">
          <td colSpan={7} className="py-4 px-3">
            <FormularioAcao acao={salvarProfissional} botao="Salvar alterações" limparAoSalvar={false}>
              <input type="hidden" name="id" value={profissional.id} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Rotulo>Nome</Rotulo>
                  <Campo name="nome" defaultValue={profissional.nome} required />
                </div>
                <CampoDocumento tipo="cpf" name="cpf" rotulo="CPF" inicial={profissional.cpf ?? ""} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Rotulo>Telefone</Rotulo>
                  <Campo name="telefone" defaultValue={profissional.telefone ?? ""} />
                </div>
                <div>
                  <Rotulo>E-mail</Rotulo>
                  <Campo name="email" type="email" defaultValue={profissional.email ?? ""} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Rotulo>Conselho</Rotulo>
                  <Campo name="conselho" placeholder="COREN-SP" defaultValue={profissional.conselho ?? ""} />
                </div>
                <div>
                  <Rotulo>Registro</Rotulo>
                  <Campo name="registro" defaultValue={profissional.registro ?? ""} />
                </div>
              </div>
              <div>
                <Rotulo>Especialidade</Rotulo>
                <Campo name="especialidade" defaultValue={profissional.especialidade ?? ""} />
              </div>
              <div>
                <Rotulo>Agenda do Google</Rotulo>
                <Campo
                  name="googleAgendaId"
                  type="email"
                  placeholder="profissional@gmail.com"
                  defaultValue={profissional.googleAgendaId ?? ""}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Rotulo>Chave PIX</Rotulo>
                  <Campo name="chavePix" defaultValue={profissional.chavePix ?? ""} />
                </div>
                <div>
                  <Rotulo>Repasse por atendimento (R$)</Rotulo>
                  <Campo
                    name="repasseFixoCentavos"
                    placeholder="150,00"
                    inputMode="decimal"
                    defaultValue={
                      profissional.repasseFixoCentavos != null
                        ? centavosParaTexto(profissional.repasseFixoCentavos)
                        : ""
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Rotulo>UF (onde atende)</Rotulo>
                  <Campo name="uf" placeholder="SP" maxLength={2} defaultValue={profissional.uf ?? ""} />
                  <div className="text-[10px] text-gray-400 mt-1">
                    Decide a régua de repasse quando ele está num grupo por região.
                  </div>
                </div>
                <div>
                  <Rotulo>Grupo de repasse</Rotulo>
                  <Selecao name="grupoRepasseId" defaultValue={profissional.grupoRepasseId ?? ""}>
                    <option value="">Nenhum — só o percentual/fixo acima</option>
                    {gruposRepasse.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nome}
                      </option>
                    ))}
                  </Selecao>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Só vale quando o profissional não tem percentual nem valor fixo próprio acima.
                  </div>
                </div>
              </div>
            </FormularioAcao>
          </td>
        </tr>
      )}
    </>
  );
}
