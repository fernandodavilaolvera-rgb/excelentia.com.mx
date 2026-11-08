/* Ferrock CRM · copia sin señal (solo Ferrock CRM, Ferrock Index y Agenda)
   - Las páginas se piden a la red con un límite de 4 s; si no contesta,
     se usa la copia guardada. Con señal, la copia se actualiza sola.
   - Tipografía, íconos y logo se guardan la primera vez que se usan.
   - Nada de n8n, Google Calendar ni GitHub API pasa por aquí. */
const PREFIJO = 'ferrock-crm-';
const CACHE = PREFIJO + 'v1';
const BASE = new URL('./', self.location).pathname;            // /crm/
const PAGINAS = ['Ferrock-CRM.html', 'auth.js', 'login.html',
  'excelentia/Ferrock_Index.html', 'excelentia/agenda.html'].map(f => BASE + f);
const EXTERNOS = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net\/npm\/@tabler|raw\.githubusercontent\.com\/fernandodavilaolvera-rgb\/excelentia\.com\.mx\/main\/assets\/)/;

function conLimite(req, ms){
  return new Promise((ok, mal) => {
    const t = setTimeout(() => mal(new Error('timeout')), ms);
    fetch(req).then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); mal(e); });
  });
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(PAGINAS.map(async u => {
      try{ const r = await conLimite(new Request(u, { cache: 'reload' }), 8000); if(r.ok) await c.put(u, r); }catch(_){}
    }));
    self.skipWaiting();
  })());
});

// Borra solo versiones viejas de ESTA copia (las demás apps del sitio no se tocan)
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIJO) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  if(url.origin === self.location.origin && PAGINAS.includes(url.pathname)){
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try{
        const r = await conLimite(req, 4000);
        if(r && r.ok) c.put(url.pathname, r.clone());
        return r;
      }catch(_){
        const g = await c.match(url.pathname);
        if(g) return g;
        throw _;
      }
    })());
    return;
  }

  if(EXTERNOS.test(req.url)){
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const g = await c.match(req.url);
      const red = fetch(req).then(r => { if(r && (r.ok || r.type === 'opaque')) c.put(req.url, r.clone()); return r; }).catch(() => null);
      if(g){ e.waitUntil(red); return g; }
      const r = await red;
      return r || Response.error();
    })());
  }
});
