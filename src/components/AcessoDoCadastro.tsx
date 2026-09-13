import Link from "next/link";
import { BotaoCredencial } from "@/components/BotaoCredencial";
import { gerarAcessoDoCadastro, redefinirSenha } from "@/app/actions/acessos";

export type AcessoResumido = { id: string; desativadoEm: Date | null; senhaProvisoria: boolean };

/**
 * A coluna de acesso das listas de clínicas e de profissionais.
 *
 * Vive aqui, e não duplicada nas duas telas, porque as regras são as mesmas e
 * divergir seria o tipo de diferença que ninguém nota até a operação
 * perguntar por que a clínica mostra uma coisa e o profissional outra.
 *
 * O caso de mais de um acesso no mesmo cadastro (a clínica com duas
 * recepcionistas) é tratado explicitamente: a lista de cadastro não tenta
 * administrar os dois, aponta para /painel/acessos, que é a tela feita para
 * isso. Escolher "o primeiro" e escondê-lo atrás de um botão de redefinir
 * senha seria redefinir a senha de quem a tela nem mostrou qual é.
 */
export function SituacaoAcesso({ acessos }: { acessos: AcessoResumido[] }) {
  if (acessos.length === 0) {
    return <span className="text-[10px] font-semibold text-amber-700">sem acesso</span>;
  }
  if (acessos.length > 1) {
    const ativos = acessos.filter((a) => !a.desativadoEm).length;
    return (
      <span className="text-[10px] font-semibold text-gray-600">
        {acessos.length} acessos · {ativos} ativo(s)
      </span>
    );
  }
  const acesso = acessos[0];
  if (acesso.desativadoEm) return <span className="text-[10px] font-semibold text-red-600">suspenso</span>;
  if (acesso.senhaProvisoria) {
    return <span className="text-[10px] font-semibold text-amber-700">senha provisória</span>;
  }
  return <span className="text-[10px] font-semibold text-green-700">ativo</span>;
}

export function AcoesDeAcesso({
  tipo,
  cadastroId,
  nome,
  acessos,
}: {
  tipo: "clinica" | "profissional";
  cadastroId: string;
  nome: string;
  acessos: AcessoResumido[];
}) {
  if (acessos.length > 1) {
    return (
      <Link href="/painel/acessos" className="text-[11px] font-semibold text-bordo hover:underline">
        Ver acessos
      </Link>
    );
  }
  if (acessos.length === 0) {
    return (
      <BotaoCredencial variante="primario" acao={gerarAcessoDoCadastro.bind(null, tipo, cadastroId)}>
        Gerar acesso
      </BotaoCredencial>
    );
  }
  return (
    <BotaoCredencial
      acao={redefinirSenha.bind(null, acessos[0].id)}
      confirmar={`Gerar uma senha nova para ${nome}? A senha atual para de funcionar imediatamente.`}
    >
      Redefinir senha
    </BotaoCredencial>
  );
}
