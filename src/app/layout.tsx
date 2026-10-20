import type { Metadata, Viewport } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import { AppInstalavel } from "@/components/AppInstalavel";

const poppins = Poppins({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-poppins" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Hemoderi | Operações",
  description:
    "Agendamento, alocação de profissionais e equipamentos, portais de autoatendimento e controle de repasses da Hemoderi.",
  applicationName: "Hemoderi",
  // Instalado no iPhone ("Adicionar à Tela de Início"): abre em tela cheia,
  // com o nome curto embaixo do ícone.
  appleWebApp: { capable: true, title: "Hemoderi", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icones/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icones/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#6E2620",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${poppins.variable} ${inter.variable} font-body`}>
        {children}
        <AppInstalavel />
      </body>
    </html>
  );
}
