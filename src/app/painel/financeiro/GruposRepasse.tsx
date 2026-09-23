"use client";

import { useState } from "react";
import { salvarGrupoRepasse, excluirGrupoRepasse } from "@/app/actions/financeiro";
import { FormularioAcao } from "@/components/FormularioAcao";
import { BotaoAcao } from "@/components/BotaoAcao";
import { Botao, Campo, Cartao, Rotulo, Tabela, Vazio } from "@/components/ui";
import { formatarPercent, formatarReais } from "@/lib/dinheiro";

type Grupo = {
  id: string;
  nome: string;
  percent: number | null;
  fixoCentavos: number | null;
  _count: { profissionais: number };
};

function centavosParaTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

/** Uma linha de grupo, editável do mesmo jeito que o catálogo e os profissionais. */
function LinhaGrupo({ grupo }: { grupo: Grupo }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <tr className="border-b border-gray-100 last:border-0">
        <td className="py-2 pr-3 font-semibold text-bordo">{grupo.nome}</td>
        <td className="py-2 pr-3">
          {grupo.fixoCentavos != null ? (
            formatarReais(grupo.fixoCentavos)
          ) : grupo.percent != null ? (
            formatarPercent(grupo.percent)
          ) : (
            <span className="text-gray-400">sem regra</span>
          )}
        </td>
        <td className="py-2 pr-3 text-gray-500">{grupo._count.profissionais}</td>
        <td className="py-2">
          <div className="flex flex-wrap gap-1.5 whitespace-nowrap">
            <Botao variante="secundario" onClick={() => setAberto((v) => !v)}>
              {aberto ? "Fechar" : "Editar"}
            </Botao>
            <BotaoAcao
              acao={excluirGrupoRepasse.bind(null, grupo.id)}
              variante="perigo"
              confirmar={
                grupo._count.profissionais > 0
                  ? `Excluir "${grupo.nome}"? ${grupo._count.profissionais} profissional(is) volta(m) a usar o percentual/fixo próprio ou o padrão da operação.`
                  : `Excluir "${grupo.nome}"?`
              }
            >
              Excluir
            </BotaoAcao>
          </div>
        </td>
      </tr>
      {aberto && (
        <tr className="border-b border-gray-100 last:border-0 bg-bege/40">
          <td colSpan={4} className="py-4 px-3">
            <FormularioAcao acao={salvarGrupoRepasse} botao="Salvar grupo" limparAoSalvar={false}>
              <input type="hidden" name="id" value={grupo.id} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Rotulo>Nome</Rotulo>
                  <Campo name="nome" defaultValue={grupo.nome} required />
                </div>
                <div>
                  <Rotulo>Percentual (%)</Rotulo>
                  <Campo name="percent" inputMode="decimal" placeholder="65" defaultValue={grupo.percent ?? ""} />
                </div>
                <div>
                  <Rotulo>Valor fixo (R$)</Rotulo>
                  <Campo
                    name="fixoCentavos"
                    inputMode="decimal"
                    placeholder="150,00"
                    defaultValue={grupo.fixoCentavos != null ? centavosParaTexto(grupo.fixoCentavos) : ""}
                  />
                </div>
              </div>
              <div className="text-[10px] text-gray-400">
                Valor fixo vence percentual quando os dois estão preenchidos.
              </div>
            </FormularioAcao>
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Grupos de repasse — a categorização por região (e, mais adiante, o que a
 * operação decidir) que a ata de 21/09 pediu. Um grupo só entra na conta de
 * um profissional quando ele não tem percentual nem valor fixo próprio — a
 * cadeia inteira está em lib/repasse.ts.
 */
export function GruposRepasse({ grupos }: { grupos: Grupo[] }) {
  return (
    <Cartao>
      <div className="font-display font-bold text-bordo text-sm mb-1">Grupos de repasse</div>
      <div className="text-[11px] text-gray-500 mb-3">
        Um degrau coletivo — região hoje, outro critério amanhã — entre o percentual do
        profissional e o padrão da operação. Atribua um grupo a cada profissional no cadastro dele.
      </div>

      {grupos.length === 0 ? (
        <Vazio>Nenhum grupo criado ainda.</Vazio>
      ) : (
        <Tabela cabecalho={["Grupo", "Repasse", "Profissionais", "Ações"]}>
          {grupos.map((g) => (
            <LinhaGrupo key={g.id} grupo={g} />
          ))}
        </Tabela>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="font-display font-bold text-bordo text-xs mb-2">Novo grupo</div>
        <FormularioAcao acao={salvarGrupoRepasse} botao="Criar grupo">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Rotulo>Nome</Rotulo>
              <Campo name="nome" placeholder="São Paulo" required />
            </div>
            <div>
              <Rotulo>Percentual (%)</Rotulo>
              <Campo name="percent" inputMode="decimal" placeholder="65" />
            </div>
            <div>
              <Rotulo>Valor fixo (R$)</Rotulo>
              <Campo name="fixoCentavos" inputMode="decimal" placeholder="150,00" />
            </div>
          </div>
        </FormularioAcao>
      </div>
    </Cartao>
  );
}
