import Link from "next/link";
import { exigirResponsavel } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { ImportarCrm } from "./ImportarCrm";

export const dynamic = "force-dynamic";
// 2.600 clínicas e 2.600 pessoas gravadas numa transação só: com folga.
export const maxDuration = 60;

export default async function ImportarCrmPagina() {
  await exigirResponsavel();

  return (
    <>
      <Titulo
        acao={
          <Link href="/painel/clinicas" className="text-xs font-semibold text-bordo hover:underline">
            ← Voltar para clínicas
          </Link>
        }
      >
        Importar base do CRM
      </Titulo>

      <Cartao className="max-w-2xl">
        <div className="text-xs text-gray-600 leading-relaxed space-y-2 mb-4">
          <p>
            Envie as duas exportações do PipeDrive (<strong>organizações</strong> e <strong>pessoas</strong>, em CSV).
            Cada organização vira um <strong>pré-cadastro</strong> de cliente e cada pessoa fica ligada à sua clínica.
            Pessoa sem organização vira um pré-cadastro de profissional avulso.
          </p>
          <p>
            Nenhum acesso é criado e nenhum pré-cadastro aparece na agenda, nos pedidos nem nas pesquisas: eles
            ficam na aba <strong>Pré-cadastros</strong> de Clínicas, de onde a equipe ativa o cliente quando ele aparece.
            Dá para importar de novo: o que já entrou não é duplicado nem sobrescrito.
          </p>
        </div>
        <ImportarCrm />
      </Cartao>
    </>
  );
}
