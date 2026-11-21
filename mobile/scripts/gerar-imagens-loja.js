/**
 * Imagens das lojas que não dependem de tela do sistema: o ícone de 512 px e a
 * imagem de destaque do Google Play (1024 × 500), em mobile/<app>/loja.
 * Uso: node mobile/scripts/gerar-imagens-loja.js (da raiz). Precisa do Playwright.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const raiz = path.join(__dirname, "../..");
const logo = fs.readFileSync(path.join(raiz, "public/logo-hemoderi-icone.svg"), "utf8").replace(/<\?xml[^>]*>/, "");
const apps = [
  { app: "clinica", fundo: "#6E2620", titulo: "Hemoderi", frase: "Agende, acompanhe e pague os atendimentos da sua clínica" },
  { app: "profissional", fundo: "#2B2B2E", titulo: "Hemoderi Profissional", frase: "Seus atendimentos, chegada e relatórios na palma da mão" },
];
(async () => {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ deviceScaleFactor: 1 });
  for (const a of apps) {
    const destino = path.join(raiz, "mobile", a.app, "loja");
    fs.mkdirSync(destino, { recursive: true });
    fs.copyFileSync(path.join(raiz, "mobile", a.app, "assets", "icon-only.png"), path.join(destino, "icone-1024.png"));
    await pagina.setViewportSize({ width: 512, height: 512 });
    await pagina.setContent(`<body style="margin:0;width:512px;height:512px;background:${a.fundo};display:flex;align-items:center;justify-content:center"><div style="height:318px;display:flex">${logo.replace("<svg ", '<svg style="height:100%;width:auto" ')}</div></body>`);
    await pagina.screenshot({ path: path.join(destino, "icone-512.png") });
    await pagina.setViewportSize({ width: 1024, height: 500 });
    await pagina.setContent(`<body style="margin:0;width:1024px;height:500px;background:${a.fundo};display:flex;align-items:center;gap:56px;padding:0 80px;box-sizing:border-box;font-family:Helvetica,Arial,sans-serif;color:#fff">
      <div style="height:300px;display:flex;flex:none">${logo.replace("<svg ", '<svg style="height:100%;width:auto" ')}</div>
      <div><div style="font-size:64px;font-weight:700;line-height:1.05">${a.titulo}</div><div style="font-size:30px;margin-top:22px;opacity:.9;line-height:1.3">${a.frase}</div></div></body>`);
    await pagina.screenshot({ path: path.join(destino, "destaque-google-play-1024x500.png") });
    console.log("ok", a.app);
  }
  await navegador.close();
})();
