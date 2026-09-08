import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Azul da Dilon Tech, mantido em toda a linha de produtos.
        navy: "#03254C",
        navyDeep: "#021A38",
        teal: "#00F5D4",
        // Acento da Hemoderi. Usado só em destaque de marca e em alerta
        // operacional (pedido sem profissional alocado), nunca como cor
        // de fundo de área grande — em tela cheia cansa a leitura.
        hemo: "#C0243F",
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
