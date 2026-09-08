import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-poppins" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Hemoderi | Operações",
  description:
    "Agendamento, alocação de profissionais e equipamentos, portais de autoatendimento e controle de repasses da Hemoderi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${poppins.variable} ${inter.variable} font-body`}>{children}</body>
    </html>
  );
}
