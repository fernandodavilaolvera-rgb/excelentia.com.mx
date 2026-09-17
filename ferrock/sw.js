/* Ferrock — service worker compartido por List, Money y Plan.
   Objetivo: que las apps abran SIEMPRE y de inmediato, con señal, con datos
   celulares lentos o sin nada de señal.

   Estrategia clave (cambio de fondo contra la v1):
   al abrir una app se sirve PRIMERO la copia guardada y la red se consulta
   en segundo plano para refrescarla. Así la app nunca se queda esperando a
   un servidor que no contesta. */

const CACHE = 'ferrock-v2';

const BASE = new URL('./', self.location).pathname;   // /ferrock/

/* Las tres apps. Cada una con y sin .html porque ambas direcciones sirven. */
const APPS = [
  'ferrock-list',  'ferrock-list.html',
  'ferrock-money', 'ferrock-money.html',
  'ferrock-plan',  'ferrock-plan.html'
].map(f => BASE + f);

const EXTRAS = [
  'manifest.webmanifest',
  'ferrock-icon-192.png',
  'ferrock-icon-512.png'
].map(f => BASE + f);

const ASSETS = APPS.concat(EXTRAS);

/* Espera como mucho N milisegundos por la red; si no, se rinde.
   Sin esto, una red celular que no contesta deja la app colgada un minuto. */
function fetchConLimite(req, ms){
  return new Promise((resolve, reject) => {
    let listo = false;
    const t = setTimeout(() => { if(!listo){ listo = true; reject(new Error('timeout')); } }, ms);
    fetch(req).then(r => {
      if(listo) return;
      listo = true; clearTimeout(t); resolve(r);
    }).catch(e => {
      if(listo) return;
      listo = true; clearTimeout(t); reject(e);
    });
  });
}

/* Guarda lo que falte, sin tronar si no hay red. */
async function guardarFaltantes(){
  const c = await caches.open(CACHE);
  await Promise.all(ASSETS.map(async u => {
    try{
      const r = await fetchConLimite(new Request(u, {cache:'reload'}), 8000);
      if(r && r.ok) await c.put(u, r.clone());
    }catch(e){ /* sin red: se intenta la próxima vez */ }
  }));
}

/* --- instalar --- */
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await guardarFaltantes();
    self.skipWaiting();
  })());
});

/* --- activar: tirar cachés viejos y tomar el control --- */
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    guardarFaltantes();          // reintento en silencio, sin frenar la activación
  })());
});

/* --- responder --- */
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Supabase: SIEMPRE a la red, jamás cacheado. Si no hay señal, la app ya
     sabe trabajar con lo que tiene guardado en el teléfono. */
  if(url.hostname.indexOf('supabase') >= 0) return;

  /* ---- Abrir una app ---- */
  if(req.mode === 'navigate'){
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const limpia = url.origin + url.pathname;          // sin ?l= ?m= ?p=
      const copia = await c.match(limpia) || await c.match(limpia + '.html');

      if(copia){
        /* Hay copia: se entrega al instante y se refresca por detrás. */
        e.waitUntil((async () => {
          try{
            const r = await fetchConLimite(req, 6000);
            if(r && r.ok) await c.put(limpia, r.clone());
          }catch(err){}
        })());
        return copia;
      }

      /* No hay copia todavía: hay que ir a la red, pero sin esperar eterno. */
      try{
        const r = await fetchConLimite(req, 12000);
        if(r && r.ok) c.put(limpia, r.clone()).catch(()=>{});
        return r;
      }catch(err){
        return new Response(paginaSinConexion(), {
          status: 200,
          headers: {'Content-Type':'text/html; charset=utf-8'}
        });
      }
    })());
    return;
  }

  /* ---- Todo lo demás: iconos, tipografías, manifiesto ---- */
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req);
    if(hit){
      e.waitUntil((async () => {
        try{
          const r = await fetchConLimite(req, 6000);
          if(r && (r.ok || r.type === 'opaque')) await c.put(req, r.clone());
        }catch(err){}
      })());
      return hit;
    }
    try{
      const r = await fetchConLimite(req, 8000);
      if(r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()).catch(()=>{});
      return r;
    }catch(err){
      return new Response('', {status:504});
    }
  })());
});

/* Última red de seguridad: solo se ve si la app nunca alcanzó a guardarse. */
function paginaSinConexion(){
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Ferrock sin conexion</title></head>' +
    '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#fdf6ee;font-family:system-ui,-apple-system,sans-serif;color:#2d5c3f;text-align:center">' +
    '<div style="max-width:320px;padding:28px">' +
    '<div style="font-size:44px;margin-bottom:14px">🌿</div>' +
    '<h1 style="font-size:20px;margin:0 0 10px">Sin conexion</h1>' +
    '<p style="font-size:15px;line-height:1.5;color:#4a6b57;margin:0 0 20px">' +
    'Esta app todavia no alcanzo a guardarse en el telefono. Abrela una vez con WiFi ' +
    'y despues ya va a funcionar aunque no haya senal.</p>' +
    '<button onclick="location.reload()" style="background:#2d9b5f;color:#fff;border:0;' +
    'border-radius:999px;padding:12px 26px;font-size:15px;font-weight:600">Reintentar</button>' +
    '</div></body></html>';
}
