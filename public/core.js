'use strict';
/* =========================================================
   TradeBlacket core — helpers, catalog, state, shell, chat
   ========================================================= */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const rnd=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296};
const ri=(a,b)=>a+Math.floor(rnd()*(b-a+1));
const pick=a=>a[Math.floor(rnd()*a.length)];
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const fmt=n=>(+n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt0=n=>(+n).toLocaleString('en-US',{maximumFractionDigits:0});
const r2=n=>Math.round(n*100)/100;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=s=>{let h=7;for(const c of String(s))h=(h*31+c.charCodeAt(0))|0;return Math.abs(h)};
const clock=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const uid=()=>Math.floor(rnd()*36**8).toString(36).padStart(8,'0');
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const store={get(k,d){try{const v=localStorage.getItem('tb2_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('tb2_'+k,JSON.stringify(v))}catch(e){}}};
const DAY=864e5,DAILY=500;
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- icons ---------- */
const ICON={
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  cases:'<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 9a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5M3 13h18"/><rect x="10" y="11" width="4" height="4" rx="1"/>',
  battles:'<path d="M4 4l11 11M13 17l4-4M15.5 18.5l3-3M20 4L9 15M7 13l4 4M5.5 15.5l3 3"/>',
  upgrader:'<circle cx="12" cy="12" r="9"/><path d="M12 16V8M8.5 11.5L12 8l3.5 3.5"/>',
  inventory:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>',
  rewards:'<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v7h14v-7M12 8v12M12 8c-2-4-6-4-6-1.5S10 8 12 8zm0 0c2-4 6-4 6-1.5S14 8 12 8z"/>',
  profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  crash:'<path d="M12 2.5c3 2 5 5.8 5 9.8l-2 3.7H9l-2-3.7c0-4 2-7.8 5-9.8z"/><circle cx="12" cy="10" r="2"/><path d="M9.5 16l-1.5 5 4-2.5 4 2.5-1.5-5"/>',
  roulette:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21"/>',
  blackjack:'<rect x="3" y="5" width="11" height="15" rx="2"/><path d="M10 4.5l6.5-1.5a2 2 0 0 1 2.4 1.5l2.6 11.3a2 2 0 0 1-1.5 2.4L16 19.5"/><path d="M8.5 10l-2 2.5 2 2.5 2-2.5z"/>',
  mines:'<circle cx="11" cy="14" r="6.5"/><path d="M15.5 9.5l2.5-2.5M18 7l2.2.4M18 7l-.4-2.2"/>',
  towers:'<rect x="4" y="15" width="16" height="6" rx="1.2"/><rect x="6.5" y="9" width="11" height="6" rx="1.2"/><rect x="9" y="3" width="6" height="6" rx="1.2"/>',
  cups:'<path d="M4.5 20h7l-1.4-12H5.9zM12.5 20h7l-1.4-12h-4.2z"/><circle cx="12" cy="4.5" r="1.8"/>',
  dice:'<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  plinko:'<circle cx="12" cy="5" r="1.6"/><circle cx="8" cy="11" r="1.6"/><circle cx="16" cy="11" r="1.6"/><circle cx="4" cy="17" r="1.6"/><circle cx="12" cy="17" r="1.6"/><circle cx="20" cy="17" r="1.6"/>',
  coinflip:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/>',
  baccarat:'<rect x="2.5" y="6" width="9" height="13" rx="1.5"/><rect x="12.5" y="6" width="9" height="13" rx="1.5"/><path d="M7 10.5v4M17 10.5v4"/>',
  limbo:'<path d="M4 19h16"/><path d="M6 16l4-5 3 3 5-8"/><path d="M15 6h3v3"/>',
  hilo:'<rect x="6" y="3.5" width="12" height="17" rx="2"/><path d="M12 8v8M9.5 10.5L12 8l2.5 2.5"/>',
  keno:'<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.3"/><circle cx="8.5" cy="15.5" r="1.3"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
  wheel:'<circle cx="12" cy="13" r="8"/><path d="M12 5v16M4 13h16M6.3 7.3l11.4 11.4M17.7 7.3L6.3 18.7"/><path d="M10 2.5h4L12 5z" fill="currentColor"/>',
  slots:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M9 5v14M15 5v14"/><path d="M5.5 12h1.5M11 12h2M17 12h1.5"/>',
  market:'<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9h16v2a3 3 0 0 1-5.3 1.9A3 3 0 0 1 12 14a3 3 0 0 1-2.7-1.1A3 3 0 0 1 4 11z"/><path d="M5.5 13.5V20h13v-6.5"/>',
  predictions:'<path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 15l3.5-4 3 2.5L19 7"/><circle cx="19" cy="7" r="1.5"/>',
  news:'<rect x="3.5" y="4.5" width="14" height="15" rx="2"/><path d="M17.5 8.5h3V18a1.5 1.5 0 0 1-3 0zM7 8.5h7M7 12h7M7 15.5h4"/>',
  stocks:'<path d="M6 4v16M18 4v16M12 3v18"/><rect x="4" y="8" width="4" height="7" rx=".8"/><rect x="16" y="6" width="4" height="9" rx=".8"/><rect x="10" y="11" width="4" height="6" rx=".8"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  trend:'<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  star:'<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  tag:'<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  bolt:'<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  logout:'<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/>',
  send:'<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  gem:'<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M9 4l3 5 3-5"/>',
  chev:'<path d="M9 6l6 6-6 6"/>',
  play:'<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>'
};
const ic=(n,s=20,w=1.8)=>`<svg class="i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]||''}</svg>`;
const chip=(s=14)=>`<svg class="chip" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="var(--gold)"/><circle cx="12" cy="12" r="8.6" fill="none" stroke="var(--chip-ink)" stroke-width="1.4" opacity=".55"/><path d="M9.3 17V7.2h3.4a2.9 2.9 0 0 1 .4 5.8l2.4 4" fill="none" stroke="var(--chip-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ---------- original collectible art (TradeBlacket-only items) ---------- */
const ART={
  cap:(b,d,l)=>`<path d="M10 42a22 22 0 0 1 44 0z" fill="${b}"/><path d="M30 42h28a3 3 0 0 1-3 4H30z" fill="${d}"/><path d="M32 20v22" stroke="${d}" stroke-width="2" opacity=".5"/><circle cx="32" cy="20" r="3" fill="${l}"/><path d="M17 33a16 16 0 0 1 9-9" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35" fill="none"/>`,
  shades:(b,d,l)=>`<path d="M5 24h54" stroke="${d}" stroke-width="4" stroke-linecap="round"/><path d="M8 24h20l-2 12a6 6 0 0 1-6 5h-5a6 6 0 0 1-6-5z" fill="${b}"/><path d="M36 24h20l-1 12a6 6 0 0 1-6 5h-5a6 6 0 0 1-6-5z" fill="${b}"/><path d="M12 28h6M40 28h6" stroke="${l}" stroke-width="3" stroke-linecap="round" opacity=".8"/>`,
  sneaker:(b,d,l)=>`<path d="M6 44V30l14-3 8 8 24 3a6 6 0 0 1 6 6z" fill="${b}"/><path d="M6 44h52v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="${l}"/><path d="M20 31l3 3M24 29l3 3" stroke="${d}" stroke-width="2.5" stroke-linecap="round"/><path d="M32 40h18" stroke="${d}" stroke-width="3" stroke-linecap="round"/>`,
  boombox:(b,d,l)=>`<path d="M18 18V12h28v6" stroke="${d}" stroke-width="4" fill="none" stroke-linejoin="round"/><rect x="6" y="18" width="52" height="32" rx="6" fill="${b}"/><circle cx="19" cy="36" r="8" fill="${d}"/><circle cx="45" cy="36" r="8" fill="${d}"/><circle cx="19" cy="36" r="3" fill="${l}"/><circle cx="45" cy="36" r="3" fill="${l}"/><rect x="27" y="23" width="10" height="6" rx="1.5" fill="${l}"/>`,
  crown:(b,d,l)=>`<path d="M8 46h48l4-28-14 11-14-17-14 17-14-11z" fill="${b}"/><rect x="8" y="46" width="48" height="7" rx="2" fill="${d}"/><circle cx="32" cy="34" r="4" fill="${l}"/><circle cx="18" cy="38" r="2.5" fill="${l}"/><circle cx="46" cy="38" r="2.5" fill="${l}"/><path d="M14 26l4 4" stroke="#fff" stroke-width="2.5" opacity=".4" stroke-linecap="round"/>`,
  katana:(b,d,l)=>`<path d="M54 6L22 38l4 4L58 10z" fill="${l}"/><path d="M54 6l4 4-32 32" stroke="#fff" stroke-width="1.5" opacity=".6" fill="none"/><path d="M17 35l12 12" stroke="${d}" stroke-width="5" stroke-linecap="round"/><path d="M22 42L9 55" stroke="${b}" stroke-width="7" stroke-linecap="round"/>`,
  wings:(b,d,l)=>`<path d="M30 36C22 18 10 14 3 16c4 6 2 12 8 16-4 2-5 6-4 11 8-2 16-2 23-7z" fill="${b}"/><path d="M34 36c8-18 20-22 27-20-4 6-2 12-8 16 4 2 5 6 4 11-8-2-16-2-23-7z" fill="${b}"/><path d="M10 22c6 2 12 6 18 12M54 22c-6 2-12 6-18 12" stroke="${l}" stroke-width="2" opacity=".75" fill="none"/><circle cx="32" cy="36" r="4" fill="${d}"/>`,
  headphones:(b,d,l)=>`<path d="M12 38v-6a20 20 0 0 1 40 0v6" stroke="${d}" stroke-width="5" fill="none"/><rect x="6" y="34" width="14" height="20" rx="5" fill="${b}"/><rect x="44" y="34" width="14" height="20" rx="5" fill="${b}"/><rect x="10" y="38" width="4" height="12" rx="2" fill="${l}"/><rect x="50" y="38" width="4" height="12" rx="2" fill="${l}"/>`,
  helm:(b,d,l)=>`<path d="M14 40a18 18 0 0 1 36 0v12H14z" fill="${b}"/><path d="M15 32C8 28 5 19 7 9c4 7 9 11 13 13M49 32c7-4 10-13 8-23-4 7-9 11-13 13" fill="${l}"/><rect x="19" y="39" width="26" height="6" rx="2" fill="${d}"/><path d="M32 23v14" stroke="${d}" stroke-width="3"/>`,
  halo:(b,d,l)=>`<ellipse cx="32" cy="34" rx="25" ry="10" fill="none" stroke="${b}" stroke-width="7"/><ellipse cx="32" cy="34" rx="25" ry="10" fill="none" stroke="${l}" stroke-width="2" opacity=".85"/><path d="M32 6v7M19 10l3 6M45 10l-3 6" stroke="${l}" stroke-width="2.5" stroke-linecap="round"/>`,
  backpack:(b,d,l)=>`<path d="M24 15a8 8 0 0 1 16 0" stroke="${d}" stroke-width="4" fill="none"/><rect x="14" y="16" width="36" height="40" rx="10" fill="${b}"/><rect x="20" y="36" width="24" height="14" rx="4" fill="${d}"/><path d="M26 42h12" stroke="${l}" stroke-width="2.5" stroke-linecap="round"/><path d="M20 24h8" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35"/>`,
  pet:(b,d,l)=>`<path d="M18 23l-5-11 11 6M46 23l5-11-11 6" fill="${d}"/><path d="M10 44c0-14 10-26 22-26s22 12 22 26c0 6-6 8-22 8s-22-2-22-8z" fill="${b}"/><circle cx="24" cy="36" r="4.5" fill="#fff"/><circle cx="40" cy="36" r="4.5" fill="#fff"/><circle cx="25" cy="37" r="2.3" fill="#111"/><circle cx="41" cy="37" r="2.3" fill="#111"/><path d="M29 44q3 3 6 0" stroke="${d}" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="18" cy="42" r="2.5" fill="${l}" opacity=".7"/><circle cx="46" cy="42" r="2.5" fill="${l}" opacity=".7"/>`,
  mask:(b,d,l)=>`<path d="M8 22c8-6 40-6 48 0 0 16-8 28-24 28S8 38 8 22z" fill="${b}"/><path d="M16 28c4-3 10-3 13 1-4 4-10 4-13-1zM48 28c-4-3-10-3-13 1 4 4 10 4 13-1z" fill="${d}"/><path d="M26 42q6 4 12 0" stroke="${d}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M14 22c6-3 12-4 18-4" stroke="#fff" stroke-width="3" opacity=".35" stroke-linecap="round" fill="none"/>`,
  chain:(b,d,l)=>`<path d="M12 8c0 18 8 26 20 26s20-8 20-26" stroke="${b}" stroke-width="5" stroke-dasharray="5 3" fill="none"/><path d="M32 33l11 11-11 13-11-13z" fill="${l}"/><path d="M32 33l11 11H21z" fill="#fff" opacity=".35"/>`,
  trophy:(b,d,l)=>`<path d="M20 9h24v15a12 12 0 0 1-24 0z" fill="${b}"/><path d="M20 13h-8a8 8 0 0 0 8 11M44 13h8a8 8 0 0 1-8 11" stroke="${b}" stroke-width="4" fill="none"/><rect x="28" y="36" width="8" height="8" fill="${d}"/><rect x="19" y="44" width="26" height="9" rx="2" fill="${d}"/><path d="M26 14v9" stroke="#fff" stroke-width="3" opacity=".45" stroke-linecap="round"/><path d="M32 16l1.5 3 3.3.5-2.4 2.3.6 3.2-3-1.6-3 1.6.6-3.2-2.4-2.3 3.3-.5z" fill="${l}"/>`,
  board:(b,d,l)=>`<g transform="rotate(-14 32 34)"><rect x="4" y="27" width="56" height="12" rx="6" fill="${b}"/><path d="M12 33h40" stroke="${l}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="6 5"/><circle cx="16" cy="45" r="5" fill="${d}"/><circle cx="48" cy="45" r="5" fill="${d}"/></g>`
};
const RAR={common:'Common',uncommon:'Uncommon',rare:'Rare',epic:'Epic',legendary:'Legendary',limited:'Limited'};
const CAT=[
  ['vcap','Vinyl Cap','cap',214,'common',8],['tshade','Tinted Shades','shades',200,'common',12],['canv','Canvas Kicks','sneaker',4,'common',15],['sbag','School Pack','backpack',140,'common',18],['blob','Pocket Blob','pet',180,'common',22],['pmask','Paper Mask','mask',38,'common',26],
  ['scap','Street Cap','cap',150,'uncommon',38],['nshade','Night Shades','shades',270,'uncommon',45],['rkick','Runner Kicks','sneaker',190,'uncommon',55],['mbox','Mini Boombox','boombox',330,'uncommon',68],['epup','Ember Pup','pet',18,'uncommon',72],['bphones','Bass Phones','headphones',160,'uncommon',80],
  ['cvisor','Chrome Shades','shades',210,'rare',120],['jpack','Jet Pack','backpack',22,'rare',150],['nmask','Neon Mask','mask',300,'rare',170],['lblade','Lumen Blade','katana',190,'rare',190],['cboard','Cruiser Board','board',280,'rare',220],['gchain','Gold Chain','chain',44,'rare',260],
  ['pbox','Pulse Boombox','boombox',262,'epic',420],['swings','Storm Wings','wings',205,'epic',560],['fhelm','Frost Helm','helm',195,'epic',700],['vphones','Void Phones','headphones',282,'epic',880],['apup','Astral Pup','pet',268,'epic',1050],
  ['shalo','Sun Halo','halo',45,'legendary',1600],['eblade','Eclipse Blade','katana',350,'legendary',2400],['gwings','Gilded Wings','wings',44,'legendary',3600],['mcrown','Market Crown','crown',44,'legendary',5200],
  ['ehelm','Empire Helm','helm',352,'limited',9000],['ihalo','Ice Halo','halo',192,'limited',14000],['rwings','Ruby Wings','wings',350,'limited',22000],['ecrown','Empire Crown','crown',282,'limited',40000],['dtrophy','Diamond Trophy','trophy',190,'limited',60000]
].map(([id,n,t,h,r,v])=>({id,n,t,h,r,v}));
// Trade Empire item art: every TradeBlacket item uses the icon of a real Roblox limited, the same
// catalog Trade Empire's items come from. On the live site the server proxies the current icon
// (/img/asset/<id>); elsewhere the cached Roblox CDN link is used.
const RBX={
  vcap:[12803855954,'Glossy Red Baseball Cap','b1ff24faa7bb10eb7bbc98f7566e6b75','Hat'],
  tshade:[3798251754,'Sugar Shades','c56a886aa978a6f700b2c318fa383d06','FaceAccessory'],
  canv:[3798239844,'Frosting Flyers','1b04c25e4e36732e3858039c68dab8a3','BackAccessory'],
  sbag:[3798248888,'Cake Topper','ec8a595ff6d7ea9ffc81710f29fe5fcb','Hat'],
  blob:[4773569689,'Epic Egg','421c7c80b13f4126193a5db5133a3b72','Hat'],
  pmask:[2528066922,'Catrin Dia de Muertos Mask','c7c9fba906fc4778fa3ce8a06f4c1cb9','FaceAccessory'],
  scap:[3798243238,'Party Fedora','e803136de9f3e95b1777c53643ff98ac','Hat'],
  nshade:[2470988571,'Spider Headphones','bd1c6944d1bfdbb717a0470a4d55b1b9','Hat'],
  rkick:[2470988022,'Spider Antlers','8385c0366aae5ee44312a10db3175045','Hat'],
  mbox:[1230404580,'Back Axe Guitar','761e3fb2433589653debf4c796945086','BackAccessory'],
  epup:[44113968,'Kuddle E. Koala','ec55f9e55d89ab46c97289a0151ec535','Hat'],
  bphones:[126892292563296,'Bandana From Beyond','03aee628105a0fb043fa9cbe477b720e','FaceAccessory'],
  cvisor:[128217885,'Fall Fairy','c24ab7a5304f2b392abe1c257b33263a','ShoulderAccessory'],
  jpack:[14463095,'Pinstripe Fedora','d6b02e64f1bb4e4b50db8b7c8e265a38','Hat'],
  nmask:[1048037,'Bighead','d9861256dda2bcdef1e98de4817b8664','Hat'],
  lblade:[1082932,'Traffic Cone','e5623399b4c331bc3da15e0153d4b40a','Hat'],
  cboard:[20011925,'Oozing Oscar','6b06b0bfaf4a94e1ace89ffbf48441a0','Hat'],
  gchain:[16477149823,'Gold Clockwork Headphones','63e255c87aa7e885e8efd89e737d760f','Hat'],
  pbox:[100425864,'Deluxe Game Headset','f6c2d55ce77ddaccdc5235602bec01ac','Hat'],
  swings:[835065728,'Clockwork Heartphones','0536efde9c8f98afada5ff627c17b546','Hat'],
  fhelm:[139578571,'Chi ting','8c0681be930778c80557e747ef330e44','Gear'],
  vphones:[40493240,'Purple Shades','9c70e14f4b27f018230823b2d8a390c1','FaceAccessory'],
  apup:[2606191948,'Gingerbread Immortal Sword','fe9067ef2464c5a663a099b6209819f2','BackAccessory'],
  shalo:[416828455,'Immortal Sword: The Piece Maker','526c21f8c357b511051c311da8f6c827','BackAccessory'],
  eblade:[2274774123,'Redvalk','29a717da3743e06ba997ebd2162b3fbc','Hat'],
  gwings:[1744060292,'Poisoned Horns of the Toxic Wasteland','b06f512bdce9ecb993282ce2174cc77f','Hat'],
  mcrown:[48545806,'Dominus Frigidus','f70fd4f3d53eaba84bb07c10f781d5ec','Hat'],
  ehelm:[2830437685,'Emerald Valkyrie','b892470012a37d4c7dc997a4a7495902','Hat'],
  ihalo:[1365767,'Blue Valkyrie','33ebc9fedab2e19a669b6686ad7a656b','Hat'],
  rwings:[88885069,'Lord of the Federation','2fb3cae0bdd7d2f51af5cd7d4771d57a','Hat'],
  ecrown:[21070012,'Dominus Empyreus','6e4a60bf8300b35bae657874937adc28','Hat'],
  dtrophy:[335080779,'Dominus Pittacium','c2975766800eb169659030fb1c9d5fdd','Hat']
};
const LIVEHOST=/^https?:$/.test(location.protocol)&&!/claude|localhost|127\.0\.0\.1/.test(location.hostname);
const rbxImg=(a,h,t)=>LIVEHOST?`/img/asset/${a}`:`https://tr.rbxcdn.com/180DAY-${h}/420/420/${t}/Webp/noFilter`;
for(const it of CAT){const r=RBX[it.id];if(r){it.a=r[0];it.n=r[1];it.img=rbxImg(r[0],r[2],r[3])}}
const ITEM=Object.fromEntries(CAT.map(i=>[i.id,i]));
function itemSvg(id){const i=ITEM[id];if(!i)return'';if(i.img)return `<img class="art rbx" src="${i.img}" alt="" loading="lazy" decoding="async" draggable="false">`;const b=`hsl(${i.h} 72% 56%)`,d=`hsl(${i.h} 55% 28%)`,l=`hsl(${i.h} 95% 80%)`;return `<svg class="art" viewBox="0 0 64 64" aria-hidden="true">${ART[i.t](b,d,l)}</svg>`}
function itemCard(id,o={}){const i=ITEM[id];return `<div class="itc r-${i.r}${o.cls?' '+o.cls:''}" ${o.attr||''}>${o.top||''}<div class="itc-art">${itemSvg(id)}</div><span class="rar">${RAR[i.r]}</span><div class="itc-n">${esc(i.n)}</div><div class="itc-v">${chip(12)}${fmt(i.v)}</div>${o.bottom||''}</div>`}
const reelTile=id=>{const i=ITEM[id];return `<div class="rtile r-${i.r}">${itemSvg(id)}<div class="rtile-n">${esc(i.n)}</div><div class="rtile-v">${chip(11)}${fmt(i.v)}</div></div>`};
const mini=id=>{const i=ITEM[id];return `<span class="mini r-${i.r}">${itemSvg(id)}${esc(i.n)} <span>${fmt(i.v)}</span></span>`};

/* ---------- cases ---------- */
const CASEDEF=[
  ['starter','Starter Crate',214,'Hot',[['vcap',30],['tshade',25],['canv',18],['sbag',12],['scap',7],['nshade',4.5],['cvisor',2],['gchain',.4],['pbox',.1]]],
  ['street','Street Drop',150,'',[['canv',22],['blob',20],['pmask',18],['rkick',14],['mbox',10],['bphones',8],['nmask',4],['cboard',3],['swings',.8],['shalo',.2]]],
  ['neon','Neon Night',300,'New',[['nshade',25],['bphones',20],['nmask',18],['cboard',14],['pbox',10],['vphones',6],['apup',4],['eblade',2.5],['rwings',.5]]],
  ['vault',"Trader's Vault",44,'Hot',[['gchain',26],['jpack',22],['lblade',18],['swings',14],['fhelm',10],['apup',6],['gwings',3],['mcrown',.9],['ehelm',.1]]],
  ['frost','Frostbite',196,'',[['cvisor',28],['lblade',22],['fhelm',20],['vphones',14],['swings',9],['shalo',5],['ihalo',1.6],['dtrophy',.4]]],
  ['empire','Empire Reserve',350,'Limited',[['pbox',25],['swings',20],['fhelm',18],['apup',15],['shalo',10],['eblade',6],['gwings',3.5],['mcrown',1.5],['ehelm',.8],['rwings',.15],['ecrown',.05]]],
  ['royal','Royal Treasury',272,'Limited',[['apup',24],['shalo',22],['eblade',18],['gwings',14],['mcrown',10],['ehelm',6],['ihalo',3.5],['rwings',1.8],['ecrown',.6],['dtrophy',.1]]],
  ['daily','Daily Case',130,'',[['vcap',35],['tshade',25],['blob',18],['scap',12],['rkick',6],['mbox',3],['jpack',.9],['gchain',.1]]],
  ['penny','Penny Pack',30,'',[['vcap',40],['tshade',30],['canv',20],['blob',9],['pmask',1]]],
  ['budget','Budget Box',210,'',[['vcap',30],['tshade',25],['canv',20],['sbag',14],['blob',8],['scap',2.5],['nshade',.5]]],
  ['egg','Egg Hunt',330,'New',[['blob',40],['sbag',25],['epup',15],['cboard',8],['nmask',6],['apup',.8],['vcap',5.2]]],
  ['spider','Spider Season',260,'New',[['nshade',38],['rkick',34],['lblade',15],['cboard',8],['swings',4.4],['gwings',.6]]],
  ['fedora','Fedora Club',30,'New',[['scap',40],['jpack',25],['cvisor',18],['nmask',10],['vphones',6.6],['mcrown',.4]]],
  ['sound','Headphone Haven',215,'New',[['bphones',30],['nshade',28],['gchain',20],['pbox',12],['swings',7],['vphones',3]]],
  ['sword','Blade Runner',210,'New',[['mbox',30],['lblade',26],['cboard',20],['apup',10],['fhelm',10.2],['shalo',3],['eblade',.8]]],
  ['midnight','Midnight',240,'',[['nshade',25],['vphones',20],['cvisor',20],['nmask',20],['swings',14],['eblade',1]]],
  ['horns','Toxic Wasteland',140,'New',[['cboard',30],['pbox',25],['nmask',20],['fhelm',21],['gwings',4]]],
  ['collector','Collector\'s Case',170,'',[['jpack',25],['gchain',22],['pbox',20],['swings',15],['fhelm',12],['shalo',5],['ehelm',1]]],
  ['gamble','50/50',45,'Hot',[['vcap',50],['mcrown',50]]],
  ['fed','Federation Reserve',265,'Limited',[['vphones',30],['apup',25],['fhelm',20],['shalo',15],['ihalo',8],['rwings',2]]],
  ['valk','Valkyrie Vault',210,'Limited',[['eblade',30],['apup',25],['shalo',17],['ehelm',15],['gwings',10],['ihalo',3]]],
  ['mythic','Mythic',350,'Limited',[['apup',40],['shalo',30],['eblade',20],['ihalo',6],['ecrown',3],['dtrophy',1]]],
  ['highroller','High Roller',44,'Limited',[['gwings',35],['mcrown',30],['ehelm',20],['ihalo',10],['rwings',4],['dtrophy',1]]],
  ['dominus','Dominus Dynasty',230,'Limited',[['shalo',30],['eblade',25],['gwings',20],['mcrown',17],['ecrown',6],['dtrophy',2]]]
];
const CASES=CASEDEF.map(([id,n,h,tag,list])=>{const tw=list.reduce((a,x)=>a+x[1],0);const ev=list.reduce((a,[k,w])=>a+ITEM[k].v*w,0)/tw;return{id,n,h,tag,daily:id==='daily',items:list.map(([k,w])=>({id:k,p:w/tw})).sort((a,b)=>ITEM[b.id].v-ITEM[a.id].v),ev,price:id==='daily'?0:r2(ev/0.92)}});
const CASE=Object.fromEntries(CASES.map(c=>[c.id,c]));
const SHOP=CASES.filter(c=>!c.daily);
const pickFrom=c=>{let r=rnd();for(const it of c.items){if((r-=it.p)<0)return it.id}return c.items[c.items.length-1].id};
function chest(h){return `<svg class="case-box" viewBox="0 0 120 96" aria-hidden="true"><path d="M8 42a22 22 0 0 1 22-22h60a22 22 0 0 1 22 22z" fill="hsl(${h} 70% 62%)"/><path d="M22 28h76" stroke="#fff" stroke-width="3" opacity=".25" stroke-linecap="round"/><rect x="8" y="42" width="104" height="48" rx="9" fill="hsl(${h} 62% 44%)"/><rect x="8" y="42" width="104" height="10" fill="hsl(${h} 60% 26%)"/><rect x="8" y="80" width="104" height="10" rx="5" fill="hsl(${h} 60% 30%)"/><rect x="50" y="46" width="20" height="24" rx="4" fill="#0B1424"/><circle cx="60" cy="56" r="4" fill="hsl(${h} 90% 72%)"/><path d="M8 52h12v28H8zM100 52h12v28h-12z" fill="#F5B83D" opacity=".85"/></svg>`}
const caseArt=c=>`<div class="case-art" style="--h:${c.h}"><div class="case-glow"></div><div class="case-top">${itemSvg(c.items[0].id)}</div>${chest(c.h,c.id)}</div>`;
const caseThumb=(c,cls='',n=0)=>`<span class="cth ${cls}" style="--h:${c.h}" title="${esc(c.n)}">${chest(c.h,c.id)}${n>1?`<i>×${n}</i>`:''}</span>`;

/* ---------- games registry ---------- */
const GAMES={
  cases:{n:'Cases'},battles:{n:'Case Battles'},stocks:{n:'Stocks'},upgrader:{n:'Upgrader'},market:{n:'Marketplace'},predictions:{n:'Predictions'},slots:{n:'Slots'},
  crash:{n:'Crash',tag:'Popular',bg:'#2457D6'},
  roulette:{n:'Roulette',tag:'Live rounds',bg:'#B4283F'},
  blackjack:{n:'Blackjack',tag:'5 seats',bg:'#0E6B57'},
  baccarat:{n:'Baccarat',tag:'Table',bg:'#6B2E86'},
  mines:{n:'Mines',tag:'Popular',bg:'#0F8A64'},
  towers:{n:'Towers',tag:'Climb',bg:'#C8611E'},
  plinko:{n:'Plinko',tag:'Drop',bg:'#B42F8C'},
  dice:{n:'Dice',tag:'Fast',bg:'#24806A'},
  limbo:{n:'Limbo',tag:'Fast',bg:'#3C3FB8'},
  hilo:{n:'Hi-Lo',tag:'Cards',bg:'#1F6FA8'},
  keno:{n:'Keno',tag:'Numbers',bg:'#8A6A12'},
  wheel:{n:'Wheel',tag:'Spin',bg:'#A8392A'},
  cups:{n:'Cups',tag:'Classic',bg:'#1C7FA6'},
  coinflip:{n:'Coinflip',tag:'50 / 50',bg:'#B8761E'}
};
const ORIG=['crash','roulette','blackjack','baccarat','mines','towers','plinko','dice','limbo','hilo','keno','wheel','cups','coinflip'];

/* ---------- state ---------- */
const DEF={bal:0,lock:0,user:null,claim:0,dailyCase:0,lastBet:10,fast:false,inv:[],promo:[],
  profile:{bio:'',hue:215,frame:'none',banner:'aurora',avItem:null,showcase:[]},
  stats:{wagered:0,bets:0,wins:0,bestMult:0,bestGame:'',bestDrop:null,battles:0,upgrades:0,cases:0,gotLimited:false,joined:Date.now()},
  mis:{day:'',bets:0,big:0,battle:0,claimed:[]}};
const S=Object.assign(structuredClone(DEF),store.get('state',{}));
for(const k of ['profile','stats','mis'])S[k]=Object.assign(structuredClone(DEF[k]),S[k]||{});
S.inv=(S.inv||[]).filter(x=>ITEM[x.id]);
const save=()=>store.set('state',S);
const today=new Date().toDateString();
if(S.mis.day!==today)S.mis={day:today,bets:0,big:0,battle:0,claimed:[]};
const lvlOf=w=>Math.floor(Math.sqrt(w/250));
const xpAt=l=>l*l*250;
const lvl=()=>lvlOf(S.stats.wagered);

/* ---------- toast & confetti ---------- */
function toast(msg,kind,art){
  const t=document.createElement('div');t.className='toast '+(kind||'');t.innerHTML=(art?itemSvg(art):'')+`<span>${msg}</span>`;$('#toasts').appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),320)},2800);
}
const FX={c:null,x:null,parts:[],raf:0};
function confetti(x=innerWidth/2,y=innerHeight/3,n=140){
  if(REDUCED)return;
  if(!FX.c){FX.c=$('#fx');FX.x=FX.c.getContext('2d')}
  const d=Math.min(2,devicePixelRatio||1);FX.c.width=innerWidth*d;FX.c.height=innerHeight*d;FX.x.setTransform(d,0,0,d,0,0);
  const cols=['#3B7BFF','#F5B83D','#2FD38A','#FF4D6A','#8B5CF6','#E8EDF8'];
  for(let i=0;i<n;i++)FX.parts.push({x,y,vx:(rnd()-.5)*14,vy:-rnd()*13-4,r:rnd()*6.3,vr:(rnd()-.5)*.35,c:pick(cols),w:5+rnd()*6,h:3+rnd()*4,life:0});
  if(!FX.raf)FX.raf=requestAnimationFrame(fxLoop);
}
function fxLoop(){
  const c=FX.x;c.clearRect(0,0,innerWidth,innerHeight);
  FX.parts=FX.parts.filter(p=>p.life<150&&p.y<innerHeight+20);
  FX.parts.forEach(p=>{p.life++;p.vy+=.32;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;c.save();c.translate(p.x,p.y);c.rotate(p.r);c.globalAlpha=Math.max(0,1-p.life/150);c.fillStyle=p.c;c.fillRect(-p.w/2,-p.h/2,p.w,p.h);c.restore()});
  FX.raf=FX.parts.length?requestAnimationFrame(fxLoop):0;
}

