import { qrCodeDataUri, urlDeDivulgacao } from "@/lib/divulgacao";
import { Cartao } from "@/components/ui";
import { CopiarLink } from "@/components/CopiarLink";

/**
 * O material de divulgação da clínica: link curto e, quando pedido, QR Code
 * pronto para imprimir.
 *
 * A ata de 21/09 tirou o QR Code da página do cliente (`mostrarQrCode=false`
 * em /portal) — o link continua ali, só a imagem some. A equipe, na tela
 * interna da clínica, continua vendo os dois: é ela quem imprime material
 * para o balcão.
 */
export async function CartaoDivulgacao({
  slug,
  nome,
  mostrarQrCode = true,
}: {
  slug: string;
  nome: string;
  mostrarQrCode?: boolean;
}) {
  const url = urlDeDivulgacao(slug);
  const qr = mostrarQrCode ? await qrCodeDataUri(url) : null;

  return (
    <Cartao>
      <div className="font-display font-bold text-bordo text-sm mb-1">Divulgação</div>
      <div className="text-[11px] text-gray-500 mb-4">
        Link {qr ? "e QR Code " : ""}de {nome} para agendar direto no portal.
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt={`QR Code de agendamento de ${nome}`}
            className="w-36 h-36 border border-gray-200 rounded-xl shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-gray-500 mb-1">Link</div>
          <code className="block text-xs text-bordo break-all mb-3">{url}</code>
          <CopiarLink url={url} />
          <div className="text-[10px] text-gray-400 mt-3">
            Quem abrir sem estar logado passa pelo login e cai direto na tela de agendamento.
          </div>
        </div>
      </div>
    </Cartao>
  );
}
