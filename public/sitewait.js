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
  const L=S.siteWl||{};SW.s={gate:true,banned:L.banned?{reason:L.banned}:null,access:!!L.access&&!L.banned,joined:!!L.joined,place:L.joined?1:null,ahead:L.joined?0:null,waiting:L.joined&&!L.access?1:0,total:L.joined?1:0,admin:false};return SW.s;
}
function swClose(welcome){
  const el=$('#sitewait');if(el){el.classList.add('out');setTimeout(()=>el.remove(),450)}
  clearInterval(SW.poll);SW.poll=0;SW.on=0;SW.away=0;document.body.classList.remove('sw-open','sw-lock');
  if(welcome){toast("You're in. Welcome to TradeBlacket.",'win');confetti(innerWidth/2,innerHeight/3,120)}
}
async function siteGate(){
  if(!S.user){swClose();return}
  // Wait until the sign-in screen is closed, so the player sees "Signed in" first.
  if($('#gate')&&$('#gate').innerHTML.trim()){SW.wait=1;return}
  await swLoad();const s=SW.s;if(s&&s.admin)swAdminNav();
  if(!s||(!s.banned&&(s.gate===false||s.access))){swClose();return}
  SW.on=1;if(SW_FREE.includes(cur))SW.away=1;if(!SW.away)drawSiteWait();
  if(!SW.poll)SW.poll=setInterval(async()=>{await swLoad();if(SW.s&&SW.s.access&&!SW.s.banned)swClose(true);else if(!SW.away)drawSiteWait()},20000);
}
function drawSiteWait(){
  let el=$('#sitewait');
  if(!el){el=document.createElement('div');el.id='sitewait';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','TradeBlacket waitlist');document.body.appendChild(el)}
  document.body.classList.add('sw-open','sw-lock');
  const s=SW.s,lg=$('.side-h .logo'),mark=lg?lg.outerHTML.replace(/ data-go="home" role="button" tabindex="0"/,''):'';
  if(s.banned){el.innerHTML=`<div class="sw-wrap">
    <div class="sw-top">${mark}<span class="gx-age">18+</span></div>
    <div class="sw-main sw-ban">
      <div class="sw-copy">
        <h1>This account is banned.</h1>
        <p>${esc(String(s.banned.reason||'This account broke the Terms of Service').replace(/\.$/,''))}. TradeBlacket allows one account per player, so this account can no longer play, deposit, trade or join the waitlist.</p>
        <p>Your Rodux and limiteds are still yours. Bring them back to Trade Empire below. If you think this is a mistake, for example because you share a home network with another player, open a Support ticket.</p>
      </div>
      <div class="wl-place sw-card"><span class="sw-who">${avatar(me(),40)}<b>${esc(S.user.name)}</b></span>
        <button class="cta inline" id="swwr">Withdraw Rodux</button><button class="cta ghost inline" id="swwi">Withdraw limiteds</button><button class="cta ghost inline" id="swsup">Open a Support ticket</button></div>
    </div>
    <div class="sw-foot"><button id="swo">Sign out</button><button data-legal="tos">Terms of Service</button><button data-away="support">Support</button><button data-away="tradeempire">Trade Empire account</button><span>Signed in as ${esc(S.user.name)}</span></div></div>`;
    $('#swwr',el).onclick=()=>openWallet('withdraw');$('#swwi',el).onclick=()=>openInventory('site');
    $('#swsup',el).onclick=()=>swAway('support');
    $('#swo',el).onclick=swSignOut;return}
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
        ${s.joined?`<div class="sw-ref"><b>Invite friends</b><span>Get ${fmt0(REF_REWARD())} Rodux for every friend who signs up with your link and gets in.</span><button class="cta ghost inline" data-copy="${esc(refLink())}">Copy my invite link</button></div>`:''}
      </div>
    </div>
    <div class="sw-foot"><button id="swo">Sign out</button><button data-legal="tos">Terms of Service</button><button data-away="support">Support</button><button data-away="tradeempire">Trade Empire account</button><span>Signed in as ${esc(S.user.name)}</span></div>
  </div>`;
  const j=$('#swj',el);if(j)j.onclick=async()=>{j.disabled=true;
    if(WAPI.live){const r=await api('/api/site-waitlist/join',{});if(!r.ok){j.disabled=false;return toast(r.j.error||'Could not join. Try again.','loss')}SW.s=r.j}
    else{S.siteWl={...(S.siteWl||{}),joined:true};save();await swLoad()}
    toast(`You're #${SW.s.place} on the waitlist.`,'gold');drawSiteWait()};
  $('#swc',el).onsubmit=async e=>{e.preventDefault();const code=$('#swci',el).value.trim();if(!code)return;
    if(WAPI.live){const r=await api('/api/site-waitlist/redeem',{code});if(!r.ok)return toast(r.j.error,'loss');SW.s=r.j}
    else{if(!/^(TB)?[A-Z2-9]{10}$/i.test(code.replace(/[^a-z0-9]/gi,'')))return toast('Enter the full access code, like TB-ABCDE-FGHJK.','loss');S.siteWl={joined:true,access:true};save();await swLoad()}
    if(SW.s.access)swClose(true)};
  $('#swo',el).onclick=swSignOut;
  swChart($('.sw-cv',el));
}
// Support is the one page a player without access can open; any other page brings the screen back.
function swAway(page){SW.away=1;const el=$('#sitewait');if(el)el.remove();document.body.classList.remove('sw-open','sw-lock');go(page)}
document.addEventListener('click',e=>{const b=e.target.closest('#sitewait [data-away]');if(b)swAway(b.dataset.away)});
function swSignOut(){if(WAPI.live)fetch('/api/auth/logout',{method:'POST'}).catch(()=>{});S.user=null;save();drawWho();swClose();showGate('in')}
// The screen cannot be clicked away: if it is removed while the player has no access, it comes back,
// and moving to another page brings it back too. (The server refuses everything anyway.)
new MutationObserver(()=>{if(SW.on&&!SW.away&&S.user&&!$('#sitewait'))drawSiteWait()}).observe(document.body,{childList:true});
const SW_FREE=['support','tradeempire'];
{const g0=go;go=function(...a){if(SW.on&&S.user&&!SW_FREE.includes(a[0])){SW.away=0;drawSiteWait();return}if(SW.on&&SW_FREE.includes(a[0])){SW.away=1;const o=$('#sitewait');if(o)o.remove();document.body.classList.remove('sw-open','sw-lock')}return g0.apply(this,a)}}
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
  const tb=String(tab||''),t=['slots','bans'].includes(tb)?tb:tb.startsWith('players')?'players':'site';
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Admin</div><h2>Admin</h2><p>Let players in, make access codes and see who is waiting.</p></div></div>
    <div class="mk-tabs lx-seg adm-seg" style="--n:4;--i:${['site','slots','bans','players'].indexOf(t)}"><button data-go="admin" data-p="site" class="${t==='site'?'on':''}">Site waitlist</button><button data-go="admin" data-p="slots" class="${t==='slots'?'on':''}">Slots waitlist</button><button data-go="admin" data-p="bans" class="${t==='bans'?'on':''}">Bans</button><button data-go="admin" data-p="players" class="${t==='players'?'on':''}">Players</button><i></i></div>
    <section class="wl-admin" id="adm"></section>`;
  if(t==='players'){admPlayersTab($('#adm',el),tb.split(':')[1]||'');return}
  if(WAPI.live)(t==='bans'?drawBans($('#adm',el)):drawAdmin($('#adm',el),t));else $('#adm',el).innerHTML=`<div class="empty"><h3>Admin tools run on the live site</h3><p>Letting players in and making codes need the TradeBlacket server.</p></div>`;
};

// Check on load (after the boot screen) and whenever the signed-in player changes.
setTimeout(siteGate,1600);
function swAdminNav(){if($('#nav [data-go="admin"]'))return;const acc=[...$$('#nav h6')].find(h=>h.textContent==='Account');if(acc)acc.insertAdjacentHTML('afterend',`<button data-go="admin" title="Admin">${ic('shield',19)}<span>Admin</span></button>`)}
{const base=drawWho;drawWho=function(){base();const was=SW.user;SW.user=S.user&&S.user.name;if(was!==SW.user){if(!S.user)$$('#nav [data-go="admin"]').forEach(b=>b.remove());siteGate()}}}
// When the sign-in screen closes, run the check it was holding back.
{const g=$('#gate');if(g)new MutationObserver(()=>{if(SW.wait&&!g.innerHTML.trim()){SW.wait=0;siteGate()}}).observe(g,{childList:true})}

/* ---------- admin: bans ---------- */
async function drawBans(box){
  const r=await api('/api/admin/bans');if(!r.ok||!box.isConnected)return;
  box.innerHTML=`<div class="sec-h"><h3 class="sec">Banned accounts</h3><span class="note">One account per player: new accounts on a network, device or hardware already in use are banned automatically</span></div>
    <div class="card"><h4>Ban an account</h4><div class="wl-row"><input class="txt" id="bnw" placeholder="Roblox username or id"><input class="txt" id="bnr" placeholder="Reason (shown to the player)"><button class="cta inline" id="bngo">Ban</button></div></div>
    <div class="card wl-table"><table><thead><tr><th>Player</th><th>Reason</th><th>Linked to</th><th>When</th><th></th></tr></thead><tbody>${r.j.bans.map(b=>`<tr><td>${esc(b.username||String(b.roblox_id))}</td><td>${esc(b.reason)}</td><td>${b.linked_id?esc(b.linked_name||String(b.linked_id)):b.by_id?'Banned by an admin':''}</td><td>${new Date(b.created_at).toLocaleString()}</td><td><button class="cta ghost inline" data-unban="${b.roblox_id}">Unban</button></td></tr>`).join('')||'<tr><td colspan="5" class="note">Nobody is banned.</td></tr>'}</tbody></table></div>`;
  $('#bngo',box).onclick=async()=>{const who=$('#bnw',box).value.trim();if(!who)return;const x=await api('/api/admin/ban',{who,reason:$('#bnr',box).value.trim()});if(!x.ok)return toast(x.j.error,'loss');toast('Banned.');drawBans(box)};
  $$('[data-unban]',box).forEach(b=>b.onclick=async()=>{const x=await api('/api/admin/unban',{robloxId:Number(b.dataset.unban)});if(!x.ok)return toast(x.j.error,'loss');toast('Unbanned.');drawBans(box)});
}

/* ---------- no browsing without an account while TradeBlacket is invite-only ---------- */
// TB_GATE stays "invite-only" until the server answers that the site is open to everyone, so a
// failed or slow check never lets anyone in. The sign-in screen cannot be removed while signed out.
(async()=>{try{const r=await fetch('/api/site-waitlist',{credentials:'same-origin',cache:'no-store'});if(r.ok){const j=await r.json();if(j&&j.gate===false)window.TB_GATE=false}}catch{}})();
function swNeedSignIn(){return !S.user&&window.TB_GATE!==false}
{const g=$('#gate');if(g)new MutationObserver(()=>{if(swNeedSignIn()&&!g.innerHTML.trim())setTimeout(()=>{if(swNeedSignIn()&&!$('#gate').innerHTML.trim())showGate('in')},50)}).observe(g,{childList:true})}
{const g0=go;go=function(...a){if(swNeedSignIn()){S.guest=false;if(!$('#gate').innerHTML.trim())showGate('in');return}return g0.apply(this,a)}}
// a signed-out visitor who still had "guest" saved gets the sign-in screen
if(swNeedSignIn()&&!$('#gate').innerHTML.trim()){S.guest=false;save();showGate('up')}