/* ---------- avatars ---------- */
function avatar(u,s=30){
  const inner=u.item&&ITEM[u.item]?itemSvg(u.item):`<b>${esc((u.name||'?')[0].toUpperCase())}</b>`;
  return `<span class="avt fr-${u.frame||'none'}" style="--h:${u.hue??220};--s:${s}px">${inner}</span>`;
}
const me=()=>S.user?{name:S.user.name,hue:S.profile.hue,frame:S.profile.frame,item:S.profile.avItem,lvl:lvl(),me:1}:{name:'Guest',hue:220};
const NAMES=['PixelMarlin','rook_sprint','LunaTrades','KrispyKoi','VaultVibes','neonpine','Tradezilla','mossyfox','Bricktopia','coolerjack','SableRun','OrbitOllie','ZestZebra','quietotter','HexHarbor','Driftwood99','EmberLatch','tidepool_kai','MintCondition','RivetRaven','gl1tchgarden','NovaNibbles','ParcelPilot','frostbyte_7'];
const BIOS=['Battle me on Royal, 2v2 only','Collecting every Valkyrie in the game','Upgrader addict. Send help.','Crash cash-out at 2× gang','Trading since day one','Dominus hunter, 2 so far','Daily case enjoyer','mines on 3, always'];
function bot(name){
  const h=hash(name);
  return{name,hue:h%360,frame:['none','none','none','gold','neon','prism'][h%6],item:h%3===0?CAT[(h>>3)%CAT.length].id:null,lvl:4+h%58,bio:BIOS[h%BIOS.length],banner:['aurora','ocean','sunset','ember','matrix','royal'][(h>>5)%6],bot:1};
}

