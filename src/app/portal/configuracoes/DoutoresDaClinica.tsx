"use client";

import { Campo, Rotulo, Selecao } from "@/components/ui";
import { FormularioAcao } from "@/components/FormularioAcao";
import { BotaoAcao } from "@/components/BotaoAcao";
import { removerDoutor, salvarDoutor } from "@/app/actions/configuracoes";
import { CONSELHOS } from "@/lib/conselhos";

export type DoutorDaClinica = {
  id: string;
  nome: string;
  telefone: string;
  tipoTelefone: string;
  email: string;
  conselho: string;
  registroConselho: string;
};

function CamposDoDoutor({ d }: { d?: DoutorDaClinica }) {
  return (
    <>
      {d && <input type="hidden" name="id" value={d.id} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Rotulo>Nome</Rotulo>
          <Campo name="nome" defaultValue={d?.nome ?? ""} required placeholder="Dra. Ana Lima" />
        </div>
        <div>
          <Rotulo>Celular ou telefone</Rotulo>
          <Campo name="telefone" defaultValue={d?.telefone ?? ""} inputMode="tel" placeholder="(11) 99999-9999" />
        </div>
        <div>
          <Rotulo>E-mail (opcional)</Rotulo>
          <Campo name="email" type="email" defaultValue={d?.email ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Rotulo>Conselho</Rotulo>
            <Selecao name="conselho" defaultValue={d?.conselho ?? ""}>
              <option value="">—</option>
              {CONSELHOS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Selecao>
          </div>
          <div>
            <Rotulo>Registro</Rotulo>
            <Campo name="registroConselho" defaultValue={d?.registroConselho ?? ""} />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Os doutores que atendem nesta clínica. A lista alimenta o campo "Doutor(a)
 * responsável" do agendamento — a recepção escolhe em vez de digitar, e o
 * mesmo doutor não vira três grafias diferentes no histórico.
 */
export function DoutoresDaClinica({ doutores }: { doutores: DoutorDaClinica[] }) {
  return (
    <div className="space-y-4">
      {doutores.length === 0 ? (
        <div className="text-xs text-gray-500">Nenhum doutor(a) cadastrado ainda.</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {doutores.map((d) => (
            <li key={d.id} className="py-3">
              <details className="group">
                <summary className="flex cursor-pointer select-none items-center justify-between gap-3 list-none [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-gray-800">{d.nome}</span>
                    <span className="block text-[11px] text-gray-500">
                      {[d.telefone && `${d.telefone}${d.tipoTelefone ? ` (${d.tipoTelefone.toLowerCase()})` : ""}`, d.email, d.conselho && d.registroConselho && `${d.conselho} ${d.registroConselho}`]
                        .filter(Boolean)
                        .join(" · ") || "sem contato cadastrado"}
                    </span>
                  </span>
                  <span className="text-[11px] font-semibold text-bordo group-open:hidden">Editar</span>
                  <span className="text-[11px] font-semibold text-bordo hidden group-open:inline">Fechar</span>
                </summary>
                <div className="mt-3 space-y-3">
                  <FormularioAcao acao={salvarDoutor} botao="Salvar doutor(a)" limparAoSalvar={false}>
                    <CamposDoDoutor d={d} />
                  </FormularioAcao>
                  <BotaoAcao
                    acao={removerDoutor.bind(null, d.id)}
                    variante="perigo"
                    confirmar={`Tirar ${d.nome} da lista desta clínica? O histórico de atendimentos continua.`}
                  >
                    Remover da clínica
                  </BotaoAcao>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-gray-200 p-3">
        <div className="text-xs font-semibold text-bordo mb-3">Adicionar doutor(a)</div>
        <FormularioAcao acao={salvarDoutor} botao="Adicionar doutor(a)">
          <CamposDoDoutor />
        </FormularioAcao>
      </div>
    </div>
  );
}
