import { exigirInterno, exigirProfissional } from "@/lib/sessao";
import { avisosDoPainel, avisosDoProfissional } from "@/lib/avisos-servidor";

// Estado vivo da operação: nunca pré-renderizado nem cacheado.
export const dynamic = "force-dynamic";

/**
 * Os avisos em pop-up de quem está com o sistema aberto. `?area=profissional`
 * devolve os do portal do profissional; sem ele, os do painel da equipe. A
 * guarda de cada área é a mesma das páginas — o pop-up não revela nada que a
 * tela do próprio usuário não mostre.
 *
 * Consulta em vez de conexão viva: a operação muda algumas vezes por hora, e um
 * socket aberto por pessoa custaria mais do que entrega.
 */
export async function GET(requisicao: Request) {
  const area = new URL(requisicao.url).searchParams.get("area");

  if (area === "profissional") {
    const sessao = await exigirProfissional();
    return Response.json({ avisos: await avisosDoProfissional(sessao.profissionalId) });
  }

  const sessao = await exigirInterno();
  return Response.json({ avisos: await avisosDoPainel(sessao.perfil) });
}