/* ---------- balance, bets, inventory ---------- */
let shown=S.bal;
function setBal(v){
  const prev=S.bal;S.bal=Math.max(0,r2(v));save();
  const el=$('#bal'),box=$('#balbox'),from=shown,to=S.bal,t0=performance.now();
  box.classList.remove('bump','dip');void box.offsetWidth;box.classList.add(to>=prev?'bump':'dip');
  (function step(t){const p=Math.min(1,(t-t0)/550),e=1-Math.pow(1-p,3);shown=from+(to-from)*e;el.textContent=fmt(shown);if(p<1)requestAnimationFrame(step)})(t0);
}
function take(a){
  if(!S.user){openLogin();return false}
  if(!(a>0)){toast('Enter an amount above 0.','loss');return false}
  if(a>S.bal+1e-9){toast('Not enough Rodux. Claim bonus Rodux in Rewards, or sell some items.','loss');return false}
  setBal(S.bal-a);return true;
}
function pay(a){if(a>0)setBal(S.bal+a)}
function bonus(a){if(!(a>0))return;S.lock=r2((S.lock||0)+a);pay(a)}
function settle(game,bet,mult,payout,o={}){
  const st=S.stats,before=lvl();
  st.bets++;st.wagered=r2(st.wagered+bet);if(S.lock>0)S.lock=Math.max(0,r2(S.lock-bet));if(payout>bet)st.wins++;
  if(mult>st.bestMult&&payout>0){st.bestMult=r2(mult);st.bestGame=game}
  S.mis.bets++;if(mult>=5)S.mis.big=1;
  const after=lvl();
  if(after>before){const reward=after*50;bonus(reward);toast(`Level ${after} reached. +${fmt0(reward)} Rodux`,'gold');confetti(innerWidth-160,60,80)}
  save();
  addFeed({u:me(),game,bet,mult,payout,me:1});
  if(payout>bet&&!o.quiet)toast(`+${fmt(payout-bet)} Rodux on ${GAMES[game].n}`,'win');
  drawWho();
}
function addItem(id,src){
  const it={u:uid(),id,s:ITEM[id].r==='limited'?ri(1,500):0,t:Date.now()};
  S.inv.unshift(it);
  if(!S.stats.bestDrop||ITEM[id].v>ITEM[S.stats.bestDrop].v)S.stats.bestDrop=id;
  if(ITEM[id].r==='limited')S.stats.gotLimited=true;
  save();drawInvCount();
  pushDrop({u:me(),id,src:src||'Case',me:1});
  return it;
}
function sellItems(uids,quiet){
  const set=new Set(uids);let sum=0;
  S.inv=S.inv.filter(x=>{if(set.has(x.u)){sum+=ITEM[x.id].v;return false}return true});
  S.profile.showcase=S.profile.showcase.filter(u=>!set.has(u));
  if(sum>0){pay(r2(sum));if(!quiet)toast(`Sold ${set.size} item${set.size>1?'s':''} for ${fmt(sum)} Rodux`,'win')}
  save();drawInvCount();return sum;
}
const invVal=()=>S.inv.reduce((a,x)=>a+ITEM[x.id].v,0);
function drawInvCount(){const n=$('#invn');if(n){n.textContent=S.inv.length;n.hidden=!S.inv.length}}

