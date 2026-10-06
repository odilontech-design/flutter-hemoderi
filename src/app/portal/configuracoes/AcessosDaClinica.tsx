"use client";

import { useFormState } from "react-dom";
import { Aviso, Botao, Campo, Rotulo } from "@/components/ui";
import { BotaoAcao } from "@/components/BotaoAcao";
import { BotaoCredencial } from "@/components/BotaoCredencial";
import { Credencial } from "@/components/Credencial";
import {
  adicionarPessoaComAcesso,
  alternarAcessoDeColega,
  redefinirSenhaDeColega,
  type ResultadoConfiguracao,
} from "@/app/actions/configuracoes";

const INICIAL: ResultadoConfiguracao = { ok: false };

export type PessoaComAcesso = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  senhaProvisoria: boolean;
  titular: boolean;
  voce: boolean;
};

/**
 * Quem entra no portal desta clínica. O titular (acesso mais antigo) adiciona
 * colegas — a senha provisória aparece uma vez, na tela dele — e suspende ou
 * redefine o acesso deles. Os demais só enxergam a lista.
 */
export function AcessosDaClinica({ pessoas, podeGerenciar }: { pessoas: PessoaComAcesso[]; podeGerenciar: boolean }) {
  const [estado, enviar] = useFormState(adicionarPessoaComAcesso, INICIAL);

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-gray-100">
        {pessoas.map((p) => (
          <li key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-gray-800">
                {p.nome}
                {p.voce && <span className="ml-1.5 text-[10px] font-normal text-gray-400">(você)</span>}
                {p.titular && (
                  <span className="ml-1.5 text-[10px] font-semibold text-bordo bg-bordo/10 rounded-full px-2 py-0.5">
                    titular
                  </span>
                )}
                {!p.ativo && (
                  <span className="ml-1.5 text-[10px] font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                    suspenso
                  </span>
                )}
              </div>
              <div className="text-[11px] text-gray-500 break-all">{p.email}</div>
              {p.senhaProvisoria && p.ativo && (
                <div className="text-[10px] text-amber-700">ainda não entrou: senha provisória pendente</div>
              )}
            </div>
            {podeGerenciar && !p.voce && (
              <div className="flex flex-wrap items-center gap-2">
                {p.ativo && (
                  <BotaoCredencial
                    acao={redefinirSenhaDeColega.bind(null, p.id)}
                    confirmar={`Sortear uma senha nova para ${p.nome}? A atual deixa de valer.`}
                  >
                    Redefinir senha
                  </BotaoCredencial>
                )}
                <BotaoAcao
                  acao={alternarAcessoDeColega.bind(null, p.id, !p.ativo)}
                  variante={p.ativo ? "perigo" : "secundario"}
                  confirmar={p.ativo ? `Suspender o acesso de ${p.nome}? Ele(a) deixa de entrar na hora.` : undefined}
                >
                  {p.ativo ? "Suspender" : "Reativar"}
                </BotaoAcao>
              </div>
            )}
          </li>
        ))}
      </ul>

      {podeGerenciar ? (
        <form action={enviar} className="rounded-xl border border-gray-200 p-3 space-y-3">
          <div className="text-xs font-semibold text-bordo">Dar acesso a outra pessoa da clínica</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Rotulo>Nome</Rotulo>
              <Campo name="nome" required />
            </div>
            <div>
              <Rotulo>E-mail (é o login)</Rotulo>
              <Campo name="email" type="email" required />
            </div>
          </div>
          <div className="text-[10px] text-gray-400 leading-relaxed">
            O sistema sorteia uma senha provisória e mostra aqui uma vez só. A pessoa é obrigada a escolher a dela
            na primeira entrada. Quem recebe acesso vê e agenda tudo da clínica.
          </div>
          {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
          <Botao type="submit">Criar acesso</Botao>
          {estado.ok && estado.credencial && <Credencial credencial={estado.credencial} />}
        </form>
      ) : (
        <div className="text-[11px] text-gray-500">
          Só o titular da clínica adiciona ou suspende acessos. Precisa de ajuda? Fale com a central.
        </div>
      )}
    </div>
  );
}
