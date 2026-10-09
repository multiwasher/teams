/* Service worker do BIZDEV Team.
   Objectivo: a app instalada abre depressa e continua a abrir sem rede — mas
   nunca mostra dados desactualizados da equipa.

   Regras:
   · Dados da folha (Apps Script) e tiles do mapa NUNCA são guardados. Além de
     envelhecerem em minutos, são dados internos da Somengil: não devem ficar
     em cache no aparelho. Sem rede falham, e a app já mostra "Sem ligação".
   · O HTML vai primeiro à rede, para uma publicação nova chegar de imediato à
     TV e aos telemóveis; a cópia em cache serve só quando não há rede.
   · O resto (ícones, manifesto, Leaflet, tipos de letra) vem primeiro da cache.
   Mudar VERSAO invalida tudo o que ficou da versão anterior. */
const VERSAO = '2026-09-02';
const CACHE = `bizdev-${VERSAO}`;

const ESSENCIAIS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

/** Nunca guardar: dados da equipa e mosaicos do mapa. */
const SEM_CACHE = [
  /script\.google\.com/i,
  /basemaps\.cartocdn\.com/i,
  /tile\.openstreetmap\.org/i
];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(ESSENCIAIS))
      .then(()=>self.skipWaiting())          // a versão nova não fica à espera
  );
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(nomes=>Promise.all(nomes.filter(n=>n!==CACHE).map(n=>caches.delete(n))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message', e=>{ if(e.data==='actualizar') self.skipWaiting(); });

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method!=='GET') return;                       // envios para a folha passam directos
  if(SEM_CACHE.some(re=>re.test(req.url))) return;     // dados e mapa: sempre da rede

  // navegação: rede primeiro, cache como rede de segurança
  if(req.mode==='navigate'){
    e.respondWith(
      fetch(req)
        .then(res=>{
          const copia=res.clone();
          caches.open(CACHE).then(c=>c.put('./index.html',copia)).catch(()=>{});
          return res;
        })
        .catch(()=>caches.match('./index.html').then(r=>r||caches.match('./')))
    );
    return;
  }

  // restantes recursos: cache primeiro, rede a seguir
  e.respondWith(
    caches.match(req).then(guardado=>{
      if(guardado) return guardado;
      return fetch(req).then(res=>{
        // só guarda o que veio bem; respostas opacas (CDN) contam como boas
        if(res && (res.ok || res.type==='opaque')){
          const copia=res.clone();
          caches.open(CACHE).then(c=>c.put(req,copia)).catch(()=>{});
        }
        return res;
      });
    })
  );
});
