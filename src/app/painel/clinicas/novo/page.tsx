import Link from "next/link";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { NovaClinicaForm } from "./NovaClinicaForm";

export const dynamic = "force-dynamic";

export default async function NovaClinica() {
  await exigirInterno();

  return (
    <>
      <Titulo
        acao={
          <Link href="/painel/clinicas" className="text-[11px] font-semibold text-bordo hover:underline">
            ← voltar para clínicas
          </Link>
        }
      >
        Nova clínica
      </Titulo>
      <Cartao className="max-w-2xl">
        <NovaClinicaForm />
      </Cartao>
    </>
  );
}
