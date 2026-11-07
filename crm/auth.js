/* Ferrock CRM · candado de sesión
   - Sin pase válido manda a la pantalla de entrada.
   - Agrega el pase (?t=) a cada llamada a los webhooks del CRM.
   - Si n8n responde que la sesión no vale, regresa a la entrada. */
(function () {
  var K = 'crm_token', KU = 'crm_usuario', KN = 'crm_nombre', KE = 'crm_expira';
  var LOGIN_API = 'https://n8n.excelentia.com.mx/webhook/crm-login';
  var script = document.currentScript;
  var base = script && script.src ? script.src.replace(/auth\.js(\?.*)?$/, '') : (location.origin + '/crm/');
  var LOGIN_PAGE = base + 'login.html';
  // Webhooks que NO llevan candado (agentes de clientes y el propio login)
  var LIBRES = /\/webhook(-test)?\/(crm-login|eco-ia-dashboard|4pl-|berimbau-)/;

  function leer(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function borrar() { [K, KE].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} }); }
  var saliendo = false;
  function irALogin() {
    if (saliendo) return; saliendo = true;
    borrar();
    var top = window;
    try { if (window.top && window.top.location.href) top = window.top; } catch (e) {}
    var destino = '';
    try { destino = top.location.pathname + top.location.search; } catch (e) {}
    top.location.href = LOGIN_PAGE + (destino ? '?r=' + encodeURIComponent(destino) : '');
  }

  var token = leer(K), expira = leer(KE);
  if (!token || (expira && new Date(expira) < new Date())) {
    document.documentElement.style.visibility = 'hidden';
    irALogin();
  }

  // Páginas exclusivas de Fernando (Ferrock CRM y sus módulos propios)
  var SOLO_FERNANDO = /\/crm\/(Ferrock-CRM\.html|excelentia\/(Ferrock_Index|correos-plataformas|dashboard-eco-ia_actividad|finanzas)\.html)$/;
  if (token && leer(KU) !== 'fernando' && SOLO_FERNANDO.test(location.pathname)) {
    document.documentElement.style.visibility = 'hidden';
    var arriba = window; try { if (window.top.location.href) arriba = window.top; } catch (e) {}
    arriba.location.replace(base + 'crm_excelentIA_index.html');
  }

  var fetchOriginal = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input || '');
    if (/n8n\.excelentia\.com\.mx\/webhook(-test)?\//.test(url) && !LIBRES.test(url)) {
      var hash = '';
      var i = url.indexOf('#'); if (i >= 0) { hash = url.slice(i); url = url.slice(0, i); }
      url += (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + encodeURIComponent(leer(K)) + hash;
      input = typeof input === 'string' ? url : new Request(url, input);
      return fetchOriginal(input, init).then(function (r) {
        if (r.status === 401) { irALogin(); return r; }
        var tipo = r.headers.get('content-type') || '';
        if (tipo.indexOf('json') >= 0) {
          return r.clone().json().then(function (j) {
            if (j && j._crm_sin_sesion) irALogin();
            return r;
          }, function () { return r; });
        }
        return r;
      });
    }
    return fetchOriginal(input, init);
  };

  function llamar(cuerpo) {
    return fetchOriginal(LOGIN_API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo)
    }).then(function (r) { return r.json(); });
  }

  window.CRM_AUTH = {
    token: token,
    usuario: leer(KU),
    nombre: leer(KN),
    loginPage: LOGIN_PAGE,
    irALogin: irALogin,
    salir: function () {
      var t = leer(K);
      return llamar({ accion: 'salir', token: t }).catch(function () {}).then(function () {
        saliendo = false; borrar();
        var top = window; try { if (window.top.location.href) top = window.top; } catch (e) {}
        top.location.href = LOGIN_PAGE;
      });
    },
    cambiarClave: function (actual, nueva) {
      return llamar({ accion: 'clave', token: leer(K), clave: actual, nueva: nueva });
    }
  };
})();
