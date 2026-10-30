import { parametros } from "@/lib/alocacao";
import { reciboDaFatura } from "@/lib/recibo-dados";
import { Recibo } from "../../Recibo";
import { acessoAoRecibo } from "../../acesso";
import { SemRecibo } from "../../SemRecibo";

export const dynamic = "force-dynamic";

export default async function ReciboDaFatura({ params }: { params: { id: string } }) {
  const { clinicaId, voltar } = await acessoAoRecibo();
  const [resultado, config] = await Promise.all([reciboDaFatura(params.id, clinicaId), parametros()]);
  if (!resultado.ok) return <SemRecibo mensagem={resultado.erro} voltar={voltar} />;
  return <Recibo recibo={resultado.recibo} cnpj={config.cnpj} voltar={voltar} />;
}
