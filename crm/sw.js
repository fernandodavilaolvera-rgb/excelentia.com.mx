/* Ferrock CRM · copia de las pantallas del CRM
   - Cada página del CRM se pide a la red con un límite de 4 s; si GitHub no
     contesta (pasa con algunos operadores de datos móviles) se usa la copia
     guardada. Con señal, la copia se actualiza sola.
   - Los datos (n8n, Google, GitHub API) NO pasan por aquí: siempre van a la red.
   - Tipografía, íconos y logo se guardan la primera vez que se usan. */
const PREFIJO = 'ferrock-crm-';
const CACHE = PREFIJO + 'v2';
const BASE = new URL('./', self.location).pathname;            // /crm/
const PRECARGA = ['Ferrock-CRM.html', 'crm_excelentIA_index.html', 'auth.js', 'login.html',
  'excelentia/Ferrock_Index.html', 'excelentia/agenda.html', 'excelentia/correos-plataformas.html',
  'excelentia/crm-contactos.html', 'excelentia/crm-desarrollo.html', 'excelentia/crm-empresas.html',
  'excelentia/crm-equipo.html', 'excelentia/crm-facturacion.html', 'excelentia/crm-funnel.html',
  'excelentia/crm-proyectos.html', 'excelentia/crm-tareas.html', 'excelentia/dashboard-eco-ia_actividad.html',
  'excelentia/demo.html', 'excelentia/drive.html', 'excelentia/finanzas-excelentia.html',
  'excelentia/finanzas.html'].map(f => BASE + f);
const EXTERNOS = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net\/npm\/@tabler|cdnjs\.cloudflare\.com\/ajax\/libs\/Chart\.js|raw\.githubusercontent\.com\/fernandodavilaolvera-rgb\/excelentia\.com\.mx\/main\/assets\/)/;

function conLimite(req, ms){
  return new Promise((ok, mal) => {
    const t = setTimeout(() => mal(new Error('timeout')), ms);
    fetch(req).then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); mal(e); });
  });
}
const esDelCRM = url => url.origin === self.location.origin && url.pathname.startsWith(BASE)
  && /\.(html|js)$/.test(url.pathname) && !url.pathname.endsWith('/sw.js');

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(PRECARGA.map(async u => {
      try{ const r = await conLimite(new Request(u, { cache: 'reload' }), 10000); if(r.ok) await c.put(u, r); }catch(_){}
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

  if(esDelCRM(url)){
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
