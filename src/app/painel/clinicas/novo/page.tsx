import Link from "next/link";
import { exigirInterno } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { NovaClinicaForm } from "./NovaClinicaForm";

export const dynamic = "force-dynamic";

export default async function NovaClinica({ searchParams }: { searchParams: { agendar?: string } }) {
  await exigirInterno();
  const paraAgendar = searchParams.agendar === "1";

  return (
    <>
      <Titulo
        acao={
          <Link
            href={paraAgendar ? "/painel/pedidos/novo" : "/painel/clinicas"}
            className="text-[11px] font-semibold text-bordo hover:underline"
          >
            {paraAgendar ? "← voltar para o agendamento" : "← voltar para clínicas"}
          </Link>
        }
      >
        Nova clínica
      </Titulo>
      <Cartao className="max-w-2xl">
        <NovaClinicaForm paraAgendar={paraAgendar} />
      </Cartao>
    </>
  );
}
