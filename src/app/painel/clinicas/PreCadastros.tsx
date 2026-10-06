import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Cartao, Tabela, Vazio } from "@/components/ui";
import { BotaoAcao } from "@/components/BotaoAcao";
import { ativarPreCadastro } from "@/app/actions/cadastros";

const POR_PAGINA = 40;

/**
 * Os pré-cadastros vindos do CRM (ata de 05/10): clientes que a Hemoderi já
 * tem no PipeDrive e ainda não existem de fato no sistema. Quem tem negócio
 * fechado vem primeiro — é quem tem mais chance de agendar. Ativar um deles o
 * leva para a lista de clientes; o acesso ao portal é gerado à parte.
 */
export async function PreCadastros({
  busca,
  pagina,
  soClientes,
}: {
  busca?: string;
  pagina?: string;
  soClientes: boolean;
}) {
  const termo = (busca ?? "").trim();
  const numeroDaPagina = Math.max(1, Number(pagina) || 1);
  const digitos = termo.replace(/\D/g, "");

  const onde = {
    preCadastro: true,
    ...(soClientes ? { negociosFechadosCrm: { gt: 0 } } : {}),
    ...(termo
      ? {
          OR: [
            { nome: { contains: termo, mode: "insensitive" as const } },
            { cidade: { contains: termo, mode: "insensitive" as const } },
            { pessoas: { some: { pessoa: { nome: { contains: termo, mode: "insensitive" as const } } } } },
            ...(digitos.length >= 4 ? [{ telefone: { contains: digitos.slice(-8) } }] : []),
          ],
        }
      : {}),
  };

  const [total, clinicas] = await Promise.all([
    prisma.clinica.count({ where: onde }),
    prisma.clinica.findMany({
      where: onde,
      orderBy: [{ negociosFechadosCrm: "desc" }, { nome: "asc" }],
      skip: (numeroDaPagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        nome: true,
        tipoCrm: true,
        telefone: true,
        cidade: true,
        uf: true,
        negociosFechadosCrm: true,
        negociosAbertosCrm: true,
        pessoas: { select: { pessoa: { select: { nome: true } } }, take: 6 },
        _count: { select: { pessoas: true } },
      },
    }),
  ]);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const ligacao = (p: number) =>
    `/painel/clinicas?aba=pre&pagina=${p}${termo ? `&busca=${encodeURIComponent(termo)}` : ""}${soClientes ? "&clientes=1" : ""}`;

  return (
    <>
      <form className="flex flex-wrap items-center gap-2 mb-3" action="/painel/clinicas">
        <input type="hidden" name="aba" value="pre" />
        <input
          name="busca"
          defaultValue={termo}
          placeholder="Buscar por clínica, profissional, cidade ou telefone"
          className="flex-1 min-w-[14rem] rounded-lg border border-gray-300 px-3 py-2 text-xs"
        />
        <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <input type="checkbox" name="clientes" value="1" defaultChecked={soClientes} />
          só quem já comprou
        </label>
        <button type="submit" className="bg-bordo text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-bordoEscuro">
          Buscar
        </button>
      </form>

      <Cartao>
        <div className="text-[11px] text-gray-500 mb-3">
          {total} pré-cadastro(s). Eles não aparecem na agenda, nos pedidos nem nas pesquisas até serem ativados.
        </div>
        {clinicas.length === 0 ? (
          <Vazio>Nenhum pré-cadastro encontrado.</Vazio>
        ) : (
          <Tabela cabecalho={["Cliente", "Profissionais", "Cidade", "Negócios", "Ação"]}>
            {clinicas.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 last:border-0 align-top">
                <td className="py-2 pr-3">
                  <Link href={`/painel/clinicas/${c.id}`} className="font-semibold text-bordo hover:underline">
                    {c.nome}
                  </Link>
                  <div className="text-[10px] text-gray-400">
                    {c.tipoCrm ?? "—"} · {c.telefone ?? "sem telefone"}
                  </div>
                </td>
                <td className="py-2 pr-3 text-gray-500 text-[11px]">
                  {c.pessoas.map((x) => x.pessoa.nome).join(", ") || "—"}
                  {c._count.pessoas > c.pessoas.length && ` +${c._count.pessoas - c.pessoas.length}`}
                </td>
                <td className="py-2 pr-3 text-gray-500">
                  {c.cidade ?? "—"}
                  {c.uf ? `/${c.uf}` : ""}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  <span className="font-semibold text-bordo">{c.negociosFechadosCrm}</span>
                  <span className="text-[10px] text-gray-400"> fechados</span>
                  {c.negociosAbertosCrm > 0 && (
                    <div className="text-[10px] text-amber-700">{c.negociosAbertosCrm} em aberto</div>
                  )}
                </td>
                <td className="py-2 whitespace-nowrap">
                  <BotaoAcao acao={ativarPreCadastro.bind(null, c.id)} variante="secundario">
                    Ativar cliente
                  </BotaoAcao>
                </td>
              </tr>
            ))}
          </Tabela>
        )}

        {paginas > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs">
            {numeroDaPagina > 1 ? (
              <Link href={ligacao(numeroDaPagina - 1)} className="font-semibold text-bordo hover:underline">
                ‹ Anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="text-gray-500">
              Página {numeroDaPagina} de {paginas}
            </span>
            {numeroDaPagina < paginas ? (
              <Link href={ligacao(numeroDaPagina + 1)} className="font-semibold text-bordo hover:underline">
                Próxima ›
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </Cartao>
    </>
  );
}
