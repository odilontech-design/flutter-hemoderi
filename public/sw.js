/*
 * Service worker do app Hemoderi.
 *
 * Faz só o que um app precisa e nada que possa mostrar dado velho:
 *   - páginas: sempre da rede (agenda, pedidos e relatórios mudam o tempo
 *     todo e dependem de quem está logado); sem rede, mostra a tela offline;
 *   - arquivos estáticos com hash (/_next/static), ícones e imagens do
 *     catálogo: guardados, para o app abrir rápido;
 *   - /api e qualquer coisa que não seja GET: nunca passam por aqui.
 *
 * Trocar VERSAO descarta o cache antigo na próxima abertura.
 */
const VERSAO = "hemoderi-v1";
const OFFLINE = "/offline.html";
const PRE_CACHE = [OFFLINE, "/icones/icone-192.png", "/logo-hemoderi-icone.svg"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(PRE_CACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

function estatico(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icones/") ||
    url.pathname.startsWith("/catalogo/") ||
    /^\/logo-hemoderi.*\.svg$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    evento.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }

  if (estatico(url)) {
    evento.respondWith(
      caches.match(request).then(
        (guardado) =>
          guardado ||
          fetch(request).then((resposta) => {
            if (resposta.ok) {
              const copia = resposta.clone();
              caches.open(VERSAO).then((cache) => cache.put(request, copia));
            }
            return resposta;
          })
      )
    );
  }
});
