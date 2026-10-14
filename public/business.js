'use strict';
/* =========================================================
   TradeBlacket Business (tradeblacket.com/business): its own black-and-gold space for creators.
   Sign in with Roblox → join the registry (moderators approve) → apply for TEPP, the Trade Empire
   Partner Program → create your Business Card → get paid in dollars or Rodux, take it out as Rodux
   or as limiteds. Members get the Business role on their profile and in chat, giveaway codes,
   direct support, feature requests and YouTube verification.
   ========================================================= */
const BZ={me:null,tab:'card',shop:null,pick:new Set(),login:null};
const BZ_PERKS=[['role','The Business role','A gold Business badge on your profile and next to your name in chat, so players know you\'re the real deal.'],['pay','Payouts on your card','Get paid in US dollars or Rodux. Take it out as Rodux or as limiteds you can withdraw to Trade Empire.'],['gift','Giveaway codes','Gift cards from the Trade Empire team to give away to your audience.'],['support','Direct support','A line straight to the team, answered first.'],['ideas','Shape the site','Request features and vote on what gets built next.'],['yt','Verified channel','Link your YouTube channel and show it\'s verified.']];
const BZ_STEPS=['Sign in','Join the registry','Approval','TEPP','Business Card'];
const PLAT={youtube:'YouTube',tiktok:'TikTok',twitch:'Twitch',x:'X',discord:'Discord',other:'Website'};
const ACC={gold:['#E9C66B','#8A6A22'],champagne:['#F3E2B3','#A08A5B'],rose:['#E8B4A0','#8E5A48'],platinum:['#E2E5EA','#7C8591'],emerald:['#9FE3C0','#2F7A57']};
const usd2=v=>'$'+(+v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const bzMono=s=>`<svg width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="10" fill="#0A0A0C" stroke="url(#bzg)" stroke-width="1.5"/><defs><linearGradient id="bzg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6E3A8"/><stop offset=".5" stop-color="#D4AF37"/><stop offset="1" stop-color="#8A6A22"/></linearGradient></defs><path d="M11 12h18M20 12v17" stroke="url(#bzg)" stroke-width="3.4" stroke-linecap="round"/><circle cx="27.5" cy="26.5" r="3.2" fill="none" stroke="url(#bzg)" stroke-width="2.4"/></svg>`;

function bzStage(m){
  if(!S.user)return 0;if(!m||m.status==='none'||m.status==='rejected')return 1;if(m.status==='pending')return 2;
  if(m.tepp!=='approved')return 3;return m.card?5:4;
}
async function bzLoad(){
  await WAPI.ready;
  if(!S.user){BZ.me=null;return}
  if(!WAPI.live){BZ.me=S.bizDemo||{status:'none',cardNo:'TBB 7K2Q M9XD 4PLW',roduxPerUsd:RATE.roduxPerUsd,platforms:Object.keys(PLAT),accents:Object.keys(ACC)};return}
  const r=await api('/api/business/me');BZ.me=r.ok?r.j:{status:'none',error:r.j.error};
}

/* ---------- the frame ---------- */
function bzOpen(push=true){
  window.BIZ_MODE=true;document.body.classList.add('biz-on');
  const g=$('#gate');if(g&&!S.user)g.innerHTML='';swClose&&swClose();
  if(push&&location.pathname!=='/business')try{history.pushState(null,'','/business')}catch{}
  let el=$('#biz');if(!el){el=document.createElement('div');el.id='biz';el.setAttribute('role','region');el.setAttribute('aria-label','TradeBlacket Business');document.body.appendChild(el)}
  el.innerHTML=`<header class="bz-top"><a class="bz-brand" href="/business">${bzMono(34)}<span><b>TradeBlacket</b><i>Business</i></span></a><div class="bz-acct" id="bzacct"></div></header><main class="bz-main" id="bzmain"><div class="spin"></div></main>
    <footer class="bz-foot"><span>TradeBlacket Business is for creators who make Trade Empire content. 18+.</span><button data-legal="tos">Terms</button><button id="bzback">Back to TradeBlacket</button></footer>`;
  $('#bzback',el).onclick=bzClose;
  bzLoad().then(bzDraw);
}
function bzClose(){
  window.BIZ_MODE=false;document.body.classList.remove('biz-on');const el=$('#biz');if(el)el.remove();
  try{history.pushState(null,'','/')}catch{}
  if(!S.user&&window.TB_GATE!==false)showGate('in');else{go('home');siteGate()}
}
addEventListener('popstate',()=>{if(location.pathname==='/business'&&!$('#biz'))bzOpen(false);else if(location.pathname!=='/business'&&$('#biz'))bzClose()});

function bzDraw(){
  const main=$('#bzmain'),acct=$('#bzacct');if(!main)return;
  const m=BZ.me,st=bzStage(m);
  acct.innerHTML=S.user?`<span class="bz-who">${avatar(me(),28)}<b>${esc(S.user.name)}</b>${m&&m.status==='approved'?`<i class="bz-role">${m.tepp==='approved'?'Partner':'Business'}</i>`:''}</span>`:'';
  const rail=`<ol class="bz-steps" aria-label="Your progress">${BZ_STEPS.map((s,i)=>`<li class="${i<st?'done':i===st?'cur':''}"><i>${i<st?'✓':i+1}</i><span>${s}</span></li>`).join('')}</ol>`;
  let body='';
  if(st===0)body=bzLanding();
  else if(st===1)body=bzApplyForm(m);
  else if(st===2)body=bzWait('Your application is being reviewed','A moderator reads every application. You\'ll see the answer here, usually within a couple of days.',m.appliedAt);
  else if(st===3)body=bzMember(m);
  else if(st===4)body=bzCardBuilder(m,true);
  else body=bzDash(m);
  main.innerHTML=(st>0?rail:'')+`<div class="bz-body">${body}</div>`;
  bzWire(st);
}

/* ---------- signed out ---------- */
function bzLanding(){
  return`<section class="bz-hero"><div class="bz-hcopy"><p class="bz-kicker">For Trade Empire creators</p><h1>TradeBlacket <em>Business</em></h1>
    <p>One place for the creators who grow Trade Empire: get recognised, get paid, and get a direct line to the team.</p>
    <div class="bz-login" id="bzlogin">${bzLoginStep()}</div></div>
    <div class="bz-hcard">${bzCardHtml({name:'Your name here',tagline:'Trade Empire creator',accent:'gold'},'TBB •••• •••• ••••',{usd:250,rodux:500000},true)}</div></section>
    <section class="bz-perks">${BZ_PERKS.map(([k,t,d])=>`<article><h3>${t}</h3><p>${d}</p></article>`).join('')}</section>
    <section class="bz-how"><h2>How it works</h2><ol>${['Sign in with your Roblox account.','Join the registry. A moderator reviews your channels.','Apply for TEPP, the Trade Empire Partner Program.','Create your Business Card and start getting paid.'].map(s=>`<li>${s}</li>`).join('')}</ol></section>`;
}
function bzLoginStep(){
  const L=BZ.login;
  if(!L)return`<form id="bzl1" class="bz-lf"><label for="bzu">Your Roblox username</label><div><input id="bzu" class="bz-in" autocomplete="username" maxlength="20" placeholder="Roblox username"><button class="bz-btn">Continue</button></div><div class="err" id="bze"></div></form>`;
  return`<form id="bzl2" class="bz-lf"><p>Add this phrase anywhere in your Roblox profile's About section, save, then press Verify.</p>
    <div class="bz-phrase"><code>${esc(L.phrase)}</code><button type="button" id="bzcp">Copy</button></div>
    <label class="bz-chk"><input type="checkbox" id="bzage"> I'm 18 or older and accept the <button type="button" class="lnk" data-legal="tos">Terms of Service</button>.</label>
    <div><button class="bz-btn">Verify ${esc(L.name)}</button><button type="button" class="bz-btn ghost" id="bzl0">Back</button></div><div class="err" id="bze"></div></form>`;
}

/* ---------- registry ---------- */
function bzLinkRows(links,max){return`<div class="bz-links" data-max="${max}">${(links&&links.length?links:[{platform:'youtube',url:''}]).map(l=>bzLinkRow(l)).join('')}</div><button type="button" class="bz-add" data-addlink>+ Add another link</button>`}
const bzLinkRow=l=>`<div class="bz-lr"><select class="bz-in" aria-label="Platform">${Object.entries(PLAT).map(([k,v])=>`<option value="${k}" ${l.platform===k?'selected':''}>${v}</option>`).join('')}</select><input class="bz-in" type="url" placeholder="https://" value="${esc(l.url||'')}" aria-label="Link"><button type="button" class="bz-x" aria-label="Remove link">×</button></div>`;
function bzApplyForm(m){
  const f=(m&&m.form)||{};
  return`${m&&m.status==='rejected'?`<div class="bz-note bad"><b>Your last application was declined.</b>${m.note?` ${esc(m.note)}`:''} You can apply again 7 days after the decision.</div>`:''}
  <form class="bz-card" id="bzapp"><h2>Join the TradeBlacket Business registry</h2><p class="bz-sub">Tell us who you are and where you post. Moderators approve every member by hand.</p>
    <label class="bz-f"><span>Creator name</span><input class="bz-in" id="ba-name" maxlength="40" value="${esc(f.name||S.user.name)}"></label>
    <div class="bz-f"><span>Your channels and profiles</span>${bzLinkRows(f.links,6)}</div>
    <div class="bz-row2"><label class="bz-f"><span>Total followers or subscribers</span><input class="bz-in" id="ba-aud" type="number" min="0" value="${f.audience||''}" placeholder="e.g. 12000"></label><label class="bz-f"><span>Discord (so we can reach you)</span><input class="bz-in" id="ba-dc" maxlength="40" value="${esc(f.discord||'')}"></label></div>
    <label class="bz-f"><span>Your content</span><textarea class="bz-in" id="ba-why" rows="5" maxlength="1000" placeholder="What do you make, how often, and why Trade Empire?">${esc(f.why||'')}</textarea></label>
    <label class="bz-chk"><input type="checkbox" id="ba-ok"> I make my own content, I won't sell or misuse giveaway codes, and I accept that membership can be removed for breaking the rules.</label>
    <div class="err" id="bze"></div><button class="bz-btn">Send application</button></form>`;
}
function bzWait(t,d,at){return`<section class="bz-card bz-wait"><div class="bz-pulse"></div><h2>${t}</h2><p class="bz-sub">${d}</p>${at?`<p class="bz-meta">Sent ${new Date(at).toLocaleString()}</p>`:''}</section>`}

/* ---------- member, before TEPP ---------- */
function bzMember(m){
  const t=m.tepp;
  return`<div class="bz-grid">
    <section class="bz-card"><p class="bz-kicker">Approved</p><h2>Welcome to TradeBlacket Business</h2><p class="bz-sub">You now have the Business role on your profile and in chat, direct support and the feature board. To get a Business Card and payouts, join the Trade Empire Partner Program.</p>
      ${t==='pending'?bzWait('Your TEPP application is being reviewed','We look at your plan and your recent videos.',m.teppAt):`${t==='rejected'?`<div class="bz-note bad"><b>Your TEPP application was declined.</b>${m.teppNote?` ${esc(m.teppNote)}`:''} You can apply again after 14 days.</div>`:''}
      <form id="bztepp" class="bz-form"><h3>Apply for TEPP</h3>
        <label class="bz-f"><span>The Trade Empire content you'll make</span><textarea class="bz-in" id="bt-plan" rows="5" maxlength="1500" placeholder="Series ideas, formats, how you'll show the game"></textarea></label>
        <div class="bz-row2"><label class="bz-f"><span>How often you post</span><input class="bz-in" id="bt-cad" maxlength="60" placeholder="e.g. Twice a week"></label><label class="bz-f"><span>A recent video (optional)</span><input class="bz-in" id="bt-vid" type="url" placeholder="https://"></label></div>
        <label class="bz-f"><span>The creator code you'd like (optional)</span><input class="bz-in" id="bt-code" maxlength="16" placeholder="e.g. BOB"></label>
        <label class="bz-chk"><input type="checkbox" id="bt-ok"> I'll follow the Partner Program rules: honest content, no scams, no paid views.</label>
        <div class="err" id="bze"></div><button class="bz-btn">Apply for TEPP</button></form>`}
    </section>
    <div class="bz-stack">${bzYoutube(m)}${bzSupport()}</div></div>${bzRequests(m)}`;
}

/* ---------- the Business Card ---------- */
function bzCardHtml(c,no,bal,demo){
  const [a,b]=ACC[c.accent]||ACC.gold;
  return`<div class="bzc" style="--ca:${a};--cb:${b}"><div class="bzc-shine"></div>
    <div class="bzc-top">${bzMono(30)}<span>TRADEBLACKET <b>BUSINESS</b></span></div>
    <div class="bzc-chip"><i></i></div>
    <div class="bzc-no">${esc(no)}</div>
    <div class="bzc-bot"><div><small>${demo?'Card holder':'Partner'}</small><b>${esc(c.name||'')}</b><span>${esc(c.tagline||'')}</span></div>${bal?`<div class="bzc-bal"><small>On card</small><b>${usd2(bal.usd||0)}</b><span>${fmt0(bal.rodux||0)} Rodux</span></div>`:''}</div></div>`;
}
function bzCardBuilder(m,first){
  const c=m.card||{name:(m.form&&m.form.name)||S.user.name,tagline:'',accent:'gold',links:(m.form&&m.form.links||[]).slice(0,4)};
  return`<div class="bz-grid builder"><section class="bz-card"><p class="bz-kicker">${first?'You\'re a Trade Empire Partner':'Edit your card'}</p><h2>${first?'Create your Business Card':'Your Business Card'}</h2><p class="bz-sub">Your card is where your payouts land. Players see your name, tagline and links on your profile.</p>
    <form id="bzcard" class="bz-form">
      <label class="bz-f"><span>Name on the card</span><input class="bz-in" id="bc-name" maxlength="32" value="${esc(c.name||'')}"></label>
      <label class="bz-f"><span>Tagline</span><input class="bz-in" id="bc-tag" maxlength="70" value="${esc(c.tagline||'')}" placeholder="e.g. Trade Empire tips every Friday"></label>
      <div class="bz-f"><span>Finish</span><div class="bz-acc">${Object.keys(ACC).map(k=>`<label title="${k}"><input type="radio" name="bc-acc" value="${k}" ${c.accent===k?'checked':''}><i style="--a:${ACC[k][0]};--b:${ACC[k][1]}"></i><span>${k[0].toUpperCase()+k.slice(1)}</span></label>`).join('')}</div></div>
      <div class="bz-f"><span>Links on your card</span>${bzLinkRows(c.links,4)}</div>
      <div class="err" id="bze"></div><div class="bz-btns"><button class="bz-btn">${first?'Create my card':'Save card'}</button>${first?'':'<button type="button" class="bz-btn ghost" data-bztab="card">Cancel</button>'}</div></form></section>
    <div class="bz-preview" id="bzprev">${bzCardHtml(c,m.cardNo,m.balance)}</div></div>`;
}

/* ---------- partner dashboard ---------- */
function bzDash(m){
  const T=[['card','Card'],['withdraw','Withdraw'],['codes','Giveaway codes'],['requests','Feature requests'],['channel','Channel & support']];
  let body='';
  if(BZ.tab==='card')body=`<div class="bz-grid"><div class="bz-preview">${bzCardHtml(m.card,m.cardNo,m.balance)}<button class="bz-add" data-bztab="edit">Edit card</button></div>
    <section class="bz-card"><h3>On your card</h3><div class="bz-bal"><div><small>US dollars</small><b>${usd2(m.balance.usd)}</b></div><div><small>Rodux</small><b>${fmt0(m.balance.rodux)}</b></div></div>
      <p class="bz-meta">Dollars become Rodux at ${fmt0(m.roduxPerUsd)} Rodux per $1, from what Rodux costs in Trade Empire.</p>
      <div class="bz-btns"><button class="bz-btn" data-bztab="withdraw">Withdraw</button></div>
      <h3>History</h3>${m.ledger.length?`<ul class="bz-led">${m.ledger.map(l=>`<li><span class="bz-k ${l.kind}">${{payout:'Payout','withdraw-rodux':'To Rodux','withdraw-items':'To limiteds'}[l.kind]||l.kind}</span><div><b>${l.kind==='payout'?'+':'−'}${l.currency==='USD'?usd2(Math.abs(l.amount)):fmt0(Math.abs(l.amount))+' Rodux'}</b><small>${esc(l.note||'')} · ${new Date(l.at).toLocaleString()}${l.ref?` · ${esc(l.ref)}`:''}</small></div></li>`).join('')}</ul>`:'<p class="bz-meta">No payouts yet. When the team pays you, it shows up here.</p>'}</section></div>`;
  if(BZ.tab==='edit')body=bzCardBuilder(m,false);
  if(BZ.tab==='withdraw'){
    const sh=BZ.shop,pick=sh?sh.listings.filter(l=>BZ.pick.has(l.id)):[],tot=pick.reduce((s,l)=>s+l.price,0),can=m.balance.roduxValue;
    body=`<div class="bz-grid"><section class="bz-card"><h3>As Rodux</h3><p class="bz-sub">Goes to your TradeBlacket balance. You can withdraw it to Trade Empire from the wallet, like deposited Rodux.</p>
      <form id="bzwr" class="bz-form"><div class="bz-seg"><label><input type="radio" name="bw-from" value="usd" ${m.balance.usd>=1?'checked':''}><span>From dollars (${usd2(m.balance.usd)})</span></label><label><input type="radio" name="bw-from" value="rodux" ${m.balance.usd<1?'checked':''}><span>From Rodux (${fmt0(m.balance.rodux)})</span></label></div>
        <label class="bz-f"><span>Amount</span><input class="bz-in" id="bw-amt" type="number" min="1" step="any"></label><p class="bz-meta" id="bw-est"></p>
        <div class="err" id="bze"></div><button class="bz-btn">Withdraw as Rodux</button></form></section>
      <section class="bz-card"><h3>As limiteds</h3><p class="bz-sub">Pick limiteds TradeBlacket owns. They go to your Limiteds, and you can withdraw them to your Trade Empire save. Rodux on your card pays first, then dollars.</p>
        <div class="bz-shop" id="bzshop">${sh?(sh.listings.length?sh.listings.map(l=>`<button class="bz-it${BZ.pick.has(l.id)?' on':''}" data-pick="${esc(l.id)}">${l.img?`<img src="${esc(l.img)}" alt="" loading="lazy">`:'<span></span>'}<b>${esc(l.name||'Item '+l.itemId)}</b><small>#${l.serial} · ${fmt0(l.price)}</small></button>`).join(''):'<p class="bz-meta">TradeBlacket has no limiteds available right now.</p>'):'<div class="spin"></div>'}</div>
        <div class="bz-tot"><span>${pick.length} picked · ${fmt0(tot)} Rodux</span><span class="${tot>can?'bad':''}">Your card: ${fmt0(can)} Rodux worth</span></div>
        <div class="err" id="bze2"></div><button class="bz-btn" id="bzwi" ${!pick.length||tot>can?'disabled':''}>Take ${pick.length||''} limited${pick.length===1?'':'s'}</button></section></div>`;
  }
  if(BZ.tab==='codes')body=`<section class="bz-card"><h3>Giveaway codes</h3><p class="bz-sub">Gift cards from the Trade Empire team for your audience. Give each code to one winner. Don't sell them.</p>
    ${m.codes.length?`<div class="bz-codes">${m.codes.map(c=>`<div class="bz-code ${c.status}"><b>USD $${c.usd}</b><code>${esc(c.code)}</code><span>${c.status==='redeemed'?`Redeemed by ${esc(c.redeemedBy||'a player')}`:c.status==='active'?'Not used yet':esc(c.status)}</span>${c.status==='active'?`<button class="bz-add" data-copy="${esc(c.code)}">Copy</button>`:''}</div>`).join('')}</div>`:'<p class="bz-meta">No codes yet. Ask the team for a giveaway through direct support.</p>'}</section>`;
  if(BZ.tab==='requests')body=bzRequests(m);
  if(BZ.tab==='channel')body=`<div class="bz-grid">${bzYoutube(m)}${bzSupport()}</div>`;
  return`<nav class="bz-tabs">${T.map(([k,l])=>`<button data-bztab="${k}" class="${BZ.tab===k||(BZ.tab==='edit'&&k==='card')?'on':''}">${l}</button>`).join('')}</nav>${body}`;
}
function bzYoutube(m){
  const y=m.youtube||{};
  return`<section class="bz-card"><h3>YouTube channel ${y.verified?'<i class="bz-ver">Verified</i>':''}</h3>
    ${y.verified?`<p class="bz-sub">${esc(y.url)}</p><p class="bz-meta">Your profile shows your channel as verified.</p>`:y.url&&y.phrase?`<p class="bz-sub">Put this code in your channel description on YouTube, save, then check.</p><div class="bz-phrase"><code>${esc(y.phrase)}</code><button type="button" data-copy="${esc(y.phrase)}">Copy</button></div><p class="bz-meta">${esc(y.url)}</p><div class="err" id="bzye"></div><div class="bz-btns"><button class="bz-btn" id="bzyv">Check my channel</button><button class="bz-btn ghost" id="bzyr">Change channel</button></div>`:
    `<form id="bzyt" class="bz-form"><label class="bz-f"><span>Your channel link</span><input class="bz-in" id="by-url" placeholder="https://www.youtube.com/@yourname"></label><div class="err" id="bzye"></div><button class="bz-btn">Connect</button></form>`}</section>`;
}
function bzSupport(){return`<section class="bz-card"><h3>Direct support</h3><p class="bz-sub">Questions about payouts, giveaways or your membership go straight to the team and are answered first.</p><button class="bz-btn" id="bzsup">Message the team</button></section>`}
function bzRequests(m){
  const R=m.requests||[],ST={open:'Open',planned:'Planned',building:'Building',done:'Shipped',declined:'Not planned'};
  return`<section class="bz-card bz-reqs"><h3>Feature requests</h3><p class="bz-sub">What would help you make better Trade Empire content? Vote on what matters to you.</p>
    <form id="bzrq" class="bz-form"><div class="bz-row2"><input class="bz-in" id="br-t" maxlength="90" placeholder="Short title"><button class="bz-btn">Send request</button></div><textarea class="bz-in" id="br-b" rows="3" maxlength="1500" placeholder="What do you need, and why?"></textarea><div class="err" id="bzre"></div></form>
    <ul class="bz-rl">${R.map(r=>`<li><button class="bz-vote${r.voted?' on':''}" data-vote="${r.id}" aria-label="Vote">▲<b>${r.votes}</b></button><div><b>${esc(r.title)}</b><p>${esc(r.body)}</p>${r.reply?`<p class="bz-reply"><span>Team:</span> ${esc(r.reply)}</p>`:''}<small>${esc(r.by||'')} · ${new Date(r.at).toLocaleDateString()}</small></div><span class="bz-st ${r.status}">${ST[r.status]||r.status}</span></li>`).join('')||'<p class="bz-meta">No requests yet. Be the first.</p>'}</ul></section>`;
}

/* ---------- wiring ---------- */
const bzLinks=box=>[...$$('.bz-lr',box)].map(r=>({platform:$('select',r).value,url:$('input',r).value.trim()})).filter(l=>l.url);
async function bzPost(p,b,errSel){
  if(!WAPI.live)return{ok:false,j:{error:'Preview: TradeBlacket Business runs on the live site.'}};
  const r=await api(p,b);if(!r.ok&&errSel){const e=$(errSel);if(e)e.textContent=r.j.error}return r;
}
function bzWire(st){
  const main=$('#bzmain');
  $$('[data-addlink]',main).forEach(b=>b.onclick=()=>{const box=b.previousElementSibling;if($$('.bz-lr',box).length>=+box.dataset.max)return;box.insertAdjacentHTML('beforeend',bzLinkRow({platform:'other',url:''}))});
  main.onclick=e=>{const x=e.target.closest('.bz-x');if(x){const box=x.closest('.bz-links');if($$('.bz-lr',box).length>1)x.closest('.bz-lr').remove();else $('input',x.closest('.bz-lr')).value=''}};
  $$('[data-bztab]',main).forEach(b=>b.onclick=()=>{BZ.tab=b.dataset.bztab;if(BZ.tab==='withdraw'&&!BZ.shop)bzShop();bzDraw()});
  // sign in
  const l1=$('#bzl1');if(l1)l1.onsubmit=async e=>{e.preventDefault();const name=$('#bzu').value.trim();if(!/^[A-Za-z0-9_]{3,20}$/.test(name)){$('#bze').textContent='Roblox usernames are 3 to 20 letters, numbers or underscores.';return}
    if(!WAPI.live){BZ.login={name,phrase:'TB amber otter maple 42',token:null};$('#bzlogin').innerHTML=bzLoginStep();bzWire(0);return}
    const r=await api('/api/auth/start',{username:name});if(!r.ok){$('#bze').textContent=r.j.error;return}BZ.login={name:r.j.username,phrase:r.j.phrase,token:r.j.token};$('#bzlogin').innerHTML=bzLoginStep();bzWire(0)};
  const l2=$('#bzl2');if(l2){$('#bzl0').onclick=()=>{BZ.login=null;$('#bzlogin').innerHTML=bzLoginStep();bzWire(0)};
    $('#bzcp').onclick=()=>navigator.clipboard.writeText(BZ.login.phrase).then(()=>$('#bzcp').textContent='Copied',()=>{});
    l2.onsubmit=async e=>{e.preventDefault();if(!$('#bzage').checked){$('#bze').textContent='Confirm you\'re 18 or older and accept the Terms.';return}
      const L=BZ.login;
      if(WAPI.live){const r=await fetch('/api/auth/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:L.token,acceptTos:LEGAL_V.tos,ref:TBDEV.ref()})});const j=await r.json().catch(()=>({}));if(!r.ok){$('#bze').textContent=j.error||'Could not verify. Try again.';return}}
      S.user={name:L.name};S.guest=false;S.legal={...(S.legal||{}),tos:LEGAL_V.tos};save();drawWho();BZ.login=null;
      if(WAPI.live)await syncMe();await bzLoad();bzDraw();toast(`Signed in as ${L.name}.`,'win')}}
  // registry
  const ap=$('#bzapp');if(ap)ap.onsubmit=async e=>{e.preventDefault();const b={name:$('#ba-name').value,links:bzLinks(ap),audience:$('#ba-aud').value,discord:$('#ba-dc').value,why:$('#ba-why').value,agree:$('#ba-ok').checked};
    if(!WAPI.live){S.bizDemo={...BZ.me,status:'pending',form:b,appliedAt:Date.now()};save();await bzLoad();bzDraw();return}
    const r=await bzPost('/api/business/apply',b,'#bze');if(r.ok){BZ.me=r.j;bzDraw();toast('Application sent.','win')}};
  const tp=$('#bztepp');if(tp)tp.onsubmit=async e=>{e.preventDefault();const r=await bzPost('/api/business/tepp',{plan:$('#bt-plan').value,cadence:$('#bt-cad').value,sample:$('#bt-vid').value,code:$('#bt-code').value,agree:$('#bt-ok').checked},'#bze');if(r.ok){BZ.me=r.j;bzDraw();toast('TEPP application sent.','win')}};
  // card
  const cf=$('#bzcard');if(cf){const prev=()=>{const c={name:$('#bc-name').value,tagline:$('#bc-tag').value,accent:($('[name=bc-acc]:checked')||{}).value||'gold'};$('#bzprev').innerHTML=bzCardHtml(c,BZ.me.cardNo,BZ.me.balance)};cf.oninput=prev;cf.onchange=prev;
    cf.onsubmit=async e=>{e.preventDefault();const r=await bzPost('/api/business/card',{name:$('#bc-name').value,tagline:$('#bc-tag').value,accent:($('[name=bc-acc]:checked')||{}).value,links:bzLinks(cf)},'#bze');if(r.ok){const first=!BZ.me.card;BZ.me=r.j;BZ.tab='card';bzDraw();if(first)confetti(innerWidth/2,innerHeight/3,140);toast(first?'Your Business Card is ready.':'Card saved.','win')}}}
  // withdraw
  const wr=$('#bzwr');if(wr){const est=()=>{const f=($('[name=bw-from]:checked')||{}).value,a=+$('#bw-amt').value||0;$('#bw-est').textContent=a>0?(f==='usd'?`${usd2(a)} = ${fmt0(Math.floor(a*BZ.me.roduxPerUsd))} Rodux`:`${fmt0(Math.floor(a))} Rodux`):''};wr.oninput=est;
    wr.onsubmit=async e=>{e.preventDefault();const r=await bzPost('/api/business/withdraw',{from:($('[name=bw-from]:checked')||{}).value,amount:$('#bw-amt').value},'#bze');if(r.ok){BZ.me=r.j;await syncMe();bzDraw();toast(`+${fmt0(r.j.paid.rodux)} Rodux on your TradeBlacket balance.`,'win')}}}
  $$('[data-pick]',main).forEach(b=>b.onclick=()=>{const id=b.dataset.pick;BZ.pick.has(id)?BZ.pick.delete(id):BZ.pick.add(id);bzDraw()});
  const wi=$('#bzwi');if(wi)wi.onclick=async()=>{wi.disabled=true;const r=await bzPost('/api/business/withdraw-items',{listings:[...BZ.pick]},'#bze2');if(r.ok){BZ.me=r.j;BZ.pick.clear();BZ.shop=null;bzShop();toast(`${r.j.items} limited${r.j.items===1?'':'s'} added to your Limiteds.`,'win');bzDraw()}else wi.disabled=false};
  // youtube, support, requests
  const yt=$('#bzyt');if(yt)yt.onsubmit=async e=>{e.preventDefault();const r=await bzPost('/api/business/youtube',{channel:$('#by-url').value},'#bzye');if(r.ok){BZ.me=r.j;bzDraw()}};
  const yv=$('#bzyv');if(yv)yv.onclick=async()=>{yv.disabled=true;yv.textContent='Checking…';const r=await bzPost('/api/business/youtube/verify',{},'#bzye');if(r.ok){BZ.me=r.j;bzDraw();toast('Channel verified.','win')}else{yv.disabled=false;yv.textContent='Check my channel'}};
  const yr=$('#bzyr');if(yr)yr.onclick=()=>{BZ.me.youtube={};bzDraw()};
  const sp=$('#bzsup');if(sp)sp.onclick=()=>{bzClose();setTimeout(()=>go('support','new:business'),50)};
  const rq=$('#bzrq');if(rq)rq.onsubmit=async e=>{e.preventDefault();const r=await bzPost('/api/business/requests',{title:$('#br-t').value,body:$('#br-b').value},'#bzre');if(r.ok){BZ.me.requests=r.j.requests;bzDraw();toast('Request sent.','win')}};
  $$('[data-vote]',main).forEach(b=>b.onclick=async()=>{const r=await bzPost(`/api/business/requests/${b.dataset.vote}/vote`,{});if(r.ok){BZ.me.requests=r.j.requests;bzDraw()}});
}
async function bzShop(){if(!WAPI.live){BZ.shop={listings:[]};return}const r=await api('/api/business/shop');BZ.shop=r.ok?r.j:{listings:[]};if(BZ.tab==='withdraw')bzDraw()}

/* ---------- the Business role elsewhere on the site ---------- */
const bzRole=b=>b?`<i class="bz-tag" title="TradeBlacket ${b.role}${b.verified?', verified creator':''}">${bzMono(12)}${b.role}${b.verified?' ✓':''}</i>`:'';
{const base=addChat;addChat=function(m){base(m);if(m.me&&WAPI.me&&WAPI.me.business){const l=$('#clist').lastElementChild,n=l&&l.querySelector('.msg-h b');if(n)n.insertAdjacentHTML('afterend',bzRole(WAPI.me.business))}}}
{const base=pfCard;pfCard=function(p,o){return base(p,o).replace('<div class="pf-badges">','<div class="pf-badges">'+bzRole(p.business))}}
{const base=drawWho;drawWho=function(){base();const n=$('#ubtn .nm b');if(n&&WAPI.me&&WAPI.me.business&&!n.querySelector('.bz-tag'))n.insertAdjacentHTML('beforeend',' '+bzRole(WAPI.me.business))}}
// a way in from the main site
{const acc=[...$$('#nav h6')].find(h=>h.textContent==='Account');if(acc)acc.insertAdjacentHTML('beforebegin',`<button class="bz-navbtn" id="bznav" title="TradeBlacket Business">${bzMono(19)}<span>Business</span></button>`);const b=$('#bznav');if(b)b.onclick=()=>bzOpen()}
document.addEventListener('click',e=>{if(e.target.closest('[data-biz]'))bzOpen()});

// tradeblacket.com/business opens straight into the frame
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
