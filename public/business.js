'use strict';
/* =========================================================
   TradeBlacket Business (tradeblacket.com/business): the portal for creators.
   A clean app: sign in → apply (see your status and the estimated wait) → TEPP → your card.
   Partners keep money on their Business Card, top it up from their TradeBlacket balance, and can
   choose to pay withdrawals and purchases with the card, confirmed with a code, their device
   (Windows Hello, Touch ID, Face ID) or nothing.
   ========================================================= */
const BZ={me:null,view:'overview',shop:null,pick:new Set(),login:null};
const PLAT={youtube:'YouTube',tiktok:'TikTok',twitch:'Twitch',x:'X',discord:'Discord',other:'Website'};
const ACC={gold:['#E9C66B','#8A6A22'],champagne:['#F3E2B3','#A08A5B'],rose:['#E8B4A0','#8E5A48'],platinum:['#E2E5EA','#7C8591'],emerald:['#9FE3C0','#2F7A57']};
const usd2=v=>'$'+(+v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const bzMono=s=>`<svg width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="10" fill="#111113" stroke="#D4AF37" stroke-width="1.5"/><path d="M11 12h18M20 12v17" stroke="#D4AF37" stroke-width="3.4" stroke-linecap="round"/><circle cx="27.5" cy="26.5" r="3.2" fill="none" stroke="#D4AF37" stroke-width="2.4"/></svg>`;
const BI={
  overview:'<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',wallet:'<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 15h2"/>',gift:'<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M4 13h16M12 9c-2-4-6-3-5 0M12 9c2-4 6-3 5 0"/>',
  ideas:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.5 1 2.5h6c0-1 .3-1.9 1-2.5A6 6 0 0 0 12 3z"/>',channel:'<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>',support:'<path d="M4 6h16v10H9l-5 4z"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',check:'<path d="M5 12l5 5 9-10"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',up:'<path d="M12 19V5M6 11l6-6 6 6"/>',down:'<path d="M12 5v14M6 13l6 6 6-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',back:'<path d="M15 6l-6 6 6 6"/>',
  finger:'<path d="M12 11v3a6 6 0 0 1-1 3.5M8.5 9.5A4 4 0 0 1 16 11v1M6 13v-2a6 6 0 0 1 10-4.5M17.5 14a10 10 0 0 1-1 4M12 7.5a3.5 3.5 0 0 0-3.5 3.5v2.5a9 9 0 0 1-1.2 4.5"/>'};
const bic=(k,s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${BI[k]||''}</svg>`;
const DEVICE=/Windows/i.test(navigator.userAgent)?'Windows Hello':/Mac|iPhone|iPad/i.test(navigator.userAgent)?'Touch ID or Face ID':/Android/i.test(navigator.userAgent)?'your fingerprint or screen lock':'This device';
const span=ms=>{const h=ms/36e5;return h<1?'under an hour':h<20?`about ${Math.round(h)} hour${Math.round(h)===1?'':'s'}`:`about ${Math.round(h/24)} day${Math.round(h/24)===1?'':'s'}`};
const sinceTxt=t=>{const h=(Date.now()-t)/36e5;return h<1?`${Math.max(1,Math.round(h*60))} minutes ago`:h<48?`${Math.round(h)} hours ago`:`${Math.round(h/24)} days ago`};

function bzStage(m){if(!S.user)return'signin';if(!m||m.status==='none'||m.status==='rejected')return'apply';if(m.status==='pending')return'review';if(m.status==='suspended')return'suspended';if(m.tepp!=='approved')return'member';return m.card?'partner':'card'}
async function bzLoad(){
  await WAPI.ready;
  if(!S.user){BZ.me=null;return}
  if(!WAPI.live){BZ.me=S.bizDemo||{status:'none',cardNo:'TBB 7K2Q M9XD 4PLW',roduxPerUsd:RATE.roduxPerUsd,platforms:Object.keys(PLAT),accents:Object.keys(ACC)};return}
  const r=await api('/api/business/me');BZ.me=r.ok?r.j:{status:'none',error:r.j.error};CARD.me=BZ.me;
}

/* ---------- the frame ---------- */
function bzOpen(push=true){
  window.BIZ_MODE=true;document.body.classList.add('biz-on');
  const g=$('#gate');if(g&&!S.user)g.innerHTML='';swClose&&swClose();
  if(push&&location.pathname!=='/business')try{history.pushState(null,'','/business')}catch{}
  let el=$('#biz');if(!el){el=document.createElement('div');el.id='biz';el.setAttribute('role','region');el.setAttribute('aria-label','TradeBlacket Business');document.body.appendChild(el)}
  el.innerHTML=`<header class="bz-top"><a class="bz-brand" href="/business">${bzMono(28)}<span>TradeBlacket <b>Business</b></span></a><div class="bz-acct" id="bzacct"></div></header><div class="bz-shell" id="bzshell"><div class="spin"></div></div>`;
  bzLoad().then(bzDraw);
}
function bzClose(){
  window.BIZ_MODE=false;document.body.classList.remove('biz-on');const el=$('#biz');if(el)el.remove();
  try{history.pushState(null,'','/')}catch{}
  if(!S.user&&window.TB_GATE!==false)showGate('in');else{go('home');siteGate()}
}
addEventListener('popstate',()=>{if(location.pathname==='/business'&&!$('#biz'))bzOpen(false);else if(location.pathname!=='/business'&&$('#biz'))bzClose()});

function bzDraw(){
  const shell=$('#bzshell'),acct=$('#bzacct');if(!shell)return;
  const m=BZ.me,st=bzStage(m);
  acct.innerHTML=`${S.user?`<span class="bz-who">${avatar(me(),26)}<b>${esc(S.user.name)}</b>${m&&m.status==='approved'?`<i class="bz-role">${m.tepp==='approved'?'Partner':'Business'}</i>`:''}</span>`:''}<button class="bz-link" id="bzback">${bic('back',16)}TradeBlacket</button>`;
  $('#bzback').onclick=bzClose;
  if(st==='signin'||st==='apply'||st==='review'||st==='suspended'){shell.className='bz-shell solo';shell.innerHTML=`<div class="bz-solo">${st==='signin'?bzSignin():st==='apply'?bzStatus(m)+bzApply(m):st==='review'?bzStatus(m):bzSuspended(m)}</div>`}
  else{
    const partner=st==='partner'||st==='card';
    const NAV=[['overview','Overview'],['wallet','Card & wallet',!partner],['giveaways','Giveaways'],['ideas','Feature requests'],['channel','YouTube'],['support','Support'],['settings','Payment settings',!partner]];
    if(!NAV.some(([k,,lk])=>k===BZ.view&&!lk))BZ.view='overview';
    shell.className='bz-shell';
    shell.innerHTML=`<nav class="bz-nav" aria-label="Business">${NAV.map(([k,l,lk])=>`<button data-bzv="${k}" class="${BZ.view===k?'on':''}" ${lk?'disabled title="For Trade Empire Partners"':''}>${bic(k==='giveaways'?'gift':k)}<span>${l}</span>${lk?bic('lock',14):''}</button>`).join('')}</nav>
      <main class="bz-page">${st==='card'&&(BZ.view==='overview'||BZ.view==='wallet')?bzCardBuilder(m,true):bzView(m,partner)}</main>`;
  }
  bzWire();
}

/* ---------- signed out ---------- */
function bzSignin(){
  const L=BZ.login;
  return`<section class="bz-panel bz-signin">${bzMono(44)}<h1>TradeBlacket Business</h1><p class="bz-sub">The partner portal for Trade Empire creators. Sign in with your Roblox account to apply or manage your card.</p>
    ${!L?`<form id="bzl1" class="bz-form"><label class="bz-f"><span>Roblox username</span><input id="bzu" class="bz-in" autocomplete="username" maxlength="20" autofocus></label><div class="err" id="bze"></div><button class="bz-btn wide">Continue</button></form>`:
    `<form id="bzl2" class="bz-form"><p class="bz-sub">Add this phrase to the About section of <b>${esc(L.name)}</b> on Roblox, save it, then verify. You can remove it afterwards.</p>
      <div class="bz-phrase"><code>${esc(L.phrase)}</code><button type="button" id="bzcp">Copy</button></div>
      <label class="bz-chk"><input type="checkbox" id="bzage"> I'm 18 or older and accept the <button type="button" class="lnk" data-legal="tos">Terms of Service</button>.</label>
      <div class="err" id="bze"></div><button class="bz-btn wide">Verify and sign in</button><button type="button" class="bz-link center" id="bzl0">Use a different account</button></form>`}
    <ul class="bz-points"><li>${bic('check',16)}A Business or Partner role on your profile and in chat</li><li>${bic('check',16)}Payouts in US dollars or Rodux on your Business Card</li><li>${bic('check',16)}Giveaway codes and a direct line to the team</li></ul></section>`;
}

/* ---------- status ---------- */
function bzSteps(cur){const S2=['Apply','Review','Partner Program','Business Card'];return`<ol class="bz-track">${S2.map((s,i)=>`<li class="${i<cur?'done':i===cur?'cur':''}"><i>${i<cur?bic('check',12):i+1}</i><span>${s}</span></li>`).join('')}</ol>`}
function bzStatus(m){
  const st=!m||m.status==='none'?'none':m.status,R=m&&m.review;
  if(st==='none')return`<section class="bz-panel"><div class="bz-sh"><div><p class="bz-label">Status</p><h1>Not applied yet</h1></div><span class="bz-pill">Step 1 of 4</span></div>${bzSteps(0)}<p class="bz-sub">Apply below. A moderator reviews every application by hand.</p></section>`;
  if(st==='rejected')return`<section class="bz-panel"><div class="bz-sh"><div><p class="bz-label">Status</p><h1>Not approved</h1></div><span class="bz-pill bad">Declined</span></div>${m.note?`<p class="bz-quote">${esc(m.note)}</p>`:''}<p class="bz-sub">You can apply again ${m.decidedAt&&Date.now()-m.decidedAt<7*864e5?`from ${new Date(m.decidedAt+7*864e5).toLocaleDateString()}`:'now'}.</p></section>`;
  return`<section class="bz-panel"><div class="bz-sh"><div><p class="bz-label">Status</p><h1>Under review</h1></div><span class="bz-pill wait">${bic('clock',14)}In the queue</span></div>${bzSteps(1)}
    <dl class="bz-stats"><div><dt>Estimated wait</dt><dd>${R?span(R.estimateMs):'about 2 days'}</dd><small>${R?`decision expected by ${new Date(R.expectedBy).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})}`:''}</small></div>
      <div><dt>Place in the queue</dt><dd>${R?`${R.position} of ${R.pending}`:'1'}</dd><small>${R&&R.ahead?`${R.ahead} ahead of you`:'you\'re next'}</small></div>
      <div><dt>Submitted</dt><dd>${m.appliedAt?sinceTxt(m.appliedAt):''}</dd><small>${m.appliedAt?new Date(m.appliedAt).toLocaleString():''}</small></div></dl>
    <p class="bz-meta">${R&&R.basedOn?`Based on how long the last ${R.basedOn} decision${R.basedOn===1?'':'s'} took.`:'An estimate until we have more decisions to go on.'} This page updates by itself.</p>
    <details class="bz-sum"><summary>What you sent</summary><dl class="bz-kv"><div><dt>Creator name</dt><dd>${esc(m.form.name||'')}</dd></div><div><dt>Audience</dt><dd>${fmt0(m.form.audience||0)}</dd></div><div><dt>Discord</dt><dd>${esc(m.form.discord||'–')}</dd></div><div><dt>Links</dt><dd>${(m.form.links||[]).map(l=>`${PLAT[l.platform]}: ${esc(l.url)}`).join('<br>')}</dd></div></dl><p class="bz-sub">${esc(m.form.why||'')}</p></details></section>`;
}
function bzSuspended(m){return`<section class="bz-panel"><div class="bz-sh"><div><p class="bz-label">Status</p><h1>Membership paused</h1></div><span class="bz-pill bad">Suspended</span></div>${m.note?`<p class="bz-quote">${esc(m.note)}</p>`:''}<p class="bz-sub">Contact support if you think this is a mistake.</p><button class="bz-btn" data-bzsup>Contact support</button></section>`}

/* ---------- apply ---------- */
const bzLinkRow=l=>`<div class="bz-lr"><select class="bz-in" aria-label="Platform">${Object.entries(PLAT).map(([k,v])=>`<option value="${k}" ${l.platform===k?'selected':''}>${v}</option>`).join('')}</select><input class="bz-in" type="url" placeholder="https://" value="${esc(l.url||'')}" aria-label="Link"><button type="button" class="bz-x" aria-label="Remove link">×</button></div>`;
const bzLinkRows=(links,max)=>`<div class="bz-links" data-max="${max}">${(links&&links.length?links:[{platform:'youtube',url:''}]).map(bzLinkRow).join('')}</div><button type="button" class="bz-link" data-addlink>${bic('plus',14)}Add a link</button>`;
function bzApply(m){
  const f=(m&&m.form)||{};
  return`<form class="bz-panel bz-form" id="bzapp"><h2>Application</h2>
    <label class="bz-f"><span>Creator name</span><input class="bz-in" id="ba-name" maxlength="40" value="${esc(f.name||S.user.name)}"></label>
    <div class="bz-f"><span>Channels and profiles</span>${bzLinkRows(f.links,6)}</div>
    <div class="bz-row2"><label class="bz-f"><span>Followers or subscribers</span><input class="bz-in" id="ba-aud" type="number" min="0" value="${f.audience||''}"></label><label class="bz-f"><span>Discord</span><input class="bz-in" id="ba-dc" maxlength="40" value="${esc(f.discord||'')}"></label></div>
    <label class="bz-f"><span>About your content</span><textarea class="bz-in" id="ba-why" rows="4" maxlength="1000" placeholder="What you make, how often, and why Trade Empire">${esc(f.why||'')}</textarea></label>
    <label class="bz-chk"><input type="checkbox" id="ba-ok"> I make my own content, won't sell giveaway codes, and understand membership can be removed for breaking the rules.</label>
    <div class="err" id="bze"></div><button class="bz-btn">Submit application</button></form>`;
}

/* ---------- portal views ---------- */
function bzView(m,partner){
  const v=BZ.view;
  if(v==='overview')return bzOverview(m,partner);
  if(v==='wallet')return bzWallet(m);
  if(v==='giveaways')return`<div class="bz-ph"><h1>Giveaways</h1><p class="bz-sub">Gift cards from the team for your audience. One code per winner.</p></div>${m.codes.length?`<div class="bz-list">${m.codes.map(c=>`<div class="bz-row"><div><b>USD $${c.usd}</b><code>${esc(c.code)}</code></div><span class="bz-pill ${c.status==='active'?'':'muted'}">${c.status==='redeemed'?`Redeemed by ${esc(c.redeemedBy||'a player')}`:c.status==='active'?'Not used':esc(c.status)}</span>${c.status==='active'?`<button class="bz-link" data-copy="${esc(c.code)}">Copy</button>`:''}</div>`).join('')}</div>`:'<div class="bz-empty">No codes yet. Ask the team for a giveaway through Support.</div>'}`;
  if(v==='ideas')return bzRequests(m);
  if(v==='channel')return`<div class="bz-ph"><h1>YouTube</h1><p class="bz-sub">Show players your channel is really yours.</p></div>${bzYoutube(m)}`;
  if(v==='support')return`<div class="bz-ph"><h1>Support</h1><p class="bz-sub">Questions about payouts, giveaways or your membership go straight to the team and are answered first.</p></div><section class="bz-panel"><button class="bz-btn" data-bzsup>Message the team</button></section>`;
  if(v==='settings')return bzPaySettings(m);
  return'';
}
function bzOverview(m,partner){
  const T=m.tepp;
  if(!partner)return`<div class="bz-ph"><h1>Welcome, ${esc((m.form&&m.form.name)||S.user.name)}</h1><p class="bz-sub">You're a TradeBlacket Business member. Next: the Trade Empire Partner Program, for your Business Card and payouts.</p></div>
    ${T==='pending'?bzTeppStatus(m):`${T==='rejected'?`<div class="bz-panel"><div class="bz-sh"><div><p class="bz-label">Partner Program</p><h2>Not approved</h2></div><span class="bz-pill bad">Declined</span></div>${m.teppNote?`<p class="bz-quote">${esc(m.teppNote)}</p>`:''}<p class="bz-sub">You can apply again 14 days after the decision.</p></div>`:''}
    <form id="bztepp" class="bz-panel bz-form"><h2>Apply for the Partner Program</h2>
      <label class="bz-f"><span>The Trade Empire content you'll make</span><textarea class="bz-in" id="bt-plan" rows="4" maxlength="1500"></textarea></label>
      <div class="bz-row2"><label class="bz-f"><span>How often you post</span><input class="bz-in" id="bt-cad" maxlength="60" placeholder="e.g. Twice a week"></label><label class="bz-f"><span>A recent video (optional)</span><input class="bz-in" id="bt-vid" type="url" placeholder="https://"></label></div>
      <label class="bz-f"><span>Creator code you'd like (optional)</span><input class="bz-in" id="bt-code" maxlength="16"></label>
      <label class="bz-chk"><input type="checkbox" id="bt-ok"> I'll keep my content honest: no scams, no paid views.</label>
      <div class="err" id="bze"></div><button class="bz-btn">Apply</button></form>`}`;
  const recent=m.ledger.slice(0,5);
  return`<div class="bz-ph"><h1>Overview</h1></div>
    <div class="bz-ov"><div class="bz-cardwrap">${bzCardHtml(m.card,m.cardNo,m.balance)}</div>
      <section class="bz-panel"><p class="bz-label">On your card</p><div class="bz-big">${usd2(m.balance.usd)}<span>+ ${fmt0(m.balance.rodux)} Rodux</span></div>
        <div class="bz-actions"><button class="bz-btn" data-act="topup">${bic('up',16)}Top up</button><button class="bz-btn ghost" data-act="withdraw">${bic('down',16)}Withdraw</button></div>
        <p class="bz-meta">Paying with: <b>${m.pay.source==='card'?'Business Card':'TradeBlacket balance'}</b> · Confirm with: <b>${{none:'nothing',pin:'a code',device:DEVICE}[m.pay.method]}</b> <button class="bz-link" data-bzv="settings">Change</button></p></section></div>
    <section class="bz-panel"><div class="bz-sh"><h2>Recent activity</h2><button class="bz-link" data-bzv="wallet">See all</button></div>${bzLedger(recent)}</section>`;
}
function bzTeppStatus(m){const R=m.review;return`<section class="bz-panel"><div class="bz-sh"><div><p class="bz-label">Partner Program status</p><h2>Under review</h2></div><span class="bz-pill wait">${bic('clock',14)}In the queue</span></div>${bzSteps(2)}
  <dl class="bz-stats"><div><dt>Estimated wait</dt><dd>${R?span(R.estimateMs):'about 2 days'}</dd><small>${R?`by ${new Date(R.expectedBy).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})}`:''}</small></div><div><dt>Place in the queue</dt><dd>${R?`${R.position} of ${R.pending}`:'1'}</dd><small>${R&&R.ahead?`${R.ahead} ahead of you`:'you\'re next'}</small></div><div><dt>Submitted</dt><dd>${m.teppAt?sinceTxt(m.teppAt):''}</dd></div></dl></section>`}
const LK={payout:'Payout','withdraw-rodux':'To balance','withdraw-items':'Limiteds',topup:'Top up','card-pay':'Card payment'};
function bzLedger(L){return L.length?`<ul class="bz-led">${L.map(l=>{const plus=l.kind==='payout'||l.kind==='topup';return`<li><span class="bz-li ${plus?'in':'out'}">${bic(plus?'down':'up',15)}</span><div><b>${esc(l.note||LK[l.kind]||l.kind)}</b><small>${LK[l.kind]||l.kind} · ${new Date(l.at).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small></div><span class="bz-amt ${plus?'in':''}">${plus?'+':'−'}${l.currency==='USD'?usd2(Math.abs(l.amount)):fmt0(Math.abs(l.amount))+' Rodux'}</span></li>`}).join('')}</ul>`:'<div class="bz-empty">Nothing yet. Payouts and payments show up here.</div>'}

/* ---------- the card ---------- */
function bzCardHtml(c,no,bal){
  const [a,b]=ACC[(c&&c.accent)||'gold']||ACC.gold;
  return`<div class="bzc" style="--ca:${a};--cb:${b}"><div class="bzc-top">${bzMono(26)}<span>Business</span></div><div class="bzc-chip"></div>
    <div class="bzc-no">${esc(no||'')}</div><div class="bzc-bot"><div><b>${esc((c&&c.name)||'')}</b><span>${esc((c&&c.tagline)||'')}</span></div>${bal?`<div class="bzc-bal">${usd2(bal.usd||0)}</div>`:''}</div></div>`;
}
function bzCardBuilder(m,first){
  const c=m.card||{name:(m.form&&m.form.name)||S.user.name,tagline:'',accent:'gold',links:(m.form&&m.form.links||[]).slice(0,4)};
  return`<div class="bz-ph"><h1>${first?'Create your Business Card':'Edit your card'}</h1><p class="bz-sub">${first?'You\'re a Trade Empire Partner. Your card holds your payouts and can pay for withdrawals and purchases.':'Change how your card looks.'}</p></div>
    <div class="bz-ov"><div class="bz-cardwrap" id="bzprev">${bzCardHtml(c,m.cardNo,m.balance)}</div>
    <form id="bzcard" class="bz-panel bz-form"><label class="bz-f"><span>Name on the card</span><input class="bz-in" id="bc-name" maxlength="32" value="${esc(c.name||'')}"></label>
      <label class="bz-f"><span>Tagline</span><input class="bz-in" id="bc-tag" maxlength="70" value="${esc(c.tagline||'')}"></label>
      <div class="bz-f"><span>Finish</span><div class="bz-acc">${Object.keys(ACC).map(k=>`<label title="${k}"><input type="radio" name="bc-acc" value="${k}" ${c.accent===k?'checked':''}><i style="--a:${ACC[k][0]};--b:${ACC[k][1]}"></i><span>${k[0].toUpperCase()+k.slice(1)}</span></label>`).join('')}</div></div>
      <div class="bz-f"><span>Links</span>${bzLinkRows(c.links,4)}</div>
      <div class="err" id="bze"></div><div class="bz-actions"><button class="bz-btn">${first?'Create card':'Save'}</button>${first?'':'<button type="button" class="bz-btn ghost" data-bzv="wallet">Cancel</button>'}</div></form></div>`;
}
function bzWallet(m){
  if(BZ.sub==='edit')return bzCardBuilder(m,false);
  return`<div class="bz-ph"><h1>Card & wallet</h1></div>
    <div class="bz-ov"><div class="bz-cardwrap">${bzCardHtml(m.card,m.cardNo,m.balance)}<button class="bz-link center" data-sub="edit">Edit card</button></div>
      <section class="bz-panel"><dl class="bz-stats two"><div><dt>US dollars</dt><dd>${usd2(m.balance.usd)}</dd></div><div><dt>Rodux</dt><dd>${fmt0(m.balance.rodux)}</dd></div></dl>
        <p class="bz-meta">1 US dollar = ${fmt0(m.roduxPerUsd)} Rodux, from what Rodux costs in Trade Empire.</p>
        <div class="bz-actions"><button class="bz-btn" data-act="topup">${bic('up',16)}Top up</button><button class="bz-btn ghost" data-act="withdraw">${bic('down',16)}To balance</button><button class="bz-btn ghost" data-act="items">Limiteds</button></div></section></div>
    <section class="bz-panel"><h2>Activity</h2>${bzLedger(m.ledger)}</section>`;
}
function bzPaySettings(m){
  const P=m.pay;
  return`<div class="bz-ph"><h1>Payment settings</h1><p class="bz-sub">Use your card instead of your TradeBlacket balance when you withdraw to Trade Empire or buy on the marketplace.</p></div>
    <section class="bz-panel"><h2>Pay with</h2><div class="bz-opts">${[['balance','TradeBlacket balance','Payments come from your balance, as usual.'],['card','Business Card','Payments come from your card. You confirm each one.']].map(([k,l,d])=>`<button class="bz-opt${P.source===k?' on':''}" data-src="${k}"><b>${l}</b><small>${d}</small></button>`).join('')}</div></section>
    <section class="bz-panel"><h2>Confirm card payments with</h2><div class="bz-opts three">${[['none','Nothing','One tap to pay.'],['pin','A code','4 to 6 digits you choose.'],['device',DEVICE,'Your fingerprint, face or device PIN.']].map(([k,l,d])=>`<button class="bz-opt${P.method===k?' on':''}" data-auth="${k}"><b>${l}</b><small>${d}</small>${k==='device'&&!P.hasDevice?'<i>Set up first</i>':''}</button>`).join('')}</div>
      <div id="bzsec"></div>${P.locked?`<p class="bz-meta bad">Card payments are paused until ${new Date(P.locked).toLocaleTimeString()} after too many wrong codes.</p>`:''}</section>`;
}
function bzYoutube(m){
  const y=m.youtube||{};
  return`<section class="bz-panel">${y.verified?`<div class="bz-sh"><div><p class="bz-label">Verified</p><h2>${esc(y.url)}</h2></div><span class="bz-pill ok">${bic('check',14)}Verified</span></div>`:y.url&&y.phrase?`<h2>Prove it's your channel</h2><p class="bz-sub">Add this code to your channel description on YouTube, save, then check.</p><div class="bz-phrase"><code>${esc(y.phrase)}</code><button type="button" data-copy="${esc(y.phrase)}">Copy</button></div><p class="bz-meta">${esc(y.url)}</p><div class="err" id="bzye"></div><div class="bz-actions"><button class="bz-btn" id="bzyv">Check my channel</button><button class="bz-btn ghost" id="bzyr">Change</button></div>`:
    `<form id="bzyt" class="bz-form"><label class="bz-f"><span>Channel link</span><input class="bz-in" id="by-url" placeholder="https://www.youtube.com/@yourname"></label><div class="err" id="bzye"></div><button class="bz-btn">Connect</button></form>`}</section>`;
}
function bzRequests(m){
  const R=m.requests||[],ST={open:'Open',planned:'Planned',building:'Building',done:'Shipped',declined:'Not planned'};
  return`<div class="bz-ph"><h1>Feature requests</h1><p class="bz-sub">What would help you make better Trade Empire content? Vote on what matters to you.</p></div>
    <form id="bzrq" class="bz-panel bz-form"><label class="bz-f"><span>Title</span><input class="bz-in" id="br-t" maxlength="90"></label><label class="bz-f"><span>Details</span><textarea class="bz-in" id="br-b" rows="3" maxlength="1500"></textarea></label><div class="err" id="bzre"></div><button class="bz-btn">Send request</button></form>
    <div class="bz-list">${R.map(r=>`<div class="bz-req"><button class="bz-vote${r.voted?' on':''}" data-vote="${r.id}" aria-label="Vote">${bic('up',14)}<b>${r.votes}</b></button><div><b>${esc(r.title)}</b><p>${esc(r.body)}</p>${r.reply?`<p class="bz-reply">Team: ${esc(r.reply)}</p>`:''}<small>${esc(r.by||'')} · ${new Date(r.at).toLocaleDateString()}</small></div><span class="bz-pill ${r.status==='done'?'ok':r.status==='declined'?'muted':''}">${ST[r.status]||r.status}</span></div>`).join('')||'<div class="bz-empty">No requests yet.</div>'}</div>`;
}

/* ---------- sheets: top up, withdraw, limiteds ---------- */
function bzSheet(html,cls=''){return modal(`<div class="bzs ${cls}">${html}</div>`,{cls:'bzs-modal'})}
function bzTopup(){
  const can=WAPI.me?WAPI.me.withdrawable:0;
  const s=bzSheet(`<h3>Top up your card</h3><p class="bz-sub">Move Rodux from your TradeBlacket balance onto your card. Bonus Rodux stays on your balance.</p>
    <label class="bz-f"><span>Amount (Rodux)</span><div class="bz-amtin"><input class="bz-in" id="tu-a" type="number" min="1" step="1"><button type="button" class="bz-link" id="tu-max">Max</button></div></label><p class="bz-meta">Available: ${fmt0(can)} Rodux</p><div class="err" id="tu-e"></div><button class="bz-btn wide" id="tu-go">Top up</button>`);
  $('#tu-max',s.root).onclick=()=>$('#tu-a',s.root).value=can;
  $('#tu-go',s.root).onclick=async()=>{const r=await bzPost('/api/business/topup',{amount:$('#tu-a',s.root).value},'#tu-e');if(r.ok){BZ.me=CARD.me=r.j;s.close();await syncMe();bzDraw();toast(`${fmt0(r.j.toppedUp)} Rodux is on your card.`,'win')}};
}
function bzWithdraw(){
  const m=BZ.me;
  const s=bzSheet(`<h3>Move to your balance</h3><p class="bz-sub">Card money goes to your TradeBlacket balance as Rodux.</p>
    <div class="bz-opts">${[['usd',`From dollars (${usd2(m.balance.usd)})`],['rodux',`From Rodux (${fmt0(m.balance.rodux)})`]].map(([k,l],i)=>`<label class="bz-opt sm"><input type="radio" name="wd-f" value="${k}" ${(i===0)===(m.balance.usd>=1)?'checked':''}><b>${l}</b></label>`).join('')}</div>
    <label class="bz-f"><span>Amount</span><input class="bz-in" id="wd-a" type="number" min="1" step="any"></label><p class="bz-meta" id="wd-est"></p><div class="err" id="wd-e"></div><button class="bz-btn wide" id="wd-go">Move to balance</button>`);
  const est=()=>{const f=($('[name=wd-f]:checked',s.root)||{}).value,a=+$('#wd-a',s.root).value||0;$('#wd-est',s.root).textContent=a>0&&f==='usd'?`= ${fmt0(Math.floor(a*m.roduxPerUsd))} Rodux`:''};s.root.oninput=est;s.root.onchange=est;
  $('#wd-go',s.root).onclick=async()=>{const r=await bzPost('/api/business/withdraw',{from:($('[name=wd-f]:checked',s.root)||{}).value,amount:$('#wd-a',s.root).value},'#wd-e');if(r.ok){BZ.me=CARD.me=r.j;s.close();await syncMe();bzDraw();toast(`+${fmt0(r.j.paid.rodux)} Rodux on your balance.`,'win')}};
}
async function bzItems(){
  const s=bzSheet(`<h3>Take limiteds</h3><p class="bz-sub">Limiteds TradeBlacket owns. They go to your Limiteds, ready to withdraw to Trade Empire. Rodux on your card pays first, then dollars.</p><div class="bz-shop" id="bzshop"><div class="spin"></div></div><div class="bz-tot" id="bztot"></div><div class="err" id="it-e"></div><button class="bz-btn wide" id="it-go" disabled>Take limiteds</button>`,'wide');
  const r=WAPI.live?await api('/api/business/shop'):{ok:true,j:{listings:[]}};const L=r.ok?r.j.listings:[];const pick=new Set();
  const draw=()=>{const box=$('#bzshop',s.root);if(!box)return;box.innerHTML=L.length?L.map(l=>`<button class="bz-it${pick.has(l.id)?' on':''}" data-pick="${esc(l.id)}">${l.img?`<img src="${esc(l.img)}" alt="" loading="lazy">`:'<span></span>'}<b>${esc(l.name||'Item '+l.itemId)}</b><small>#${l.serial} · ${fmt0(l.price)}</small></button>`).join(''):'<p class="bz-meta">No limiteds available right now.</p>';
    const tot=L.filter(l=>pick.has(l.id)).reduce((a,l)=>a+l.price,0),can=BZ.me.balance.roduxValue;$('#bztot',s.root).innerHTML=`<span>${pick.size} picked · ${fmt0(tot)} Rodux</span><span class="${tot>can?'bad':''}">Card: ${fmt0(can)} Rodux worth</span>`;$('#it-go',s.root).disabled=!pick.size||tot>can;
    $$('[data-pick]',box).forEach(b=>b.onclick=()=>{pick.has(b.dataset.pick)?pick.delete(b.dataset.pick):pick.add(b.dataset.pick);draw()})};
  draw();
  $('#it-go',s.root).onclick=async()=>{const x=await bzPost('/api/business/withdraw-items',{listings:[...pick]},'#it-e');if(x.ok){BZ.me=CARD.me=x.j;s.close();bzDraw();toast(`${x.j.items} limited${x.j.items===1?'':'s'} added to your Limiteds.`,'win')}};
}

