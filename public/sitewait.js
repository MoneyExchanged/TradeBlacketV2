'use strict';
/* =========================================================
   The site waitlist. TradeBlacket is invite-only: after signing in, players without access see
   this screen instead of the site. They join the list and keep their place (#1 is first in),
   and get in when an admin lets them in or with a site access code. The server enforces the same
   rule, so nothing can be played or deposited from behind this screen.
   ========================================================= */
const SW={s:null,poll:0};
async function swLoad(){
  if(WAPI.live){const r=await api('/api/site-waitlist');if(r.ok)SW.s=r.j;return SW.s}
  const L=S.siteWl||{};SW.s={gate:true,access:!!L.access,joined:!!L.joined,place:L.joined?1:null,ahead:L.joined?0:null,waiting:L.joined&&!L.access?1:0,total:L.joined?1:0,admin:false};return SW.s;
}
function swClose(welcome){
  const el=$('#sitewait');if(el){el.classList.add('out');setTimeout(()=>el.remove(),450)}
  clearInterval(SW.poll);SW.poll=0;document.body.classList.remove('sw-open');
  if(welcome){toast("You're in. Welcome to TradeBlacket.",'win');confetti(innerWidth/2,innerHeight/3,120)}
}
async function siteGate(){
  if(!S.user){swClose();return}
  // Wait until the sign-in screen is closed, so the player sees "Signed in" first.
  if($('#gate')&&$('#gate').innerHTML.trim()){SW.wait=1;return}
  await swLoad();const s=SW.s;if(s&&s.admin)swAdminNav();
  if(!s||s.gate===false||s.access){swClose();return}
  drawSiteWait();
  if(!SW.poll)SW.poll=setInterval(async()=>{await swLoad();if(SW.s&&SW.s.access)swClose(true);else drawSiteWait()},20000);
}
function drawSiteWait(){
  let el=$('#sitewait');
  if(!el){el=document.createElement('div');el.id='sitewait';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','TradeBlacket waitlist');document.body.appendChild(el);document.body.classList.add('sw-open')}
  const s=SW.s,lg=$('.side-h .logo'),mark=lg?lg.outerHTML.replace(/ data-go="home" role="button" tabindex="0"/,''):'';
  el.innerHTML=`<canvas class="sw-cv" aria-hidden="true"></canvas><div class="sw-wrap">
    <div class="sw-top">${mark}<span class="gx-age">18+</span></div>
    <div class="sw-main">
      <div class="sw-copy">
        <h1>${s.joined?"You're on the list.":'TradeBlacket is invite-only.'}</h1>
        <p>${s.joined?`We let players in in the order they joined. Keep this tab open or come back later: the site opens for you as soon as it's your turn.`:`We're letting players in a few at a time. Join the waitlist to hold your place, or enter an access code if you have one.`}</p>
        <dl class="wl-stats"><div><dt>Waiting now</dt><dd>${fmt0(s.waiting||0)}</dd></div><div><dt>Joined so far</dt><dd>${fmt0(s.total||0)}</dd></div></dl>
        <form class="wl-code" id="swc"><label for="swci">Have an access code?</label><div><input id="swci" class="txt" placeholder="TB-XXXXX-XXXXX" autocomplete="off" spellcheck="false" maxlength="16"><button class="cta ghost inline">Enter</button></div></form>
        ${WAPI.live?'':'<p class="note">Preview: the waitlist is kept in this browser. Any code in the TB-XXXXX-XXXXX format works here.</p>'}
      </div>
      <div class="wl-place sw-card">
        <span class="sw-who">${avatar(me(),40)}<b>${esc(S.user.name)}</b></span>
        ${s.joined?`<span class="wl-big">#${fmt0(s.place)}</span><p>${s.ahead?`${fmt0(s.ahead)} ${s.ahead===1?'player is':'players are'} ahead of you.`:"Nobody is ahead of you. You're next in."}</p>`
          :`<span class="wl-big">#${fmt0((s.total||0)+1)}</span><p>is your place if you join now.</p><button class="cta inline" id="swj">Join the waitlist</button>`}
      </div>
    </div>
    <div class="sw-foot"><button id="swo">Sign out</button><button data-legal="tos">Terms of Service</button><span>Signed in as ${esc(S.user.name)}</span></div>
  </div>`;
  const j=$('#swj',el);if(j)j.onclick=async()=>{j.disabled=true;
    if(WAPI.live){const r=await api('/api/site-waitlist/join',{});if(!r.ok){j.disabled=false;return toast(r.j.error||'Could not join. Try again.','loss')}SW.s=r.j}
    else{S.siteWl={...(S.siteWl||{}),joined:true};save();await swLoad()}
    toast(`You're #${SW.s.place} on the waitlist.`,'gold');drawSiteWait()};
  $('#swc',el).onsubmit=async e=>{e.preventDefault();const code=$('#swci',el).value.trim();if(!code)return;
    if(WAPI.live){const r=await api('/api/site-waitlist/redeem',{code});if(!r.ok)return toast(r.j.error,'loss');SW.s=r.j}
    else{if(!/^(TB)?[A-Z2-9]{10}$/i.test(code.replace(/[^a-z0-9]/gi,'')))return toast('Enter the full access code, like TB-ABCDE-FGHJK.','loss');S.siteWl={joined:true,access:true};save();await swLoad()}
    if(SW.s.access)swClose(true)};
  $('#swo',el).onclick=()=>{if(WAPI.live)fetch('/api/auth/logout',{method:'POST'}).catch(()=>{});S.user=null;save();drawWho();swClose();showGate('in')};
  swChart($('.sw-cv',el));
}
// A slow gold line behind the waitlist, same family as the sign-in page.
function swChart(cv){
  if(!cv||cv._on)return;cv._on=1;const ctx=cv.getContext('2d');let pts=[],v=.5;for(let i=0;i<90;i++){v+=(rnd()-.48)*.03;v=Math.min(.8,Math.max(.3,v));pts.push(v)}let off=0;
  (function f(){if(!cv.isConnected)return;requestAnimationFrame(f);const d=Math.min(2,devicePixelRatio||1),W=cv.offsetWidth,H=cv.offsetHeight;if(cv.width!==W*d){cv.width=W*d;cv.height=H*d}ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,W,H);
    const sg=W/80;off+=REDUCED?0:.3;if(off>sg){off-=sg;pts.shift();let n=pts[pts.length-1]+(rnd()-.47)*.03;pts.push(Math.min(.82,Math.max(.3,n)))}
    ctx.beginPath();pts.forEach((p,i)=>{const x=i*sg-off,y=H*.66+(1-p)*H*.32;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle='rgba(231,199,127,.8)';ctx.lineWidth=1.6;ctx.stroke();
    ctx.lineTo(W+sg,H);ctx.lineTo(0,H);ctx.closePath();const g=ctx.createLinearGradient(0,H*.5,0,H);g.addColorStop(0,'rgba(231,199,127,.10)');g.addColorStop(1,'rgba(231,199,127,0)');ctx.fillStyle=g;ctx.fill()})();
}

/* ---------- admin page: both waitlists ---------- */
PAGES.admin=(el,tab)=>{
  const isAdmin=(WAPI.me&&WAPI.me.admin)||(SW.s&&SW.s.admin);
  if(!isAdmin){el.innerHTML=`<div class="empty"><h3>Admins only</h3><p>This page is for the TradeBlacket team.</p></div>`;return}
  const t=tab==='slots'?'slots':'site';
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Admin</div><h2>Admin</h2><p>Let players in, make access codes and see who is waiting.</p></div></div>
    <div class="mk-tabs lx-seg${t==='slots'?' r':''}"><button data-go="admin" data-p="site" class="${t==='site'?'on':''}">Site waitlist</button><button data-go="admin" data-p="slots" class="${t==='slots'?'on':''}">Slots waitlist</button><i></i></div>
    <section class="wl-admin" id="adm"></section>`;
  if(WAPI.live)drawAdmin($('#adm',el),t);else $('#adm',el).innerHTML=`<div class="empty"><h3>Admin tools run on the live site</h3><p>Letting players in and making codes need the TradeBlacket server.</p></div>`;
};

// Check on load (after the boot screen) and whenever the signed-in player changes.
setTimeout(siteGate,1600);
function swAdminNav(){if($('#nav [data-go="admin"]'))return;const acc=[...$$('#nav h6')].find(h=>h.textContent==='Account');if(acc)acc.insertAdjacentHTML('afterend',`<button data-go="admin" title="Admin">${ic('shield',19)}<span>Admin</span></button>`)}
{const base=drawWho;drawWho=function(){base();const was=SW.user;SW.user=S.user&&S.user.name;if(was!==SW.user){if(!S.user)$$('#nav [data-go="admin"]').forEach(b=>b.remove());siteGate()}}}
// When the sign-in screen closes, run the check it was holding back.
{const g=$('#gate');if(g)new MutationObserver(()=>{if(SW.wait&&!g.innerHTML.trim()){SW.wait=0;siteGate()}}).observe(g,{childList:true})}
