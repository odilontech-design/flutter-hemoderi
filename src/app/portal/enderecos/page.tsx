import Link from "next/link";
import { exigirClinica } from "@/lib/sessao";
import { locaisDaClinica } from "@/lib/endereco";
import { Cartao, Titulo } from "@/components/ui";
import { NovoEndereco } from "./NovoEndereco";
import { RemoverEndereco } from "./RemoverEndereco";

export const dynamic = "force-dynamic";

/**
 * Endereços de atendimento (ata de 01/10): a clínica que atende em mais de um
 * lugar cadastra todos e escolhe o de cada agendamento — como num aplicativo
 * de entrega. O principal é o do cadastro e só a equipe altera.
 */
export default async function Enderecos() {
  const sessao = await exigirClinica();
  const locais = await locaisDaClinica(sessao.clinicaId);

  return (
    <>
      <Titulo
        acao={
          <Link
            href="/portal/agendar"
            className="bg-bordo text-white text-xs font-semibold px-3 py-2 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-lg hover:bg-bordoEscuro"
          >
            + Agendar atendimento
          </Link>
        }
      >
        Meus endereços
      </Titulo>

      <Cartao className="mb-3">
        <div className="font-display font-bold text-bordo text-sm mb-3">Onde atendemos você</div>
        {locais.length === 0 ? (
          <div className="text-xs text-gray-500">Nenhum endereço cadastrado ainda.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {locais.map((local) => (
              <li key={local.id || "principal"} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-bordo">{local.rotulo}</div>
                  <div className="text-[11px] text-gray-600 mt-0.5">{local.resumo || "—"}</div>
                </div>
                {local.id ? (
                  <RemoverEndereco id={local.id} rotulo={local.rotulo} />
                ) : (
                  <span className="text-[10px] text-gray-400 shrink-0 py-2">cadastro principal</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Cartao className="max-w-2xl">
        <div className="font-display font-bold text-bordo text-sm mb-3">Adicionar endereço</div>
        <NovoEndereco />
      </Cartao>
    </>
  );
}