/* ---------- pay with the card (the Apple Pay-style sheet) ---------- */
const CARD={me:null};
const b64u=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64u=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4)),c=>c.charCodeAt(0));
async function cardLoad(force){if(!WAPI.live||!WAPI.me||!WAPI.me.business||WAPI.me.business.role!=='Partner')return null;if(!CARD.me||force){const r=await api('/api/business/me');if(r.ok)CARD.me=r.j}return CARD.me}
// Ask the device to confirm (Windows Hello, Touch ID, Face ID). Returns the assertion for the server.
async function deviceAssert(){
  if(!window.PublicKeyCredential)throw new Error('This browser cannot confirm with your device. Use a code instead.');
  const o=await api('/api/business/passkey/options',{kind:'pay'});if(!o.ok)throw new Error(o.j.error);
  const c=await navigator.credentials.get({publicKey:{challenge:unb64u(o.j.challenge),rpId:location.hostname,allowCredentials:o.j.credentialId?[{type:'public-key',id:unb64u(o.j.credentialId)}]:[],userVerification:'required',timeout:60000}});
  return{id:c.id,authenticatorData:b64u(c.response.authenticatorData),clientDataJSON:b64u(c.response.clientDataJSON),signature:b64u(c.response.signature)};
}
// Confirm with whatever the partner chose; resolves to the auth object, or null if cancelled.
function cardConfirmUI(root,method,label){
  return new Promise(res=>{
    const box=$('.bzp-auth',root);
    if(method==='none'){box.innerHTML=`<button class="bzp-pay" id="bzp-go">${esc(label)}</button>`;$('#bzp-go',root).onclick=()=>res({})}
    else if(method==='pin'){let v='';const dots=()=>`<div class="bzp-dots">${[0,1,2,3,4,5].map(i=>`<i class="${i<v.length?'on':''}"></i>`).join('')}</div>`;
      const draw=()=>{box.innerHTML=`<p>Enter your card code</p>${dots()}<div class="bzp-keys">${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>k===''?'<span></span>':`<button data-k="${k}">${k}</button>`).join('')}</div><button class="bzp-pay" id="bzp-go" ${v.length<4?'disabled':''}>${esc(label)}</button>`;
        $$('[data-k]',box).forEach(b=>b.onclick=()=>{const k=b.dataset.k;if(k==='⌫')v=v.slice(0,-1);else if(v.length<6)v+=k;draw()});$('#bzp-go',root).onclick=()=>res({pin:v})};
      draw();root.tabIndex=-1;root.focus();root.onkeydown=e=>{if(/^\d$/.test(e.key)&&v.length<6){v+=e.key;draw()}else if(e.key==='Backspace'){v=v.slice(0,-1);draw()}else if(e.key==='Enter'&&v.length>=4)res({pin:v})}}
    else{box.innerHTML=`<button class="bzp-pay dev" id="bzp-go">${bic('finger',20)}Confirm with ${esc(DEVICE)}</button>`;$('#bzp-go',root).onclick=async()=>{try{res({assertion:await deviceAssert()})}catch(e){$('.bzp-err',root).textContent=e&&e.name==='NotAllowedError'?'Confirmation was cancelled.':(e.message||'Could not confirm.')}}}
  });
}
// Pay `amount` Rodux from the Business Card if the partner chose the card. True = go ahead.
async function cardMaybe(amount,purpose){
  const c=await cardLoad();if(!c||!c.card||c.pay.source!=='card')return true;
  const need=Math.ceil(amount);if(need>c.balance.roduxValue){toast('Your Business Card does not hold enough. Top it up or pay with your balance.','loss');return false}
  return new Promise(resolve=>{
    let done=false;
    const m=modal(`<div class="bzp"><div class="bzp-card">${bzCardHtml(c.card,c.cardNo)}</div><div class="bzp-row"><span>${esc(purpose)}</span><b>${fmt0(need)} Rodux</b></div><div class="bzp-row bzp-sub"><span>Card</span><span>${esc(c.cardNo.slice(-4))} · ${usd2(c.balance.usd)} + ${fmt0(c.balance.rodux)} Rodux</span></div><div class="bzp-auth"></div><div class="bzp-err err"></div></div>`,{cls:'bzp-modal',onClose:()=>{if(!done)resolve(false)}});
    const go=async()=>{const auth=await cardConfirmUI(m.root,c.pay.method,`Pay ${fmt0(need)} Rodux`);if(!auth)return;
      const r=await api('/api/business/pay',{amount:need,auth,purpose});
      if(!r.ok){$('.bzp-err',m.root).textContent=r.j.error;go();return}
      CARD.me=r.j;done=true;$('.bzp-auth',m.root).innerHTML=`<div class="bzp-done">${bic('check',34)}<b>Paid</b></div>`;await syncMe();setTimeout(()=>{m.close();resolve(true)},700)};
    go();
  });
}

