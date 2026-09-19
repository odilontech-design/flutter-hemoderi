import { prisma } from "@/lib/prisma";
import { linkWhatsapp } from "@/lib/whatsapp-link";

/**
 * A saída para a central, no portal da clínica e no do profissional.
 *
 * Existe porque a operação real não cabe inteira no portal: urgência de
 * menos de 24h, clínica que ainda não aderiu, dúvida que ninguém previu. Sem
 * um caminho visível, essas conversas acontecem no WhatsApp pessoal de quem
 * estiver por perto — e somem do registro da operação.
 *
 * Não aparece no painel da equipe: a central é a própria equipe, e um botão
 * de WhatsApp ali seria a Hemoderi ligando para si mesma.
 *
 * É componente de servidor: o número vem dos parâmetros da operação, muda
 * sem deploy, e não existindo número o botão simplesmente não aparece (em vez
 * de abrir uma conversa com ninguém).
 */
export async function BotaoWhatsapp({ contexto }: { contexto?: string }) {
  const config = await prisma.parametros.findUnique({
    where: { id: "hemoderi" },
    select: { whatsapp: true },
  });

  const url = linkWhatsapp(
    config?.whatsapp,
    contexto ? `Olá! Falo pelo ${contexto} e preciso de ajuda.` : "Olá! Preciso de ajuda com um agendamento."
  );
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      // Acima do conteúdo e fora do caminho do polegar no celular: canto
      // inferior direito é onde a mão já está, e é onde todo mundo procura.
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-[#1EA952] text-white
        rounded-full shadow-lg pl-4 pr-5 py-3 text-sm font-semibold
        hover:bg-[#178943] active:scale-95 transition-all
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1EA952]"
      aria-label="Falar com a central pelo WhatsApp"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z" />
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24a8.18 8.18 0 0 1 5.82 2.42 8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.69 8.23-8.24 8.23z" />
      </svg>
      Central
    </a>
  );
}
