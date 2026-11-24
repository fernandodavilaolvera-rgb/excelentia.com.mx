(function(){
  var HASH='1926e882b91bb37d0b3a51f80974f6e29d659c69897ad23a64813d81d0df6a2f';
  var KEY_OK='cursoScarlett_ok', KEY_P='cursoScarlett_progreso';
  function get(k){try{return localStorage.getItem(k)}catch(e){return null}}
  function set(k,v){try{localStorage.setItem(k,v)}catch(e){}}
  window.CS={
    progreso:function(){try{return JSON.parse(get(KEY_P)||'{}')}catch(e){return {}}},
    guardar:function(id,v){var p=CS.progreso();if(v)p[id]=1;else delete p[id];set(KEY_P,JSON.stringify(p))},
    avance:function(ids){var p=CS.progreso(),n=0;ids.forEach(function(i){if(p[i])n++});return ids.length?Math.round(n*100/ids.length):0}
  };
  async function sha(t){var b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')}
  document.addEventListener('DOMContentLoaded',function(){
    var body=document.body;
    if(get(KEY_OK)!==HASH){body.classList.add('locked')}
    var f=document.getElementById('gateForm');
    if(f){f.addEventListener('submit',async function(e){
      e.preventDefault();
      var v=document.getElementById('gateInput').value.trim();
      var h=await sha(v);
      if(h===HASH){set(KEY_OK,HASH);body.classList.remove('locked');if(window.CS_onOpen)CS_onOpen()}
      else{document.getElementById('gateErr').textContent='Esa clave no es; pídesela a Fer.'}
    })}
    document.querySelectorAll('.check input[data-id]').forEach(function(c){
      var id=c.getAttribute('data-id'),lab=c.closest('.check');
      c.checked=!!CS.progreso()[id];lab.classList.toggle('done',c.checked);
      c.addEventListener('change',function(){CS.guardar(id,c.checked);lab.classList.toggle('done',c.checked);if(window.CS_onOpen)CS_onOpen()})
    });
    document.querySelectorAll('.quiz').forEach(function(qz){
      var qs=qz.querySelectorAll('.q');
      qs.forEach(function(q){
        q.querySelectorAll('input').forEach(function(inp){
          inp.addEventListener('change',function(){
            if(q.classList.contains('resp'))return;
            q.classList.add('resp');
            q.querySelectorAll('label').forEach(function(l){
              var i=l.querySelector('input');
              if(i.hasAttribute('data-ok'))l.classList.add('bien');
              else if(i.checked)l.classList.add('mal');
              i.disabled=true;
            });
            if(inp.hasAttribute('data-ok'))q.setAttribute('data-bien','1');
            var r=qz.querySelectorAll('.q.resp').length;
            if(r===qs.length){
              var b=qz.querySelectorAll('.q[data-bien]').length;
              var s=qz.querySelector('.score');
              s.textContent='Resultado: '+b+' de '+qs.length+(b===qs.length?' 🎉 ¡Perfecto!':b>=qs.length-1?' 👏 Muy bien':' · Vale la pena releer el módulo');
              if(b>=qs.length-1){var c=qz.querySelector('.check input');if(c&&!c.checked){c.checked=true;c.dispatchEvent(new Event('change'))}}
            }
          })
        })
      })
    });
    var rb=document.querySelector('.reintentar');
    if(rb)rb.addEventListener('click',function(){location.reload()});
    if(window.CS_onOpen)CS_onOpen();
  });
})();