/* ---------- bet field helpers ---------- */
function betField(id='amt'){
  return `<label class="fld"><span>Bet amount</span><div class="amt">${chip(16)}<input id="${id}" type="number" min="1" step="1" inputmode="numeric" value="${S.lastBet}"><button type="button" data-m="0.5">½</button><button type="button" data-m="2">2×</button><button type="button" data-m="max">Max</button></div></label>`;
}
function wireBet(root){
  $$('.amt button[data-m]',root).forEach(b=>b.onclick=()=>{
    const i=b.parentElement.querySelector('input');let v=+i.value||0;
    v=b.dataset.m==='max'?Math.floor(S.bal):Math.max(1,Math.floor(v*+b.dataset.m));i.value=v;i.dispatchEvent(new Event('input'));
  });
}
const getBet=(id='amt')=>{const v=Math.floor(+document.getElementById(id).value||0);if(v>0){S.lastBet=v}return v};
const lockBet=(on,root)=>$$('.amt input,.amt button',root).forEach(e=>e.disabled=on);
function seg(id,opts,cur){return `<div class="seg" id="${id}" role="group">${opts.map(([v,l])=>`<button type="button" data-v="${v}" class="${String(v)===String(cur)?'on':''}">${l}</button>`).join('')}</div>`}
function wireSeg(el,cb){$$('button',el).forEach(b=>b.onclick=()=>{if(b.disabled)return;$$('button',el).forEach(x=>x.classList.toggle('on',x===b));cb(b.dataset.v)})}
const head=(id,desc,rtp)=>`<div class="ghead"><div><div class="crumb"><button data-go="home">Casino</button> / Originals</div><h2>${GAMES[id].n}</h2><p>${desc}</p></div><span class="rtp">${ic('shield',14,2)} RTP ${rtp}</span></div>`;
const resultBox=(big,small)=>`<div class="result"><div><b>${big}</b><span>${small}</span></div></div>`;

