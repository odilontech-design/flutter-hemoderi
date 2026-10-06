/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // O relatório do profissional leva o comprovante (até 3 MB) junto com o
    // formulário; o padrão do Next, 1 MB, derrubaria o envio.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

module.exports = nextConfig;
