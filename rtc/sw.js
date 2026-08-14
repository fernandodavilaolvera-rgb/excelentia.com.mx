/* Wonderville Store · Service Worker
   Guarda la app completa en el celular para que abra sin conexión.
   Sube este archivo a la MISMA carpeta que wonderville-store.html      */

const PREFIJO = 'wonderville-store-';   // apellido: identifica lo que es de esta app
const CACHE   = PREFIJO + 'v1';

// Todo lo que la app necesita para abrir sin internet
const ASSETS = [
  './',
  './wonderville-store.html',
  'https://excelentia.com.mx/assets/logo_ride_the_cyclone.jpg',
  'https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Nunito:wght@700;800;900&display=swap'
];

// Al instalar: descarga y guarda todo
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ASSETS.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

// Al activar: borra SOLO las versiones viejas de esta app.
// OJO: las copias guardadas son de TODO el dominio, no de esta carpeta.
// Si aquí se borrara todo lo que no sea de Wonderville, se le tiraría
// la copia a Ferrock List y a cualquier otra app del sitio.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(
        ks.filter(k => k.startsWith(PREFIJO) && k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // NUNCA tocar el envío de ventas ni Google Apps Script: siempre a la red
  if (url.indexOf('script.google.com') !== -1 ||
      url.indexOf('script.googleusercontent.com') !== -1) return;

  if (e.request.method !== 'GET') return;

  // Estrategia: responde YA desde el cache y, si hay red, actualiza para la próxima vez
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res && (res.status === 200 || res.type === 'opaque')){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);   // sin red → lo que haya guardado
      return cached || fresh;
    })
  );
});
