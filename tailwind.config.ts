import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Vermelho bordô da marca Hemoderi (hemoderi.com.br) — cor primária:
        // cabeçalho, títulos, ações principais, sidebar. Substituiu o azul da
        // Dilon Tech: este é o painel operacional DA Hemoderi, e quem vive
        // nele o dia inteiro é a equipe deles, não a nossa.
        bordo: "#9C3A32",
        bordoEscuro: "#6E2620", // hover e profundidade — sidebar, fundo do botão primário no hover
      },
      fontFamily: {
        display: ["var(--font-poppins)"],
        body: ["var(--font-inter)"],
      },
    },
  },
  plugins: [],
};
export default config;
