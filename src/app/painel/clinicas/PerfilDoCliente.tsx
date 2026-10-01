"use client";

import { FormularioAcao } from "@/components/FormularioAcao";
import { salvarPerfilDaClinica } from "@/app/actions/clientes";
import { ROTULO_PERFIL_CLIENTE, TODOS_OS_PERFIS } from "@/lib/visibilidade";

export type TabelaDisponivel = { id: string; nome: string; perfil: string | null };

/**
 * Perfis e tabelas de preço de um cliente (ata de 01/10).
 *
 * Mais de um de cada é o caso normal, não a exceção: o Edson atende
 * particular e dá curso, e precisa enxergar os dois catálogos com a tabela de
 * cada um. O perfil libera os serviços restritos (ex.: "PRF curso"); a tabela
 * define o preço.
 */
export function PerfilDoCliente({
  clinicaId,
  perfis,
  tabelasLiberadas,
  tabelas,
}: {
  clinicaId: string;
  perfis: string[];
  tabelasLiberadas: string[];
  tabelas: TabelaDisponivel[];
}) {
  return (
    <FormularioAcao acao={salvarPerfilDaClinica} botao="Salvar perfil e tabelas" limparAoSalvar={false}>
      <input type="hidden" name="clinicaId" value={clinicaId} />

      <div>
        <div className="text-[11px] font-semibold text-gray-600 mb-1">Perfis do cliente</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {TODOS_OS_PERFIS.map((perfil) => (
            <label key={perfil} className="flex items-center gap-1.5 text-xs text-gray-700">
              <input type="checkbox" name="perfis" value={perfil} defaultChecked={perfis.includes(perfil)} />
              {ROTULO_PERFIL_CLIENTE[perfil]}
            </label>
          ))}
        </div>
        <div className="text-[10px] text-gray-400 mt-1">
          Decide quais serviços ele enxerga no catálogo. Sem perfil, vê só o que não é restrito.
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold text-gray-600 mb-1">Tabelas de preço liberadas</div>
        {tabelas.length === 0 ? (
          <div className="text-[11px] text-gray-400">Nenhuma tabela criada ainda — crie em Serviços e equipamentos.</div>
        ) : (
          <div className="space-y-1">
            {tabelas.map((tabela) => (
              <label key={tabela.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                <input
                  type="checkbox"
                  name="tabelas"
                  value={tabela.id}
                  defaultChecked={tabelasLiberadas.includes(tabela.id)}
                />
                {tabela.nome}
                {tabela.perfil && perfis.includes(tabela.perfil) && (
                  <span className="text-[10px] font-semibold text-green-700">vale pelo perfil</span>
                )}
                {tabela.perfil && (
                  <span className="text-[10px] text-gray-400">
                    {ROTULO_PERFIL_CLIENTE[tabela.perfil as keyof typeof ROTULO_PERFIL_CLIENTE]}
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
        <div className="text-[10px] text-gray-400 mt-1">
          A tabela pensada para um perfil vale sozinha para quem tem aquele perfil; aqui você libera
          outras à mão. O preço negociado com a clínica continua valendo acima de qualquer tabela. Com
          mais de uma, vale a menor.
        </div>
      </div>
    </FormularioAcao>
  );
}
