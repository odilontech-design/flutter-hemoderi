import { redirect } from "next/navigation";
import { exigirClinica, exigirInterno, sessaoAtual } from "@/lib/sessao";

/**
 * Quem vê o recibo: a clínica, só o que é dela, ou a equipe interna, de
 * qualquer clínica. Devolve o filtro de clínica (null = sem restrição) e para
 * onde o "Voltar" leva.
 */
export async function acessoAoRecibo(): Promise<{ clinicaId: string | null; voltar: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/login");
  if (sessao.papel === "INTERNO") {
    await exigirInterno();
    return { clinicaId: null, voltar: "/painel/pedidos" };
  }
  const clinica = await exigirClinica();
  return { clinicaId: clinica.clinicaId, voltar: "/portal" };
}