/* ---------- wiring ---------- */
const bzLinks=box=>[...$$('.bz-lr',box)].map(r=>({platform:$('select',r).value,url:$('input',r).value.trim()})).filter(l=>l.url);
async function bzPost(p,b,errSel){
  if(!WAPI.live){const r={ok:false,j:{error:'Preview: TradeBlacket Business runs on the live site.'}};const e=errSel&&$(errSel);if(e)e.textContent=r.j.error;return r}
  const r=await api(p,b);if(!r.ok&&errSel){const e=$(errSel);if(e)e.textContent=r.j.error}return r;
}
function bzWire(){
  const sh=$('#bzshell');if(!sh)return;
  sh.onclick=e=>{const x=e.target.closest('.bz-x');if(x){const box=x.closest('.bz-links');if($$('.bz-lr',box).length>1)x.closest('.bz-lr').remove();else $('input',x.closest('.bz-lr')).value=''}};
  $$('[data-addlink]',sh).forEach(b=>b.onclick=()=>{const box=b.previousElementSibling;if($$('.bz-lr',box).length<+box.dataset.max)box.insertAdjacentHTML('beforeend',bzLinkRow({platform:'other',url:''}))});
  $$('[data-bzv]',sh).forEach(b=>b.onclick=()=>{BZ.view=b.dataset.bzv;BZ.sub=null;bzDraw()});
  $$('[data-sub]',sh).forEach(b=>b.onclick=()=>{BZ.sub=b.dataset.sub;bzDraw()});
  $$('[data-act]',sh).forEach(b=>b.onclick=()=>({topup:bzTopup,withdraw:bzWithdraw,items:bzItems})[b.dataset.act]());
  $$('[data-copy]',sh).forEach(b=>b.onclick=()=>navigator.clipboard.writeText(b.dataset.copy).then(()=>toast('Copied.'),()=>{}));
  $$('[data-bzsup]',sh).forEach(b=>b.onclick=()=>{bzClose();setTimeout(()=>go('support','new:business'),50)});
  // sign in
  const l1=$('#bzl1');if(l1)l1.onsubmit=async e=>{e.preventDefault();const name=$('#bzu').value.trim();if(!/^[A-Za-z0-9_]{3,20}$/.test(name)){$('#bze').textContent='Roblox usernames are 3 to 20 letters, numbers or underscores.';return}
    if(!WAPI.live){BZ.login={name,phrase:'TB amber otter maple 42',token:null};bzDraw();return}
    const r=await api('/api/auth/start',{username:name});if(!r.ok){$('#bze').textContent=r.j.error;return}BZ.login={name:r.j.username,phrase:r.j.phrase,token:r.j.token};bzDraw()};
  const l2=$('#bzl2');if(l2){$('#bzl0').onclick=()=>{BZ.login=null;bzDraw()};$('#bzcp').onclick=()=>navigator.clipboard.writeText(BZ.login.phrase).then(()=>$('#bzcp').textContent='Copied',()=>{});
    l2.onsubmit=async e=>{e.preventDefault();if(!$('#bzage').checked){$('#bze').textContent='Confirm you\'re 18 or older and accept the Terms.';return}
      const L=BZ.login;
      if(WAPI.live){const r=await fetch('/api/auth/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:L.token,acceptTos:LEGAL_V.tos,ref:TBDEV.ref()})});const j=await r.json().catch(()=>({}));if(!r.ok){$('#bze').textContent=j.error||'Could not verify. Try again.';return}}
      S.user={name:L.name};S.guest=false;S.legal={...(S.legal||{}),tos:LEGAL_V.tos};save();drawWho();BZ.login=null;if(WAPI.live)await syncMe();await bzLoad();bzDraw();toast(`Signed in as ${L.name}.`,'win')}}
  // apply, TEPP
  const ap=$('#bzapp');if(ap)ap.onsubmit=async e=>{e.preventDefault();const b={name:$('#ba-name').value,links:bzLinks(ap),audience:$('#ba-aud').value,discord:$('#ba-dc').value,why:$('#ba-why').value,agree:$('#ba-ok').checked};
    if(!WAPI.live){S.bizDemo={...BZ.me,status:'pending',form:b,appliedAt:Date.now(),review:{stage:'member',ahead:0,position:1,pending:1,estimateMs:48*36e5,expectedBy:Date.now()+48*36e5,basedOn:0}};save();await bzLoad();bzDraw();return}
    const r=await bzPost('/api/business/apply',b,'#bze');if(r.ok){BZ.me=r.j;bzDraw();toast('Application submitted.','win')}};
  const tp=$('#bztepp');if(tp)tp.onsubmit=async e=>{e.preventDefault();const r=await bzPost('/api/business/tepp',{plan:$('#bt-plan').value,cadence:$('#bt-cad').value,sample:$('#bt-vid').value,code:$('#bt-code').value,agree:$('#bt-ok').checked},'#bze');if(r.ok){BZ.me=r.j;bzDraw();toast('Partner Program application submitted.','win')}};
  // card
  const cf=$('#bzcard');if(cf){const prev=()=>{$('#bzprev').innerHTML=bzCardHtml({name:$('#bc-name').value,tagline:$('#bc-tag').value,accent:($('[name=bc-acc]:checked')||{}).value||'gold'},BZ.me.cardNo,BZ.me.balance)};cf.oninput=prev;cf.onchange=prev;
    cf.onsubmit=async e=>{e.preventDefault();const r=await bzPost('/api/business/card',{name:$('#bc-name').value,tagline:$('#bc-tag').value,accent:($('[name=bc-acc]:checked')||{}).value,links:bzLinks(cf)},'#bze');if(r.ok){const first=!BZ.me.card;BZ.me=CARD.me=r.j;BZ.sub=null;bzDraw();if(first)confetti(innerWidth/2,innerHeight/3,120);toast(first?'Your Business Card is ready.':'Card saved.','win')}}}
  // payment settings
  $$('[data-src]',sh).forEach(b=>b.onclick=async()=>{const r=await bzPost('/api/business/settings',{paySource:b.dataset.src});if(r.ok){BZ.me=CARD.me=r.j;bzDraw();toast(b.dataset.src==='card'?'Payments now come from your Business Card.':'Payments now come from your TradeBlacket balance.','win')}});
  $$('[data-auth]',sh).forEach(b=>b.onclick=()=>bzSecurity(b.dataset.auth));
  // youtube, requests
  const yt=$('#bzyt');if(yt)yt.onsubmit=async e=>{e.preventDefault();const r=await bzPost('/api/business/youtube',{channel:$('#by-url').value},'#bzye');if(r.ok){BZ.me=r.j;bzDraw()}};
  const yv=$('#bzyv');if(yv)yv.onclick=async()=>{yv.disabled=true;yv.textContent='Checking…';const r=await bzPost('/api/business/youtube/verify',{},'#bzye');if(r.ok){BZ.me=r.j;bzDraw();toast('Channel verified.','win')}else{yv.disabled=false;yv.textContent='Check my channel'}};
  const yr=$('#bzyr');if(yr)yr.onclick=()=>{BZ.me.youtube={};bzDraw()};
  const rq=$('#bzrq');if(rq)rq.onsubmit=async e=>{e.preventDefault();const r=await bzPost('/api/business/requests',{title:$('#br-t').value,body:$('#br-b').value},'#bzre');if(r.ok){BZ.me.requests=r.j.requests;bzDraw();toast('Request sent.','win')}};
  $$('[data-vote]',sh).forEach(b=>b.onclick=async()=>{const r=await bzPost(`/api/business/requests/${b.dataset.vote}/vote`,{});if(r.ok){BZ.me.requests=r.j.requests;bzDraw()}});
  // status pages refresh by themselves
  clearTimeout(BZ.t);if(BZ.me&&(BZ.me.status==='pending'||BZ.me.tepp==='pending'))BZ.t=setTimeout(async()=>{if(!$('#biz'))return;await bzLoad();bzDraw()},30000);
}
// Change how card payments are confirmed (the current method confirms the change).
async function bzSecurity(method){
  const m=BZ.me,P=m.pay,box=$('#bzsec');if(!box)return;
  const current=async()=>{if(P.method==='none')return{};const s=modal(`<div class="bzp"><h3>Confirm it's you</h3><div class="bzp-auth"></div><div class="bzp-err err"></div></div>`,{cls:'bzp-modal'});const a=await cardConfirmUI(s.root,P.method,'Confirm');s.close();return a};
  if(method==='pin'){box.innerHTML=`<form class="bz-form bz-inline" id="bzpin"><label class="bz-f"><span>New code (4 to 6 digits)</span><input class="bz-in" id="pin1" inputmode="numeric" maxlength="6" autocomplete="off"></label><label class="bz-f"><span>Repeat it</span><input class="bz-in" id="pin2" inputmode="numeric" maxlength="6" autocomplete="off"></label><div class="err" id="pine"></div><button class="bz-btn">Use this code</button></form>`;
    $('#bzpin').onsubmit=async e=>{e.preventDefault();const a=$('#pin1').value,b2=$('#pin2').value;if(!/^\d{4,6}$/.test(a))return $('#pine').textContent='Use 4 to 6 digits.';if(a!==b2)return $('#pine').textContent='The codes do not match.';
      const cur=await current();const r=await bzPost('/api/business/security',{method:'pin',pin:a,current:cur},'#pine');if(r.ok){BZ.me=CARD.me=r.j;bzDraw();toast('Card payments now need your code.','win')}};return}
  if(method==='device'){
    if(!window.PublicKeyCredential){box.innerHTML=`<p class="bz-meta bad">This browser can't use ${esc(DEVICE)}. Use a code instead.</p>`;return}
    if(P.method==='device')return;
    try{
      if(!P.hasDevice){
        const o=await api('/api/business/passkey/options',{kind:'register'});if(!o.ok)throw new Error(o.j.error);
        const c=await navigator.credentials.create({publicKey:{challenge:unb64u(o.j.challenge),rp:{name:'TradeBlacket Business',id:location.hostname},user:{id:unb64u(o.j.userId),name:o.j.name,displayName:o.j.name},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'discouraged'},attestation:'none',timeout:60000}});
        if(!c.response.getPublicKey)throw new Error('This browser is too old to set up your device. Use a code instead.');
        const r=await api('/api/business/passkey/register',{id:c.id,alg:c.response.getPublicKeyAlgorithm(),publicKey:b64u(c.response.getPublicKey()),clientDataJSON:b64u(c.response.clientDataJSON),current:{}});
        if(!r.ok)throw new Error(r.j.error);BZ.me=CARD.me=r.j;
      }
      const cur2=P.method==='none'?{}:await current();
      const r=await bzPost('/api/business/security',{method:'device',current:cur2});if(!r.ok)throw new Error(r.j.error);
      BZ.me=CARD.me=r.j;bzDraw();toast(`Card payments now need ${DEVICE}.`,'win');
    }catch(e){const b=$('#bzsec');if(b)b.innerHTML=`<p class="bz-meta bad">${esc(e&&e.name==='NotAllowedError'?'Set-up was cancelled.':(e.message||'Could not set up your device.'))}</p>`}
    return}
  if(P.method==='none')return;
  const cur=await current();const r=await bzPost('/api/business/security',{method:'none',current:cur},null);
  if(r.ok){BZ.me=CARD.me=r.j;bzDraw();toast('Card payments no longer need confirming.','win')}else box.innerHTML=`<p class="bz-meta bad">${esc(r.j.error)}</p>`;
}

/* ---------- the Business role elsewhere on the site ---------- */
const bzRole=b=>b?`<i class="bz-tag" title="TradeBlacket ${b.role}${b.verified?', verified creator':''}">${bzMono(12)}${b.role}${b.verified?' ✓':''}</i>`:'';
{const base=addChat;addChat=function(m){base(m);if(m.me&&WAPI.me&&WAPI.me.business){const l=$('#clist').lastElementChild,n=l&&l.querySelector('.msg-h b');if(n)n.insertAdjacentHTML('afterend',bzRole(WAPI.me.business))}}}
{const base=pfCard;pfCard=function(p,o){return base(p,o).replace('<div class="pf-badges">','<div class="pf-badges">'+bzRole(p.business))}}
{const base=drawWho;drawWho=function(){base();const n=$('#ubtn .nm b');if(n&&WAPI.me&&WAPI.me.business&&!n.querySelector('.bz-tag'))n.insertAdjacentHTML('beforeend',' '+bzRole(WAPI.me.business))}}
{const acc=[...$$('#nav h6')].find(h=>h.textContent==='Account');if(acc)acc.insertAdjacentHTML('beforebegin',`<button class="bz-navbtn" id="bznav" title="TradeBlacket Business">${bzMono(19)}<span>Business</span></button>`);const b=$('#bznav');if(b)b.onclick=()=>bzOpen()}
document.addEventListener('click',e=>{if(e.target.closest('[data-biz]'))bzOpen()});
// TradeBlacket Settings: choose the card or the balance (for partners)
{const base=PAGES.prefs;PAGES.prefs=el=>{base(el);const st=$('.st2',el);if(!st)return;cardLoad().then(c=>{if(!c||!c.card||!el.isConnected)return;
  st.insertAdjacentHTML('afterbegin',`<section class="card glass st2-sec st2-show"><h3>Business Card payments</h3><p class="note">Pay withdrawals and marketplace purchases with your Business Card instead of your balance.</p>
    <div class="show-opts two">${[['balance','TradeBlacket balance'],['card','Business Card']].map(([k,l])=>`<button data-psrc="${k}" class="${c.pay.source===k?'on':''}"><b>${l}</b></button>`).join('')}</div>
    <p class="note">Confirm with: ${{none:'nothing',pin:'a code',device:DEVICE}[c.pay.method]}. <button class="lnk" data-biz>Change in TradeBlacket Business</button></p></section>`);
  $$('[data-psrc]',el).forEach(b=>b.onclick=async()=>{const r=await api('/api/business/settings',{paySource:b.dataset.psrc});if(!r.ok)return toast(r.j.error,'loss');CARD.me=r.j;$$('[data-psrc]',el).forEach(x=>x.classList.toggle('on',x.dataset.psrc===r.j.pay.source));toast('Saved.','win')})})}}

// tradeblacket.com/business opens straight into the portal
if(location.pathname.replace(/\/+$/,'').toLowerCase()==='/business'){window.BIZ_MODE=true;bzOpen(false)}

/* ---------- Admin → Business (moderators) ---------- */
async function admBusiness(box){
  if(!WAPI.live){box.innerHTML='<p class="note">Preview: Business moderation runs on the live site.</p>';return}
  const r=await api('/api/admin/business');if(!box.isConnected)return;if(!r.ok){box.innerHTML=`<p class="note">${esc(r.j.error)}</p>`;return}
  admBzDraw(box,r.j);
}
function admBzDraw(box,D){
  const M=D.members,pend=M.filter(m=>m.status==='pending'),tepp=M.filter(m=>m.status==='approved'&&m.tepp==='pending'),mem=M.filter(m=>m.status==='approved');
  const links=f=>(f.links||[]).map(l=>`<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(PLAT[l.platform]||l.platform)}</a>`).join(' · ');
  const app=(m,stage)=>{const f=stage==='tepp'?(m.teppForm||{}):m.form;return`<article class="card abz-app"><header>${plLink(m.robloxId,m.username)}<span class="note">${stage==='tepp'?'TEPP application':'Business application'} · ${dtt(stage==='tepp'?m.teppAt:m.appliedAt)}</span></header>
    ${stage==='tepp'?`<p><b>Plan:</b> ${esc(f.plan||'')}</p><p class="note">Posts: ${esc(f.cadence||'')}${f.sample?` · <a href="${esc(f.sample)}" target="_blank" rel="noopener noreferrer">example video</a>`:''}${f.code?` · wants code <b>${esc(f.code)}</b>`:''}</p>`:`<p><b>${esc(f.name||'')}</b> · ${fmt0(f.audience||0)} followers · Discord ${esc(f.discord||'–')}</p><p class="note">${links(f)}</p><p>${esc(f.why||'')}</p>`}
    <div class="wl-row"><input class="txt" placeholder="Note to the creator (optional)" data-bznote="${m.robloxId}"><button class="cta inline" data-bzdec="${m.robloxId}" data-stage="${stage}" data-ok="1">Approve</button><button class="cta ghost inline" data-bzdec="${m.robloxId}" data-stage="${stage}" data-ok="0">Decline</button></div></article>`};
  const ST={open:'Open',planned:'Planned',building:'Building',done:'Shipped',declined:'Not planned'};
  box.innerHTML=`<div class="sec-h"><h3 class="sec">Waiting for a decision</h3><span class="note">${pend.length} Business · ${tepp.length} TEPP</span></div>
    ${pend.map(m=>app(m,'member')).join('')}${tepp.map(m=>app(m,'tepp')).join('')}${pend.length+tepp.length?'':'<p class="note">Nothing waiting.</p>'}
    <div class="sec-h"><h3 class="sec">Members (${mem.length})</h3><span class="note">1 US dollar = ${fmt0(D.roduxPerUsd)} Rodux</span></div>
    ${plTable(['Creator','Role','Card','On card','YouTube','Pay the card','Giveaway codes',''],mem.map(m=>[`${plLink(m.robloxId,m.username)}<br><small>${esc((m.form||{}).name||'')}</small>`,m.tepp==='approved'?'<span class="ac-pill is-gold">Partner</span>':'Business'+(m.tepp==='rejected'?' <small>(TEPP declined)</small>':''),m.card?`<small>${esc(m.cardNo)}</small>`:'<small>No card yet</small>',`${usd2(m.balance.usd)}<br><small>${fmt0(m.balance.rodux)} Rodux</small>`,
      m.youtube.url?`<a href="${esc(m.youtube.url)}" target="_blank" rel="noopener noreferrer">Channel</a> ${m.youtube.verified?'✓':`<button class="lnk" data-bzyt="${m.robloxId}">Verify</button>`}`:'<small>Not linked</small>',
      m.tepp==='approved'?`<div class="abz-pay"><input class="txt" type="number" min="0" step="any" placeholder="Amount" data-bzamt="${m.robloxId}"><select class="txt" data-bzcur="${m.robloxId}"><option value="usd">USD</option><option value="rodux">Rodux</option></select><button class="cta inline" data-bzpay="${m.robloxId}">Pay</button></div>`:'<small>Partners only</small>',
      `<div class="abz-pay"><select class="txt" data-bzcu="${m.robloxId}"><option>5</option><option selected>10</option><option>100</option><option>500</option></select><input class="txt" type="number" min="1" max="100" value="1" data-bzcn="${m.robloxId}"><button class="cta ghost inline" data-bzcodes="${m.robloxId}">Give</button></div><small>${m.codes} given</small>`,
      `<button class="lnk" data-bzsus="${m.robloxId}">Suspend</button>`]),'No members yet.')}
    <div class="sec-h"><h3 class="sec">Feature requests</h3></div>
    ${D.requests.length?D.requests.map(q=>`<article class="card abz-req"><div><b>${esc(q.title)}</b> <span class="note">▲ ${q.votes} · ${esc(q.by||'')} · ${dt(q.at)}</span><p>${esc(q.body)}</p></div><div class="wl-row"><select class="txt" data-bzrs="${q.id}">${Object.entries(ST).map(([k,l])=>`<option value="${k}" ${q.status===k?'selected':''}>${l}</option>`).join('')}</select><input class="txt" placeholder="Reply to creators" value="${esc(q.reply||'')}" data-bzrr="${q.id}"><button class="cta inline" data-bzrq="${q.id}">Save</button></div></article>`).join(''):'<p class="note">No requests yet.</p>'}`;
  const run=async(p,b,msg)=>{const x=await api(p,b);if(!x.ok)return toast(x.j.error,'loss');toast(msg,'win');admBzDraw(box,x.j)};
  $$('[data-bzdec]',box).forEach(b=>b.onclick=()=>{const id=b.dataset.bzdec,ok=b.dataset.ok==='1';run('/api/admin/business/decide',{robloxId:id,stage:b.dataset.stage,approve:ok,note:($(`[data-bznote="${id}"]`,box)||{}).value},ok?'Approved.':'Declined.')});
  $$('[data-bzpay]',box).forEach(b=>b.onclick=()=>{const id=b.dataset.bzpay;run('/api/admin/business/payout',{robloxId:id,amount:$(`[data-bzamt="${id}"]`,box).value,currency:$(`[data-bzcur="${id}"]`,box).value},'Paid to their card.')});
  $$('[data-bzcodes]',box).forEach(b=>b.onclick=()=>{const id=b.dataset.bzcodes;run('/api/admin/business/codes',{robloxId:id,usd:Number($(`[data-bzcu="${id}"]`,box).value),count:$(`[data-bzcn="${id}"]`,box).value},'Giveaway codes sent.')});
  $$('[data-bzyt]',box).forEach(b=>b.onclick=()=>run('/api/admin/business/youtube',{robloxId:b.dataset.bzyt,verified:true},'Channel marked verified.'));
  $$('[data-bzsus]',box).forEach(b=>b.onclick=()=>run('/api/admin/business/decide',{robloxId:b.dataset.bzsus,stage:'suspend'},'Membership suspended.'));
  $$('[data-bzrq]',box).forEach(b=>b.onclick=()=>{const id=b.dataset.bzrq;run('/api/admin/business/request',{id,status:$(`[data-bzrs="${id}"]`,box).value,reply:$(`[data-bzrr="${id}"]`,box).value},'Request updated.')});
}
