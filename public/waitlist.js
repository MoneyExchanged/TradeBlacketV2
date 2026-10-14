'use strict';
/* =========================================================
   Slots waitlist. Slots are closed for now: players join a waitlist and keep the place they
   joined in, and get in either when an admin lets the next players in or with an access code.
   Live: the server keeps the list (waitlist.js on the server). Preview: kept in this browser.
   ========================================================= */
const WL={s:null};
async function wlLoad(){
  if(WAPI.live){const r=await api('/api/waitlist');WL.s=r.ok?r.j:WL.s||{waiting:0,total:0};return WL.s}
  const L=S.wl||{};WL.s={access:!!L.access,via:L.access?'code':null,joined:!!L.joined,place:L.joined?1:null,ahead:L.joined?0:null,waiting:L.joined&&!L.access?1:0,total:L.joined?1:0,admin:false};return WL.s;
}
const slotAccess=()=>!!(WL.s&&WL.s.access);
async function wlJoin(){
  if(!S.user){openLogin();return}
  if(WAPI.live){const r=await api('/api/waitlist/join',{});if(!r.ok)return toast(r.j.error||'Could not join. Try again.','loss');WL.s=r.j}
  else{S.wl={...(S.wl||{}),joined:true};save();await wlLoad()}
  toast(`You're #${WL.s.place} on the slots waitlist.`,'gold');
}
async function wlRedeem(code){
  if(!S.user){openLogin();return false}
  if(WAPI.live){const r=await api('/api/waitlist/redeem',{code});if(!r.ok){toast(r.j.error,'loss');return false}WL.s=r.j}
  else{if(!/^(TB)?[A-Z2-9]{10}$/i.test(String(code).replace(/[^a-z0-9]/gi,''))){toast('Enter the full access code, like TB-ABCDE-FGHJK.','loss');return false}S.wl={...(S.wl||{}),joined:true,access:true};save();await wlLoad()}
  toast('Code accepted. Slots are open for you.','win');return true;
}

