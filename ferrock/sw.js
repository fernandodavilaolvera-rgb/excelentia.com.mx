/* ═══════════════════════════════════════════════════════════════
   Ferrock List · guardián sin conexión
   ---------------------------------------------------------------
   Guarda la app en el celular para que abra en el súper aunque no
   haya señal, y la mantiene al día sola cuando sí la hay.

   Reglas:
   · La app: primero se pide a internet (así siempre agarra la
     versión nueva); si no hay red, se sirve la copia guardada.
   · Se guarda IGNORANDO el ?l=<espacio>, para que la copia sirva
     para cualquier espacio. El espacio lo resuelve la app sola.
   · Supabase NUNCA se guarda: si no hay red, la llamada falla y la
     app pinta su indicador "Sin conexión", como ya lo hace.
   · Las tipografías sí se guardan, para que no se vea rota offline.
   ═══════════════════════════════════════════════════════════════ */

const PREFIJO = 'ferrock-list-';      // apellido: identifica lo que es de esta app
const CACHE   = PREFIJO + 'v1';
const APP     = './ferrock-list.html';
// Carpeta donde vive este guardián. Solo responde por su propia página;
// lo que cuelgue más abajo (otras apps en subcarpetas) no se toca.
const MI_RUTA = new URL('./ferrock-list.html', self.location).pathname;

// ── Instalación: guarda la app de una vez
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.add(new Request(APP, { cache: 'reload' })))
      .catch(() => {})            // si falla, no rompe la instalación
      .then(() => self.skipWaiting())
  );
});

// ── Activación: tira versiones viejas y toma el mando de inmediato
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // OJO: las copias guardadas son de TODO el sitio, no de esta carpeta.
      // Por eso solo se borran las que llevan el apellido de esta app;
      // si no, se le tiraría la copia a Wonderville y a cualquier otra.
      .then(ks => Promise.all(
        ks.filter(k => k.startsWith(PREFIJO) && k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function esFuente(url){
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (!/^https?:$/.test(url.protocol)) return;

  // Supabase y cualquier otra API: derecho, sin guardar nada
  if (url.hostname.endsWith('.supabase.co')) return;

  // La app: internet primero, copia guardada como red de seguridad
  // Solo esta app. Una navegación a una subcarpeta (otra app) pasa de largo.
  const esLaApp = url.origin === self.location.origin && url.pathname === MI_RUTA;

  if (esLaApp) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copia = res.clone();
            // clave fija, sin el ?l=, para que sirva a cualquier espacio
            caches.open(CACHE).then(c => c.put(APP, copia)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(APP)
            .then(hit => hit || caches.match(req, { ignoreSearch: true }))
            .then(hit => hit || new Response(
              '<meta charset="utf-8"><p style="font-family:sans-serif;padding:2rem">' +
              'Abre la app una vez con internet para poder usarla sin señal.</p>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            ))
        )
    );
    return;
  }

  // Tipografías: copia guardada primero, y se refresca por detrás
  if (esFuente(url)) {
    e.respondWith(
      caches.match(req).then(hit => {
        const red = fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copia = res.clone();
            caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
          }
          return res;
        }).catch(() => hit);
        return hit || red;
      })
    );
  }
});
