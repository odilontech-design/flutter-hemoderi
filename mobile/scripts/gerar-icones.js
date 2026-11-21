/**
 * Gera as imagens de origem do ícone e da abertura (splash) dos dois apps em
 * mobile/<app>/assets, a partir do logo do sistema. O @capacitor/assets, no
 * preparar-nativo.sh, transforma essas imagens em todos os tamanhos do Android
 * e do iOS. Rodar de novo só quando o logo mudar.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
// Uso: node mobile/scripts/gerar-icones.js (da raiz do repositório). Precisa do Playwright.
const raiz = process.argv[2] || path.join(__dirname, "../..");
const svgOriginal = fs.readFileSync(path.join(raiz, "public/logo-hemoderi-icone.svg"), "utf8").replace(/<\?xml[^>]*>/, "");

// [app, svg do logo, fundo]
const apps = [
  // O logo tem o tubo em branco: foi desenhado para fundo escuro (o mesmo do ícone da web).
  ["clinica", svgOriginal, "#6E2620"],
  // Profissional em grafite, para os dois apps não se confundirem no celular.
  ["profissional", svgOriginal, "#2B2B2E"],
];
// [arquivo, lado, fundo?, escala do logo (fração do lado)]
const pecas = [
  ["icon-only.png", 1024, true, 0.62],
  ["icon-foreground.png", 1024, false, 0.46], // zona segura do ícone adaptativo do Android
  ["icon-background.png", 1024, true, 0],
  ["splash.png", 2732, true, 0.22],
  ["splash-dark.png", 2732, true, 0.22],
];
(async () => {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ deviceScaleFactor: 1 });
  for (const [app, svg, fundo] of apps) {
    const destino = path.join(raiz, "mobile", app, "assets");
    fs.mkdirSync(destino, { recursive: true });
    for (const [arquivo, lado, comFundo, escala] of pecas) {
      await pagina.setViewportSize({ width: lado, height: lado });
      const logo = escala > 0 ? `<div style="height:${Math.round(lado * escala)}px;display:flex">${svg.replace("<svg ", '<svg style="height:100%;width:auto" ')}</div>` : "";
      await pagina.setContent(`<html><body style="margin:0;width:${lado}px;height:${lado}px;display:flex;align-items:center;justify-content:center;background:${comFundo ? fundo : "transparent"}">${logo}</body></html>`);
      await pagina.screenshot({ path: path.join(destino, arquivo), omitBackground: !comFundo });
    }
    console.log("ok", app);
  }
  await navegador.close();
})();