/* ---------- the waitlist page (shown in place of Slots) ---------- */
function waitlistPage(el){
  const draw=()=>{
    const s=WL.s||{waiting:0},me=!!S.user;
    const card=!me?`<div class="wl-place"><span class="wl-big">#${fmt0((s.total||0)+1)}</span><p>would be your place if you join now.</p><button class="cta inline" data-open="login">Sign in to join</button></div>`
      :s.access?`<div class="wl-place in"><span class="wl-big">${ic('check',44,2.4)}</span><p>You're in. Slots open for you as soon as they launch.</p></div>`
      :s.joined?`<div class="wl-place"><span class="wl-big">#${fmt0(s.place)}</span><p>${s.ahead?`${fmt0(s.ahead)} ${s.ahead===1?'player is':'players are'} ahead of you.`:"Nobody is ahead of you. You're next in."}</p></div>`
      :`<div class="wl-place"><span class="wl-big">#${fmt0((s.total||0)+1)}</span><p>is your place if you join now.</p><button class="cta inline" id="wlj">Join the waitlist</button></div>`;
    el.innerHTML=`<section class="wl">
      <div class="wl-copy"><div class="crumb"><button data-go="home">Casino</button> / Slots</div>
        <h2>Slots open by invitation</h2>
        <p>We're getting slots ready. Join the waitlist to hold your place: players get in in the order they joined, and an access code lets you in straight away.</p>
        <dl class="wl-stats"><div><dt>Waiting now</dt><dd>${fmt0(s.waiting||0)}</dd></div><div><dt>Joined so far</dt><dd>${fmt0(s.total||0)}</dd></div></dl>
        ${me&&!s.access?`<form class="wl-code" id="wlc"><label for="wlci">Have an access code?</label><div><input id="wlci" class="txt" placeholder="TB-XXXXX-XXXXX" autocomplete="off" spellcheck="false" maxlength="16"><button class="cta ghost inline">Redeem</button></div></form>`:''}
        ${WAPI.live?'':'<p class="note">Preview: the waitlist is kept in this browser. Any code in the TB-XXXXX-XXXXX format works here.</p>'}
      </div>${card}</section>
      ${s.admin?'<section class="wl-admin" id="wla"></section>':''}`;
    const j=$('#wlj',el);if(j)j.onclick=async()=>{j.disabled=true;await wlJoin();draw()};
    const f=$('#wlc',el);if(f)f.onsubmit=async e=>{e.preventDefault();const v=$('#wlci',el).value.trim();if(!v)return;if(await wlRedeem(v))go('slots')};
    if(s.admin)drawAdmin($('#wla',el));
  };
  el.innerHTML='<div class="inv-load"><div class="spin"></div></div>';
  wlLoad().then(()=>{if(el.isConnected)draw()});
}
async function drawAdmin(box){
  const r=await api('/api/admin/waitlist');if(!r.ok||!box.isConnected)return;const A=r.j;
  box.innerHTML=`<div class="sec-h"><h3 class="sec">Admin</h3><span class="note">Only you see this</span></div>
    <div class="wl-agrid">
      <div class="card"><h4>Let players in</h4><p class="note">${fmt0(A.waiting)} waiting, ${fmt0(A.granted)} with access</p><div class="wl-row"><input class="txt" id="wlg" type="number" min="1" value="10"><button class="cta inline" id="wlgo">Let in next</button></div></div>
      <div class="card"><h4>Make access codes</h4><div class="wl-row"><input class="txt" id="wlcn" type="number" min="1" max="50" value="1" title="How many codes"><input class="txt" id="wlcu" type="number" min="1" value="1" title="Uses per code"><input class="txt" id="wlno" placeholder="Note (optional)"></div><button class="cta inline" id="wlmk">Make codes</button><div id="wlout"></div></div>
    </div>
    <div class="card wl-table"><h4>Codes</h4>${A.codes.length?`<table><thead><tr><th>Code</th><th>Used</th><th>Left</th><th>Note</th></tr></thead><tbody>${A.codes.map(c=>`<tr><td><code>${esc(c.code)}</code></td><td>${c.used}</td><td>${c.uses_left}</td><td>${esc(c.note||'')}</td></tr>`).join('')}</tbody></table>`:'<p class="note">No codes yet.</p>'}</div>
    <div class="card wl-table"><h4>Waitlist</h4>${A.list.length?`<table><thead><tr><th>#</th><th>Player</th><th>Joined</th><th>Access</th><th></th></tr></thead><tbody>${A.list.map(w=>`<tr><td>${w.pos}</td><td>${esc(w.username||String(w.roblox_id))}</td><td>${new Date(w.joined_at).toLocaleString()}</td><td>${w.via?esc(w.via):'Waiting'}</td><td>${w.via?`<button class="lnk" data-rv="${w.roblox_id}">Remove access</button>`:''}</td></tr>`).join('')}</tbody></table>`:'<p class="note">Nobody has joined yet.</p>'}</div>`;
  $('#wlgo',box).onclick=async()=>{const r=await api('/api/admin/grant',{count:+$('#wlg',box).value});if(r.ok){toast(`Let in ${r.j.granted} player${r.j.granted===1?'':'s'}.`,'win');drawAdmin(box)}else toast(r.j.error,'loss')};
  $('#wlmk',box).onclick=async()=>{const r=await api('/api/admin/codes',{count:+$('#wlcn',box).value,uses:+$('#wlcu',box).value,note:$('#wlno',box).value});
    if(!r.ok)return toast(r.j.error,'loss');$('#wlout',box).innerHTML=`<div class="wl-codes">${r.j.codes.map(c=>`<button class="wl-chip" data-cp="${c}" title="Copy">${c}</button>`).join('')}</div>`};
  box.onclick=async e=>{const c=e.target.closest('[data-cp]');if(c){navigator.clipboard.writeText(c.dataset.cp).then(()=>toast('Code copied.'));return}
    const v=e.target.closest('[data-rv]');if(v){await api('/api/admin/revoke',{robloxId:+v.dataset.rv});drawAdmin(box)}};
}

// Slots and every single slot game show the waitlist until the player has access.
for(const k of ['slots','slot']){const own=PAGES[k];if(!own)continue;PAGES[k]=(el,p)=>{
  el.innerHTML='<div class="inv-load"><div class="spin"></div></div>';
  wlLoad().then(()=>{if(!el.isConnected)return;slotAccess()?own(el,p):waitlistPage(el)});
}}
