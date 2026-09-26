import Link from "next/link";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { NovoEquipamentoForm } from "./NovoEquipamentoForm";

export const dynamic = "force-dynamic";

export default async function NovoEquipamento() {
  await exigirInterno();

  return (
    <>
      <Titulo
        acao={
          <Link href="/painel/catalogo" className="text-[11px] font-semibold text-bordo hover:underline">
            ← voltar para o catálogo
          </Link>
        }
      >
        Novo equipamento
      </Titulo>
      <Cartao className="max-w-2xl">
        <NovoEquipamentoForm />
      </Cartao>
    </>
  );
}
