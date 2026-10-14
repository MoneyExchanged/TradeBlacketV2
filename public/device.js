'use strict';
/* =========================================================
   One account per player. The browser keeps a random device id (cookie + localStorage) and works
   out a hash of the device's hardware and browser traits. Both go with every /api/ request in the
   X-TB-Device header; the server only keeps one-way hashes of them. It also remembers a referral
   code from a ?ref= link until the player signs up.
   ========================================================= */
const TBDEV=(()=>{
  const rd=k=>{try{return localStorage.getItem(k)}catch{return null}},wr=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
  const ck=/(?:^|;\s*)tb_dev=([0-9a-f]{32})/.exec(document.cookie||'');
  let id=(ck&&ck[1])||(/^[0-9a-f]{32}$/.test(rd('tb_dev')||'')?rd('tb_dev'):'');
  if(!id){const a=new Uint8Array(16);crypto.getRandomValues(a);id=[...a].map(b=>b.toString(16).padStart(2,'0')).join('')}
  wr('tb_dev',id);
  try{document.cookie=`tb_dev=${id}; Path=/; Max-Age=63072000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`}catch{}
  // Hardware and browser traits that stay the same when cookies are cleared or a new account is made.
  function traits(){
    const t=[navigator.platform,navigator.hardwareConcurrency,navigator.deviceMemory,navigator.maxTouchPoints,screen.width+'x'+screen.height+'x'+screen.colorDepth,devicePixelRatio,Intl.DateTimeFormat().resolvedOptions().timeZone,(navigator.languages||[]).join(',')];
    try{const c=document.createElement('canvas'),g=c.getContext('webgl')||c.getContext('experimental-webgl');if(g){const e=g.getExtension('WEBGL_debug_renderer_info');t.push(e?g.getParameter(e.UNMASKED_VENDOR_WEBGL)+'|'+g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),g.getParameter(g.MAX_TEXTURE_SIZE),(g.getSupportedExtensions()||[]).length)}}catch{}
    try{const c=document.createElement('canvas');c.width=220;c.height=40;const x=c.getContext('2d');x.textBaseline='top';x.font='16px Arial';x.fillStyle='#f60';x.fillRect(100,1,62,20);x.fillStyle='#069';x.fillText('TradeBlacket \u{1F3B2} 1.0',2,15);x.fillStyle='rgba(102,204,0,.7)';x.fillText('TradeBlacket \u{1F3B2} 1.0',4,17);t.push(c.toDataURL().slice(-120))}catch{}
    return t.join('~');
  }
  let hw='';
  const ready=(async()=>{try{const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(traits()));hw=[...new Uint8Array(d)].slice(0,16).map(b=>b.toString(16).padStart(2,'0')).join('')}catch{hw=''}})();
  // Referral links: tradeblacket.com/?ref=CODE. Kept until sign-up; removed from the address bar.
  try{const u=new URL(location.href),r=(u.searchParams.get('ref')||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(r.length===8){wr('tb_ref',r);u.searchParams.delete('ref');history.replaceState(null,'',u.pathname+(u.search||'')+u.hash)}}catch{}
  const header=()=>hw?`${id}.${hw}`:'';
  // Every same-site /api/ call carries the device header.
  const of=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(/^\/api\//.test(url)||url.startsWith(location.origin+'/api/')){await Promise.race([ready,new Promise(r=>setTimeout(r,400))]);const h=header();if(h){init={...init,headers:{...(init.headers||{}),'X-TB-Device':h}}}}
    return of(input,init);
  };
  return{id,header,ready,ref:()=>rd('tb_ref')||'',clearRef:()=>{try{localStorage.removeItem('tb_ref')}catch{}}};
})();
