"use client";

import { Campo, Rotulo, Selecao } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { salvarTabela } from "@/app/actions/tabelas";
import { ROTULO_PERFIL_CLIENTE, TODOS_OS_PERFIS } from "@/lib/visibilidade";

type Tabela = { id: string; nome: string; descricao: string | null; perfil: string | null };

/**
 * Cria ou edita uma tabela de preço. Na criação, "copiar preços de" parte de
 * uma tabela existente — como "Cursos" nasce de "Consultório particular" com
 * poucos ajustes, sem redigitar o catálogo inteiro.
 */
export function FormularioTabela({
  tabela,
  tabelasParaCopiar = [],
}: {
  tabela?: Tabela;
  tabelasParaCopiar?: { id: string; nome: string }[];
}) {
  return (
    <FormularioAcao
      acao={salvarTabela}
      botao={tabela ? "Salvar alterações" : "Criar tabela"}
      limparAoSalvar={!tabela}
    >
      {tabela && <input type="hidden" name="id" value={tabela.id} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Rotulo>Nome da tabela</Rotulo>
          <Campo name="nome" required defaultValue={tabela?.nome ?? ""} placeholder="Consultório particular, Cursos, Mandic…" />
        </div>
        <div>
          <Rotulo>Pensada para o perfil</Rotulo>
          <Selecao name="perfil" defaultValue={tabela?.perfil ?? ""}>
            <option value="">— qualquer —</option>
            {TODOS_OS_PERFIS.map((perfil) => (
              <option key={perfil} value={perfil}>
                {ROTULO_PERFIL_CLIENTE[perfil]}
              </option>
            ))}
          </Selecao>
        </div>
      </div>
      <div>
        <Rotulo>Descrição (opcional)</Rotulo>
        <Campo name="descricao" defaultValue={tabela?.descricao ?? ""} />
      </div>
      {!tabela && tabelasParaCopiar.length > 0 && (
        <div>
          <Rotulo>Copiar os preços de</Rotulo>
          <Selecao name="copiarDeId" defaultValue="">
            <option value="">Começar vazia</option>
            {tabelasParaCopiar.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </Selecao>
        </div>
      )}
    </FormularioAcao>
  );
}