/* ---------- animated market background ---------- */
(function bgfx(){
  // A live market chart behind everything, in the spirit of TradingView's home page: a dotted grid,
  // two soft glows, and one price line that keeps drawing itself to the right with a ticking label.
  const cv=$('#bgfx'),ctx=cv.getContext('2d');let W=0,H=0,dpr=1,grid=null;
  function size(){dpr=Math.min(1.5,devicePixelRatio||1);W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
    grid=document.createElement('canvas');grid.width=W*dpr;grid.height=H*dpr;const g=grid.getContext('2d');g.scale(dpr,dpr);g.fillStyle='rgba(255,255,255,.07)';
    for(let x=16;x<W;x+=28)for(let y=16;y<H;y+=28)g.fillRect(x,y,1,1)}
  size();addEventListener('resize',size);
  const N=150;let px=[],vel=0,val=100;for(let i=0;i<N;i++){vel=vel*.9+(rnd()-.47)*1.1;val+=vel;px.push(val)}
  let ma=px.map((_,i)=>{const s=px.slice(Math.max(0,i-12),i+1);return s.reduce((a,b)=>a+b,0)/s.length});
  let off=0,last=0,lo=0,hi=1;
  const smooth=(arr,xf,yf)=>{ctx.moveTo(xf(0),yf(arr[0]));for(let i=1;i<arr.length-1;i++){const xc=(xf(i)+xf(i+1))/2,yc=(yf(arr[i])+yf(arr[i+1]))/2;ctx.quadraticCurveTo(xf(i),yf(arr[i]),xc,yc)}ctx.lineTo(xf(arr.length-1),yf(arr[arr.length-1]))};
  function frame(t){
    requestAnimationFrame(frame);
    if(document.hidden||t-last<33)return;last=t;
    if(S.prefs&&S.prefs.bg===false){ctx.clearRect(0,0,W,H);return}
    const step=W/(N-30);
    if(!REDUCED){off+=.32;while(off>=step){off-=step;px.shift();vel=vel*.9+(rnd()-.47)*1.1;val=px[px.length-1]+vel;px.push(val);
      const s=px.slice(-13);ma.shift();ma.push(s.reduce((a,b)=>a+b,0)/s.length)}}
    const mn=Math.min(...px),mx=Math.max(...px);lo+=(mn-lo)*.05;hi+=(mx-hi)*.05;if(hi-lo<1)hi=lo+1;
    const xf=i=>i*step-off,yf=v=>H*.86-(v-lo)/(hi-lo)*H*.5;
    ctx.clearRect(0,0,W,H);
    [[.82,.08,W*.55,'41,98,255',.22],[.08,.95,W*.45,'156,107,255',.12]].forEach(([gx,gy,r,c,a],i)=>{
      const x=(gx+Math.sin(t/12000+i*2)*.04)*W,y=(gy+Math.cos(t/14000+i)*.04)*H,g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,`rgba(${c},${a})`);g.addColorStop(1,`rgba(${c},0)`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)});
    if(grid)ctx.drawImage(grid,0,0,W,H);
    // area
    ctx.beginPath();smooth(px,xf,yf);ctx.lineTo(xf(N-1),H);ctx.lineTo(xf(0),H);ctx.closePath();
    const ag=ctx.createLinearGradient(0,H*.3,0,H);ag.addColorStop(0,'rgba(41,98,255,.20)');ag.addColorStop(1,'rgba(41,98,255,0)');ctx.fillStyle=ag;ctx.fill();
    // moving average
    ctx.beginPath();smooth(ma,xf,yf);ctx.strokeStyle='rgba(156,107,255,.28)';ctx.lineWidth=1.2;ctx.setLineDash([4,6]);ctx.stroke();ctx.setLineDash([]);
    // price line
    ctx.beginPath();smooth(px,xf,yf);const lg=ctx.createLinearGradient(0,0,W,0);lg.addColorStop(0,'rgba(41,98,255,0)');lg.addColorStop(.45,'rgba(41,98,255,.55)');lg.addColorStop(1,'rgba(120,170,255,1)');
    ctx.strokeStyle=lg;ctx.lineWidth=2;ctx.shadowColor='rgba(41,98,255,.9)';ctx.shadowBlur=16;ctx.stroke();ctx.shadowBlur=0;
    // last price: dashed level, pulsing head, label
    const k=Math.min(N-1,Math.floor((W*.78+off)/step)),hx=xf(k),hy=yf(px[k]),up=px[k]>=px[k-1];
    ctx.strokeStyle='rgba(120,170,255,.25)';ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(W,hy);ctx.stroke();ctx.setLineDash([]);
    const pu=(t/1100)%1;ctx.fillStyle='#8DB6FF';ctx.beginPath();ctx.arc(hx,hy,3.5,0,7);ctx.fill();
    ctx.strokeStyle=`rgba(141,182,255,${(1-pu)*.7})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(hx,hy,4+pu*18,0,7);ctx.stroke();
    const lbl=(px[k]*12.34).toFixed(2),tw=ctx.measureText(lbl).width+16;ctx.font='600 11px Manrope,system-ui,sans-serif';
    ctx.fillStyle=up?'rgba(38,166,154,.9)':'rgba(239,83,80,.9)';ctx.beginPath();ctx.roundRect?ctx.roundRect(W-tw-10,hy-10,tw,20,5):ctx.rect(W-tw-10,hy-10,tw,20);ctx.fill();
    ctx.fillStyle='#fff';ctx.fillText(lbl,W-tw-2,hy+4);
  }
  requestAnimationFrame(frame);
})();

/* ---------- router ---------- */
const PAGES={};
let cleanup=null,cur='home';
const NAVMAP={case:'cases',battle:'battles',slot:'slots',article:'news'};
function go(v,p){
  if(!PAGES[v])v='home';
  if(cleanup){try{cleanup()}catch(e){console.error(e)}cleanup=null}
  cur=v;closeMenu();
  const main=$('#view');main.classList.remove('enter');main.innerHTML='<div class="page"></div>';
  PAGES[v](main.firstChild,p);
  void main.offsetWidth;main.classList.add('enter');main.scrollTop=0;
  const key=NAVMAP[v]||v;$$('[data-go]').forEach(a=>{if(a.closest('#view'))return;a.classList.toggle('on',a.dataset.go===key)});
  $('#app').classList.remove('chat-open','nav-open');
}
document.addEventListener('click',e=>{
  const u=e.target.closest('[data-user]');if(u){openUser(u.dataset.user);return}
  const g=e.target.closest('[data-go]');if(g&&!g.disabled){go(g.dataset.go,g.dataset.p);return}
  const o=e.target.closest('[data-open]');if(o){({fair:openFair,login:openLogin,rules:openRules})[o.dataset.open]()}
});

/* ---------- feed (live bets) ---------- */
const FEED=[];
function botBet(){
  const game=pick([...ORIG,'cases','battles','upgrader','slots','predictions','stocks']),bet=pick([5,10,10,25,25,50,100,250,500]);
  const r=rnd();let mult=0;
  if(r<.48)mult=0;else if(r<.82)mult=1.1+rnd()*1.4;else if(r<.96)mult=2.5+rnd()*6;else mult=9+rnd()*rnd()*120;
  mult=r2(mult);return{u:bot(pick(NAMES)),game,bet,mult,payout:r2(bet*mult),t:clock()};
}
for(let i=0;i<16;i++)FEED.push(botBet());
let feedTab='all';
const feedRow=(f,isNew)=>`<div class="frow${isNew?' new':''}${f.me?' me':''}"><span class="g">${ic(f.game,15)}${GAMES[f.game].n}</span><span class="u" data-user="${esc(f.u.name)}">${avatar(f.u,22)}${esc(f.u.name)}</span><span class="t">${f.t}</span><span class="b">${chip(12)}${fmt(f.bet)}</span><span class="m">${f.mult.toFixed(2)}×</span><span class="p ${f.payout>f.bet?'w':'l'}">${chip(12)}${fmt(f.payout)}</span></div>`;
const feedHead=`<div class="frow hd"><span>Game</span><span>Player</span><span class="t">Time</span><span class="b">Bet</span><span class="m">Multi</span><span class="p">Payout</span></div>`;
const feedFilter=f=>feedTab==='all'||(feedTab==='big'&&f.mult>=5)||(feedTab==='me'&&f.me);
function drawFeed(){const el=$('#feed');if(!el)return;const rows=FEED.filter(feedFilter).slice(0,10);el.innerHTML=feedHead+(rows.length?rows.map(f=>feedRow(f)).join(''):`<p class="note" style="padding:14px 10px">Your bets show up here once you play.</p>`)}
function addFeed(f){
  f.t=f.t||clock();FEED.unshift(f);FEED.length=Math.min(FEED.length,80);
  const el=$('#feed');
  if(el&&feedFilter(f)){if(el.querySelector('.note'))drawFeed();else{el.querySelector('.hd').insertAdjacentHTML('afterend',feedRow(f,true));const rows=el.querySelectorAll('.frow:not(.hd)');if(rows.length>10)rows[rows.length-1].remove()}}
  if(typeof drawBoard==='function')drawBoard();
}
setInterval(()=>addFeed(botBet()),2100);

/* ---------- live drops ticker ---------- */
function pushDrop(d){
  const tr=$('#tktrack');if(!tr)return;const i=ITEM[d.id];
  tr.insertAdjacentHTML('afterbegin',`<div class="tk in r-${i.r}" data-user="${esc(d.u.name)}" title="${esc(i.n)} · ${esc(d.u.name)}">${itemSvg(d.id)}<div><b>${esc(i.n)}</b><span>${chip(10)}${fmt(i.v)}</span></div><div class="who">${avatar(d.u,24)}<span style="color:var(--fg)">${esc(d.u.name)}</span></div></div>`);
  while(tr.children.length>26)tr.lastElementChild.remove();
}
function botDrop(){const c=rnd()<.7?pick(SHOP.slice(0,4)):pick(SHOP);return{u:bot(pick(NAMES)),id:pickFrom(c),src:c.n}}
for(let i=0;i<20;i++)pushDrop(botDrop());
$$('#tktrack .tk').forEach(t=>t.classList.remove('in'));
(function tick(){setTimeout(()=>{pushDrop(botDrop());tick()},ri(1600,3400))})();

/* ---------- chat ---------- */
const LINES=['gg on that 12x crash','just pulled Poisoned Horns from the Vault','who wants a 2v2 royal battle','upgrader took my Redvalk again','crazy mode is so fun, lowest wins','mines with 3 is my comfort zone','towers expert is actual pain','dice over 50 all day','blackjack dealer keeps hitting 21','daily case gave me a Party Fedora','finally climbed all 8 floors','roulette green twice in a row??','new profile banner looks clean','anyone else saving for Empire Reserve','cash out early, trust me','shared mode battles are chill'];
function addChat(m){
  const l=$('#clist'),d=document.createElement('div');d.className='msg'+(m.me?' me':'')+(m.sys?' sys':'');
  const u=m.u||bot(m.name);
  d.innerHTML=`<div class="msg-h">${m.sys?`<span class="avt" style="--h:220;--s:22px"><b>T</b></span>`:avatar(u,22)}<b ${m.sys?'':`data-user="${esc(u.name)}"`}>${esc(u.name)}</b>${m.sys?'':`<span class="lv${u.lvl>=30?' g':''}">${u.lvl}</span>`}<time>${clock()}</time></div><p>${esc(m.text)}</p>`;
  l.appendChild(d);while(l.children.length>60)l.firstChild.remove();l.scrollTop=l.scrollHeight;
}
for(let i=0;i<7;i++)addChat({name:pick(NAMES),text:pick(LINES)});
(function loop(){setTimeout(()=>{addChat({name:pick(NAMES),text:pick(LINES)});$('#online').textContent=fmt0(1200+ri(0,180));loop()},ri(4000,9000))})();
$('#cform').onsubmit=e=>{e.preventDefault();if(!S.user){openLogin();return}const v=$('#cin').value.trim();if(!v)return;addChat({u:me(),text:v,me:1});$('#cin').value=''};
$('#chatbtn').onclick=()=>{const a=$('#app');innerWidth<=1240?a.classList.toggle('chat-open'):a.classList.toggle('nochat')};
$('#chatx').onclick=()=>$('#app').classList.remove('chat-open');

/* ---------- modal & menu ---------- */
function modal(html,o={}){
  const host=$('#modal');
  host.innerHTML=`<div class="scrim"><div class="modal ${o.cls||''}" role="dialog" aria-modal="true"><button class="ib close" aria-label="Close">${ic('x',18,2)}</button>${html}</div></div>`;
  const close=()=>{host.innerHTML='';document.removeEventListener('keydown',esck);o.onClose&&o.onClose()};
  const esck=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',esck);
  $('.close',host).onclick=close;$('.scrim',host).onclick=e=>{if(e.target.classList.contains('scrim'))close()};
  host.onclick=e=>{if(e.target.closest('[data-go],[data-user]'))close()};
  return{root:$('.modal',host),close};
}
function closeMenu(){$('#menu').innerHTML=''}
function openMenu(btn){
  const r=btn.getBoundingClientRect(),m=$('#menu');
  if(m.innerHTML){closeMenu();return}
  const L=lvl();
  m.innerHTML=`<div class="pop" style="top:${r.bottom+8}px;right:${Math.max(12,innerWidth-r.right)}px"><div class="ph2">${avatar(me(),38)}<div><b>${esc(S.user.name)}</b><span>Level ${L} · ${fmt0(S.stats.wagered)} wagered</span></div></div><hr>
    <button data-go="profile">${ic('profile',17)}Profile</button><button data-go="inventory">${ic('inventory',17)}Inventory <span class="lv" style="margin-left:auto">${S.inv.length}</span></button><button data-wallet="deposit">${ic('tag',17)}Wallet</button><button data-inv="site">${ic('inventory',17)}Trade Empire limiteds</button><button data-go="prefs">${ic('edit',17)}Settings</button><button data-go="support">${ic('chat',17)}Support</button><button data-go="settings">${ic('shield',17)}Responsible play</button><button data-go="rewards">${ic('rewards',17)}Rewards</button><hr>
    <button id="lo">${ic('logout',17)}Sign out</button></div>`;
  $('#lo',m).onclick=()=>{if(typeof WAPI!=='undefined'&&WAPI.live)fetch('/api/auth/logout',{method:'POST'}).catch(()=>{});S.user=null;save();drawWho();closeMenu();toast('Signed out.');if(cur==='profile')go('home')};
  setTimeout(()=>document.addEventListener('click',function h(e){if(!e.target.closest('.pop')&&e.target.closest('#who')!==btn.parentElement){closeMenu()}if(!$('#menu').innerHTML)document.removeEventListener('click',h)}),0);
}
function drawWho(){
  const w=$('#who');if(!w)return;
  w.innerHTML=S.user?`<button class="user" id="ubtn" aria-label="Account menu">${avatar(me(),32)}<span class="nm"><b>${esc(S.user.name)}</b><span>Level ${lvl()}</span></span></button>`:`<button class="signin" data-open="login">Sign in</button>`;
  if(S.user)$('#ubtn').onclick=e=>{e.stopPropagation();openMenu($('#ubtn'))};
  $('#cin').placeholder=S.user?'Say something…':'Sign in to chat';
}

/* ---------- login (Roblox bio verification) ---------- */
const WORDS=['amber','harbor','otter','quiet','copper','lantern','maple','orbit','velvet','cobalt','meadow','tundra','pixel','summit','ember','willow','fable','granite'];
function openLogin(){if(S.user){go('profile');return}showGate('in')}
function openFair(){
  modal(`<span class="eyebrow">Fairness</span><h3>How results are made</h3><p>Every outcome comes from a cryptographic random number generator, never from your bet size or history. RTP is the share of Rodux paid back over many rounds.</p>
  <ul class="rtp-list">${[['Crash','99%'],['Mines','99%'],['Dice','99%'],['Plinko','99%'],['Blackjack','99.4%'],['Towers','98%'],['Coinflip','98%'],['Cups','96%'],['Roulette','93.3%'],['Cases','92%'],['Upgrader','95%'],['Battles','92%']].map(([a,b])=>`<li><span>${a}</span><b>${b}</b></li>`).join('')}</ul>
  <p class="fine">Prototype: results are generated in your browser. The live site should roll them on the server, publish a hashed seed before each round and reveal it after, so players can check every result.</p>`);
}
function openRules(){
  modal(`<span class="eyebrow">House rules</span><h3>How TradeBlacket works</h3><ul class="how" style="margin-bottom:0"><li>Rodux and limiteds move between Trade Empire and TradeBlacket from the Wallet on this site, while you're out of the game. You can withdraw up to the Rodux you deposited.</li><li>Never sell or buy Rodux or items for real money.</li><li>Bonus Rodux from daily rewards, missions, codes and level-ups must be wagered once before it can be withdrawn.</li><li>You must be 18 or older to play.</li><li>Be kind in chat. Scams, begging and spam get muted.</li></ul>`);
}

/* ---------- public profile modal ---------- */
function openUser(name){
  if(S.user&&name===S.user.name){go('profile');return}
  if(name==='TradeBlacket')return;
  const u=bot(name),h=hash(name),wag=2000+h%180000,bets=200+h%9000;
  const show=[0,1,2].map(i=>CAT[(h>>(i*3))%CAT.length].id);
  modal(`<div class="banner bn-${u.banner}" style="height:110px"></div>
  <div class="prof-b" style="margin-top:-40px;padding-bottom:12px">${avatar(u,76)}<div class="grow"><h2 style="font-size:20px">${esc(name)} <span class="lv${u.lvl>=30?' g':''}">${u.lvl}</span></h2><p>${esc(u.bio)}</p></div></div>
  <div style="padding:0 22px 22px" class="mstack">
    <div class="stats3"><div class="stat"><span>Wagered</span><b>${chip(14)}${fmt0(wag)}</b></div><div class="stat"><span>Bets</span><b>${fmt0(bets)}</b></div><div class="stat"><span>Best multi</span><b>${(5+h%400/7).toFixed(2)}×</b></div></div>
    <span class="eyebrow">Showcase</span><div class="igrid" style="grid-template-columns:repeat(3,minmax(0,1fr))">${show.map(id=>itemCard(id)).join('')}</div>
  </div>`,{cls:'prof-m'});
}

/* ---------- shell boot ---------- */
$('#chipico').innerHTML=chip(18);
$('#bal').textContent=fmt(S.bal);
const NAVDEF=[
  ['Play',[['home','Home','home'],['cases','Cases','cases'],['battles','Case Battles','battles','live'],['upgrader','Upgrader','upgrader'],['flip','Limited Flip','coinflip','new'],['predictions','Predictions','predictions','new'],['stocks','Stocks','stocks','new'],['market','Marketplace','market']]],
  ['Casino',[['slots','Slots','slots','wait'],...ORIG.map(k=>[k,GAMES[k].n,k,['baccarat','limbo','hilo','keno','wheel'].includes(k)?'new':''])]],
  ['Account',[['wallet','Wallet','tag'],['refer','Refer a friend','rewards'],['giftcard','Gift card','gem'],['tradeempire','Trade Empire','trend'],['prefs','Settings','edit'],['support','Support','chat'],['docs','Docs','news'],['settings','Responsible play','shield'],['rewards','Rewards','rewards'],['inventory','Inventory','inventory'],['profile','Profile','profile'],['news','News','news']]]
];
$('#nav').innerHTML=NAVDEF.map(([h,items])=>`<h6>${h}</h6>`+items.map(([k,l,icn,t])=>`<button data-go="${k}" title="${l}">${ic(icn,19)}<span>${l}</span>${t?`<i class="tg ${t}">${t==='live'?'Live':t==='wait'?'Waitlist':'New'}</i>`:''}</button>`).join('')).join('');
$('#burger').onclick=()=>$('#app').classList.toggle('nav-open');
$('#slimbtn').onclick=()=>{$('#app').classList.toggle('slim');store.set('slim',$('#app').classList.contains('slim'))};
if(store.get('slim',false))$('#app').classList.add('slim');
document.addEventListener('click',e=>{const a=$('#app');if(a.classList.contains('nav-open')&&!e.target.closest('#side,#burger'))a.classList.remove('nav-open')});
/* global search */
(function(){
  const inp=$('#gsearch');if(!inp)return;
  const run=()=>{
    const q=inp.value.trim().toLowerCase(),m=$('#menu');if(!q){m.innerHTML='';return}
    const res=[];
    [...ORIG,'slots','cases','battles','upgrader','market','predictions','rewards','news'].forEach(k=>{if(GAMES[k]?.n.toLowerCase().includes(q)||k.includes(q))res.push({go:k,l:GAMES[k]?.n||k,i:k,s:'Page'})});
    SHOP.forEach(c=>{if(c.n.toLowerCase().includes(q))res.push({go:'case',p:c.id,l:c.n,i:'cases',s:'Case · '+fmt(c.price)})});
    CAT.forEach(it=>{if(it.n.toLowerCase().includes(q))res.push({go:'market',p:it.id,l:it.n,art:it.id,s:'Item · '+fmt(it.v)})});
    const r=inp.getBoundingClientRect();
    m.innerHTML=`<div class="pop" style="top:${r.bottom+6}px;left:${r.left}px;width:${Math.max(280,r.width)}px;max-height:60vh;overflow-y:auto">${res.slice(0,10).map(x=>`<button data-go="${x.go}" ${x.p?`data-p="${x.p}"`:''}>${x.art?`<span style="width:22px;height:22px;display:grid">${itemSvg(x.art)}</span>`:ic(ICON[x.i]?x.i:'search',17)}<span style="flex:1;text-align:left">${esc(x.l)}</span><span class="note">${x.s}</span></button>`).join('')||'<p class="note" style="padding:10px">No matches.</p>'}</div>`;
  };
  inp.oninput=run;inp.onfocus=run;
  document.addEventListener('click',e=>{if(!e.target.closest('#menu,.search-top')&&$('#menu .pop')&&!$('#menu .ph2'))closeMenu()});
  document.addEventListener('click',e=>{if(e.target.closest('#menu [data-go]'))inp.value=''});
})();
$('.logo').addEventListener('keydown',e=>{if(e.key==='Enter')go('home')});
drawWho();drawInvCount();
function drawBalPop(){
  const p=$('#balpop');if(!p)return;const lim=invVal(),stk=typeof posVal==='function'?posVal():0;
  p.innerHTML=`<div class="kv"><span>Rodux</span><b>${chip(14)}${fmt(S.bal)}</b></div><div class="kv"><span>Limiteds · ${S.inv.length} item${S.inv.length===1?'':'s'}</span><b>${chip(14)}${fmt(lim)}</b></div>${stk>0?`<div class="kv"><span>Stocks</span><b>${chip(14)}${fmt(stk)}</b></div>`:''}${WAPI&&WAPI.me&&WAPI.me.itemValue?`<div class="kv"><span>Trade Empire limiteds</span><b>${HEX(14)}${fmt0(WAPI.me.itemValue)}</b></div>`:''}<div class="kv tot"><span>Total worth</span><b>${chip(15)}${fmt(S.bal+lim+stk)}</b></div><p class="note">Limiteds count at their value, not their latest sale price.</p>`;
}
$('#wallet').addEventListener('mouseenter',drawBalPop);$('#wallet').addEventListener('focusin',drawBalPop);
