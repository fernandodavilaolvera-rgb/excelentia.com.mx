/* Ferrock — service worker compartido por List, Money y Plan.
   Objetivo: que las apps abran SIEMPRE, con o sin señal. */
const CACHE = 'ferrock-v1';

const BASE = new URL('./', self.location).pathname;   // /ferrock/
const ASSETS = [
  'ferrock-list', 'ferrock-list.html',
  'ferrock-money', 'ferrock-money.html',
  'ferrock-plan', 'ferrock-plan.html',
  'manifest.webmanifest',
  'ferrock-icon-192.png',
  'ferrock-icon-512.png'
].map(f => BASE + f);

/* --- instalar: guardar una copia de cada app --- */
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(ASSETS.map(u =>
      fetch(u, {cache:'reload'}).then(r => r.ok ? c.put(u, r) : null).catch(()=>null)
    ));
    self.skipWaiting();
  })());
});

/* --- activar: tirar cachés viejos y tomar el control --- */
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* --- responder --- */
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);
  const propio = (url.origin === self.location.origin);

  /* Supabase y cualquier API: siempre a la red, nunca cacheado */
  if(propio && url.pathname.indexOf('/rest/') === 0) return;
  if(url.hostname.indexOf('supabase') >= 0) return;

  /* Abrir una app: intenta red, y si no hay, sirve la copia guardada */
  if(req.mode === 'navigate'){
    e.respondWith((async () => {
      try{
        const r = await fetch(req);
        if(r && r.ok){
          const c = await caches.open(CACHE);
          c.put(quitarQuery(url), r.clone()).catch(()=>{});
        }
        return r;
      }catch(err){
        const c = await caches.open(CACHE);
        return (await c.match(quitarQuery(url))) ||
               (await c.match(BASE + 'ferrock-money')) ||
               (await c.match(BASE + 'ferrock-money.html')) ||
               new Response('<h1>Sin conexion</h1>', {headers:{'Content-Type':'text/html'}});
      }
    })());
    return;
  }

  /* Todo lo demas (iconos, tipografias): primero lo guardado, luego la red */
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req);
    if(hit){
      fetch(req).then(r => { if(r && r.ok) c.put(req, r).catch(()=>{}); }).catch(()=>{});
      return hit;
    }
    try{
      const r = await fetch(req);
      if(r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()).catch(()=>{});
      return r;
    }catch(err){
      return new Response('', {status:504});
    }
  })());
});

function quitarQuery(url){
  return url.origin + url.pathname;
}
