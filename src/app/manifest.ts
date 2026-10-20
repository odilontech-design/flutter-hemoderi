import type { MetadataRoute } from "next";

/**
 * O site instalável como app (reunião de 20/10, lançamento oficial): no
 * celular, "Adicionar à tela inicial" abre o Hemoderi em tela cheia, com ícone
 * próprio e sem a barra do navegador — é como a clínica e o profissional usam
 * no dia a dia. Começa na raiz, que já manda cada perfil para a casa dele.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hemoderi",
    short_name: "Hemoderi",
    description: "Agendamentos, agenda do profissional e relatórios de atendimento da Hemoderi.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#6E2620",
    theme_color: "#6E2620",
    categories: ["medical", "business", "productivity"],
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
