/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // O relatório do profissional leva o comprovante (até 3 MB) junto com o
    // formulário; o padrão do Next, 1 MB, derrubaria o envio.
    serverActions: { bodySizeLimit: "4mb" },
  },
  // O service worker do app (public/sw.js) nunca pode ficar preso em cache:
  // é por ele que a versão nova do app chega a quem já instalou.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
