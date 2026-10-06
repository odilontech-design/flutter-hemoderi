import { prisma } from "@/lib/prisma";
import { exigirClinica } from "@/lib/sessao";
import { Aviso, Cartao, Titulo } from "@/components/ui";
import { camposFaltando } from "@/lib/cadastro-completo";
import { formatarCnpj, formatarCpf } from "@/lib/documento";
import { DadosDaClinica } from "./DadosDaClinica";
import { AcessosDaClinica } from "./AcessosDaClinica";
import { DoutoresDaClinica } from "./DoutoresDaClinica";

export const dynamic = "force-dynamic";

/**
 * Configurações da clínica (pedido de 06/10): a clínica pode ter mais de uma
 * pessoa associada. Três blocos — dados de contato e documento, quem acessa o
 * portal e os doutores que atendem nela.
 */
export default async function Configuracoes() {
  const sessao = await exigirClinica();

  const [clinica, acessos, vinculos] = await Promise.all([
    prisma.clinica.findUnique({
      where: { id: sessao.clinicaId },
      select: { nome: true, cnpj: true, telefone: true, email: true, conselho: true, registroConselho: true },
    }),
    prisma.usuario.findMany({
      where: { clinicaId: sessao.clinicaId, papel: "CLINICA" },
      orderBy: { criadoEm: "asc" },
      select: { id: true, nome: true, email: true, desativadoEm: true, senhaProvisoria: true },
    }),
    prisma.vinculoPessoaClinica.findMany({
      where: { clinicaId: sessao.clinicaId },
      orderBy: { pessoa: { nome: "asc" } },
      select: { pessoa: true },
    }),
  ]);
  if (!clinica) return null;

  // O titular é o acesso ATIVO mais antigo — o mesmo critério das ações.
  const titularId = acessos.find((a) => !a.desativadoEm)?.id ?? null;
  const ehTitular = titularId === sessao.usuarioId;
  const faltando = camposFaltando(clinica);
  const documento = clinica.cnpj ? (clinica.cnpj.replace(/\D/g, "").length === 11 ? formatarCpf(clinica.cnpj) : formatarCnpj(clinica.cnpj)) : "";

  return (
    <>
      <Titulo>Configurações</Titulo>

      {faltando.length > 0 && (
        <div className="mb-4">
          <Aviso tom="alerta">
            <div className="font-semibold mb-0.5">Complete o cadastro para agendar.</div>
            Falta: {faltando.join(", ")}. {ehTitular ? "Preencha abaixo." : "Peça ao titular da clínica para preencher."}
          </Aviso>
        </div>
      )}

      <div className="max-w-3xl space-y-3">
        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-3">Dados da clínica</div>
          <DadosDaClinica
            nome={clinica.nome}
            telefone={clinica.telefone ?? ""}
            email={clinica.email ?? ""}
            cnpj={documento}
            conselho={clinica.conselho ?? ""}
            registroConselho={clinica.registroConselho ?? ""}
            podeEditar={ehTitular}
          />
          {!ehTitular && (
            <div className="text-[11px] text-gray-500 mt-3">
              Só o titular da clínica altera estes dados. Precisa mudar algo? Fale com a central.
            </div>
          )}
        </Cartao>

        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-1">Pessoas com acesso ao portal</div>
          <div className="text-[11px] text-gray-500 mb-3">
            Quem entra com e-mail e senha próprios para ver o catálogo, agendar e acompanhar os atendimentos.
          </div>
          <AcessosDaClinica
            pessoas={acessos.map((a) => ({
              id: a.id,
              nome: a.nome,
              email: a.email,
              ativo: !a.desativadoEm,
              senhaProvisoria: a.senhaProvisoria,
              titular: a.id === titularId,
              voce: a.id === sessao.usuarioId,
            }))}
            podeGerenciar={ehTitular}
          />
        </Cartao>

        <Cartao>
          <div className="font-display font-bold text-bordo text-sm mb-1">Doutores da clínica</div>
          <div className="text-[11px] text-gray-500 mb-3">
            Quem atende nesta clínica. Ao agendar, você escolhe o doutor(a) por esta lista.
          </div>
          <DoutoresDaClinica
            doutores={vinculos.map(({ pessoa }) => ({
              id: pessoa.id,
              nome: pessoa.nome,
              telefone: pessoa.telefone ?? "",
              tipoTelefone: pessoa.tipoTelefone ?? "",
              email: pessoa.email ?? "",
              conselho: pessoa.conselho ?? "",
              registroConselho: pessoa.registroConselho ?? "",
            }))}
          />
        </Cartao>
      </div>
    </>
  );
}
