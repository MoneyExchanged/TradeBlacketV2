'use strict';
/* =========================================================
   Account: legal documents, responsible-play limits and screen time.

   Live: acceptance and limits are stored and enforced by the server (server.js, limits.js).
   The page mirrors them so it can explain a refusal before the server has to.
   Preview: the same rules run in the browser.
   ========================================================= */
const LEGAL_V={tos:'2026-10-15',cds:'2026-10-14'};
const UPDATED='October 15, 2026';

/* ---------- the documents ---------- */
// Plain-language drafts. Have them reviewed by a lawyer before relying on them.
const DOCS={
tos:{t:'Terms of Service',s:'The rules for using TradeBlacket.',b:[
['Who we are','TradeBlacket is a fan-run website for players of the Roblox experience Trade Empire. It is run by the team behind Trade Empire. It is not made, endorsed or sponsored by Roblox Corporation. "We" and "us" mean the TradeBlacket team; "you" means anyone who uses the site.'],
['Age','You must be 18 or older to use TradeBlacket. By signing up, and by accepting these terms, you confirm you are. If we learn an account belongs to someone younger, we close it and return what we can to their Trade Empire save.'],
['Your account','You sign in by proving you own a Roblox account through a phrase in its About text. One TradeBlacket account per person and per Roblox account. You are responsible for everything done on your account. Do not share it or let anyone else play on it.'],
['One account per player','Each player may have one TradeBlacket account. To enforce this we keep one-way hashes of the network address, a device id stored in your browser, and your device\'s hardware and browser traits each time you sign in; we never store the address or traits themselves. A new account that signs up from a network, device or hardware another account already uses is banned, and if two accounts are used on one device the newer one is banned. Sign-in attempts are rate limited. A banned account can still sign in and bring its own Rodux and limiteds back to Trade Empire, and nothing else. If you think a ban is a mistake, for example because you share a home network, open a Support ticket.'],
['Refer a friend','You can invite friends with your referral link. When a friend signs up with it and is let into TradeBlacket, you get 450 bonus Rodux. Bonus Rodux can be played on TradeBlacket but cannot be withdrawn to Trade Empire. Nothing is paid for a friend on your network, device or hardware, for an account that is banned, or while either of you is banned. We may change or end the programme, and take back rewards gained by breaking these terms.'],
['Rodux and limiteds have no real-world value','Rodux and Trade Empire limiteds are virtual items inside a game. They are not money, cannot be bought on TradeBlacket, and can never be exchanged for real money, cryptocurrency, Robux or anything of value outside Trade Empire. We never sell Rodux or items and never pay anything out other than Rodux and items back to your Trade Empire save. Buying, selling or trading Rodux, items or accounts for real money or anything outside the game is banned, and accounts involved are closed.'],
['Deposits and withdrawals','Rodux and limiteds move between your Trade Empire save and TradeBlacket only through the Wallet on this site, while you are out of the game. How that works, and what we may and may not do to your save, is set out in the Trade Empire Currency Deduction Service, which forms part of these terms. You can withdraw Rodux up to the amount you have deposited. Bonus Rodux from rewards, codes, levels and rakeback has to be wagered once before it can be withdrawn. Items you hold on TradeBlacket can always be withdrawn to your save unless they are in an open coinflip.'],
['Games and fairness','Each game shows its return to player. Results come from a cryptographic random number generator and do not depend on your history or bet size. Limited Flips are between two players: the site never takes a share and never adds or removes items. A result, once settled, is final unless it came from an error or abuse, in which case we may reverse it.'],
['Playing responsibly','You can set screen-time, deposit, bet and loss limits, take a break or exclude yourself under Responsible play. Stricter limits start straight away; looser ones wait 24 hours. Breaks and exclusions cannot be ended early. Withdrawals always stay open. If playing stops being fun, please take a break and talk to someone you trust.'],
['What is not allowed','Using more than one account, bots, scripts or automation; exploiting bugs instead of reporting them; scamming, begging, harassment or hate in chat; impersonating staff; trying to get around limits, holds or bans; and anything that breaks Roblox\'s Terms of Use or Community Standards.'],
['If something goes wrong','If a bug or outage credits you with Rodux or items you should not have, we may remove them. If one costs you Rodux or items, tell us and we will restore them where our records show the loss. We may suspend or close an account that breaks these terms; when we do, we return whatever we safely can to the linked Trade Empire save, unless it came from abuse.'],
['Disclaimers','TradeBlacket is provided as it is and as available. We do our best to keep it running and correct, but we do not promise it will always be available or free of errors. To the extent the law allows, we are not liable for indirect losses or for the loss of virtual items beyond restoring them as described above.'],
['Changes','We may update these terms. When we do, we change the date at the top and ask you to accept the new version before you play again.'],
['Contact','Questions or problems: reach the team through the Trade Empire community or Roblox group.']]},
license:{t:'License Agreement',s:'What you may do with the site, its software and the items on it.',b:[
['The license we give you','We give you a personal, limited, non-exclusive, non-transferable and revocable license to use TradeBlacket for your own entertainment, under the Terms of Service. Everything not expressly licensed here is kept by us.'],
['Who owns what','The TradeBlacket name, logo, design, code, artwork and text belong to the TradeBlacket team and its licensors. Trade Empire, its items and Rodux belong to the owners of Trade Empire. Roblox and related marks belong to Roblox Corporation.'],
['Virtual items are licensed, not sold','Rodux and Trade Empire limiteds are a license to use virtual items within Trade Empire and TradeBlacket. You do not own them as property, they have no monetary value, and the license ends if your account is closed for breaking the terms.'],
['What you may not do','Copy, resell, rent or sublicense the site or any part of it; reverse engineer, decompile or try to extract its source code or seeds except to verify results as we describe; scrape it or access it by automated means; interfere with its security or other players; or use it for any commercial purpose.'],
['What you post','You keep rights in what you write in chat or your profile. You give us a free, worldwide license to host and show it on TradeBlacket, and to remove it if it breaks the rules.'],
['Ending the license','You can stop using TradeBlacket at any time and withdraw what you hold. We may end this license if you break it or the Terms of Service. The sections on ownership, virtual items and disclaimers continue after it ends.']]},
cds:{t:'Trade Empire Currency Deduction Service',s:'How deposits take Rodux and limiteds from your Trade Empire save, and how withdrawals put them back.',b:[
['What this service is','When you deposit, TradeBlacket deducts Rodux or limiteds from your Trade Empire save and adds the same amount to your TradeBlacket account. When you withdraw, it does the reverse. This document is your permission for those deductions and additions, and it sets out the limits we keep to.'],
['How it reaches your save','The TradeBlacket server reads and writes your Trade Empire save through Roblox Open Cloud, the official Roblox service for experience data. It only touches the save of the Roblox account you signed in with, and only the Rodux balance, the items you choose, and the records needed to keep transfers safe. Nothing else in your save is changed.'],
['Only what you ask for','Each deduction happens because you pressed Deposit for a specific amount or specific items. We never deduct on our own, never take more than you chose, and never change your save for any other reason.'],
['You must be out of the game','Trade Empire keeps your save open while you play, so transfers only run while you are out of the game. If you are in a server, the Wallet tells you to leave first. If you have game mail waiting, such as a market sale, join Trade Empire once to collect it before moving items.'],
['Items that cannot move','Items still in Trade Empire\'s 3-day holding period, items listed on the Trade Empire market, and items in an open trade stay in the game until they are free. An item you withdraw to Trade Empire starts a new holding period there.'],
['Safe transfers','Every transfer is written to your save only if the save has not changed since we read it, and is stamped with a reference so it can never be applied twice. If anything fails part-way, the transfer is finished or undone automatically, and nothing is lost or duplicated. Item supply is fixed: the site never creates or destroys an item.'],
['Withdrawals','You can withdraw Rodux up to what you have deposited and items you hold on TradeBlacket, at any time, including during a break or self-exclusion. Withdrawals are never subject to your limits.'],
['Your limits apply','Daily deposit caps and item deposit caps you set under Responsible play are checked before every deduction.'],
['Records','We keep a record of every transfer: what moved, when, and its reference. You can see recent transfers in your Wallet. Tell us about anything you do not recognise.'],
['Withdrawing permission','You can stop using this service at any time by not depositing. To have your TradeBlacket account closed, withdraw everything first and contact us.']]}
};
const LEG_ORDER=['tos','license','cds'];
const docHtml=k=>{const d=DOCS[k];return`<div class="legal"><p class="note">Last updated ${UPDATED}</p>${d.b.map(([h,p],i)=>`<h4>${i+1}. ${esc(h)}</h4><p>${esc(p)}</p>`).join('')}</div>`};
PAGES.legal=(el,doc)=>{
  const k=DOCS[doc]?doc:'tos';
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Legal</div><h2>${DOCS[k].t}</h2><p>${DOCS[k].s}</p></div></div>
  <div class="legal-wrap"><nav class="legal-nav">${LEG_ORDER.map(x=>`<button data-go="legal" data-p="${x}" class="${x===k?'on':''}">${DOCS[x].t}</button>`).join('')}<button data-go="settings">Responsible play</button></nav><article class="card">${docHtml(k)}</article></div>`;
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-legal]');if(!b)return;e.preventDefault();const k=b.dataset.legal;
  if($('#gate').innerHTML||$('#modal').innerHTML)modal(`<h3>${DOCS[k].t}</h3>${docHtml(k)}`,{cls:'mid'});else go('legal',k)});

/* ---------- acceptance ---------- */
const accepted=k=>WAPI.live&&WAPI.me?!!(WAPI.me.legal&&WAPI.me.legal[k]):(S.legal||{})[k]===LEGAL_V[k];
async function accept(k){
  if(WAPI.live){const r=await api('/api/legal/accept',{doc:k,version:LEGAL_V[k]});if(!r.ok){toast(r.j.error||'Could not save that. Try again.','loss');return false}await syncMe()}
  S.legal={...(S.legal||{}),[k]:LEGAL_V[k]};save();return true;
}
function acceptModal(k,docs,lead,age){
  return new Promise(res=>{
    let done=false;
    const m=modal(`<span class="eyebrow">Please read</span><h3>${docs.map(d=>DOCS[d].t).join(' and ')}</h3><p>${lead}</p>
      <div class="legal-box">${docs.map(d=>`<h5>${DOCS[d].t}</h5>${docHtml(d)}`).join('')}</div>
      ${age?'<label class="check" style="margin:14px 0 0"><input type="checkbox" id="lga"> I am 18 or older.</label>':''}<label class="check" style="margin:14px 0"><input type="checkbox" id="lgk"> I have read and agree to the ${docs.map(d=>DOCS[d].t).join(' and the ')}.</label>
      <div class="err" id="lge"></div><button class="cta" id="lgo" disabled>Agree and continue</button>`,{cls:'mid',onClose:()=>{if(!done)res(false)}});
    const R=m.root,chk=()=>{$('#lgo',R).disabled=!$('#lgk',R).checked||(age&&!$('#lga',R).checked)};$('#lgk',R).onchange=chk;if(age)$('#lga',R).onchange=chk;
    $('#lgo',R).onclick=async()=>{$('#lgo',R).disabled=true;for(const x of k)if(!(await accept(x))){$('#lgo',R).disabled=false;return}done=true;m.close();res(true)};
  });
}
// Called before any deposit. Resolves true once the Deduction Service is accepted.
async function needCds(){
  if(accepted('cds'))return true;
  return acceptModal(['cds'],['cds'],`Deposits take Rodux and items from your ${TE.name} save. Please read how that works before your first deposit.`);
}
let tosAsked=false;
async function needTos(){
  if(!S.user||accepted('tos')||tosAsked)return true;
  tosAsked=true;const ok=await acceptModal(['tos'],['tos','license'],'TradeBlacket is now for players aged 18 and over. Please confirm your age and accept the updated terms to keep playing. If you are under 18 you can still withdraw everything you hold.',true);
  tosAsked=false;return ok;
}

/* ---------- limits ---------- */
const DAYMS=864e5,dayKey=t=>new Date(t).toISOString().slice(0,10),nextMidnight=()=>Date.parse(dayKey(Date.now())+'T00:00:00Z')+DAYMS;
const LIM_KEYS=[['dailyMinutes','Daily screen time','minutes a day','Playing and deposits stop for the rest of the day (UTC) once you reach it.'],
  ['reminderMinutes','Reality check','minutes','A reminder of how long you have been playing, every this many minutes.'],
  ['depositCap','Daily Rodux deposit limit','Rodux a day','The most Rodux you can deposit from Trade Empire each day.'],
  ['itemCap','Daily limited deposit limit','value a day','The most item value you can deposit from Trade Empire each day.'],
  ['maxBet','Largest single bet','Rodux','Any bet above this is refused.'],
  ['lossLimit','Daily loss limit','Rodux a day','Play stops for the day once your net losses reach this.']];
// Local copy of limits.js, for the preview and for instant feedback.
function localLim(){
  S.lim=S.lim||{s:{},pending:{},day:'',seconds:0,net:0,last:0};const L=S.lim,t=Date.now();
  for(const[k,p]of Object.entries(L.pending))if(t>=p.at){L.s[k]=p.value;delete L.pending[k]}
  if(L.day!==dayKey(t)){L.day=dayKey(t);L.seconds=0;L.net=0}
  return L;
}
function localStatus(){
  const L=localLim(),s=L.s,t=Date.now();let lock=null;
  if((s.selfExcludedUntil||0)>t)lock={reason:'selfExclude',until:s.selfExcludedUntil};
  else if((s.coolOffUntil||0)>t)lock={reason:'coolOff',until:s.coolOffUntil};
  else if(s.dailyMinutes&&L.seconds>=s.dailyMinutes*60)lock={reason:'screenTime',until:nextMidnight()};
  else if(s.lossLimit&&-L.net>=s.lossLimit)lock={reason:'lossLimit',until:nextMidnight()};
  const set={};LIM_KEYS.forEach(([k])=>set[k]=s[k]||0);set.coolOffUntil=s.coolOffUntil||0;set.selfExcludedUntil=s.selfExcludedUntil||0;
  return{settings:set,pending:L.pending,usedSeconds:L.seconds,net:L.net,lock,depositedToday:0,itemsToday:0};
}
function localUpdate(p){
  const L=localLim(),s=L.s,t=Date.now();
  for(const[k]of LIM_KEYS){if(!(k in p))continue;const v=p[k]===''||p[k]==null?0:Math.floor(+p[k]);if(!Number.isFinite(v)||v<0)throw new Error('Enter a whole number, or leave it empty for no limit.');
    const cur=s[k]||0,stricter=k==='reminderMinutes'||(v>0&&(cur===0||v<cur));if(stricter||v===cur){s[k]=v;delete L.pending[k]}else L.pending[k]={value:v,at:t+DAYMS}}
  const C={'24h':DAYMS,'72h':3*DAYMS,'7d':7*DAYMS},X={'30d':30*DAYMS,'90d':90*DAYMS,'180d':180*DAYMS};
  if(p.coolOff)s.coolOffUntil=Math.max(s.coolOffUntil||0,t+C[p.coolOff]);
  if(p.selfExclude)s.selfExcludedUntil=Math.max(s.selfExcludedUntil||0,t+X[p.selfExclude]);
  save();return localStatus();
}
let LIM=null;
const limStatus=()=>LIM||(WAPI.live&&WAPI.me&&WAPI.me.limits)||localStatus();
async function drawLimits(){
  if(WAPI.live){if(!S.user)return;const r=await api('/api/limits');if(r.ok)LIM=r.j}else LIM=localStatus();
  drawLockBar();
}
async function saveLimits(patch){
  if(WAPI.live){const r=await api('/api/limits',patch);if(!r.ok)throw new Error(r.j.error||'Could not save.');LIM=r.j}
  else LIM=localUpdate(patch);
  drawLockBar();return LIM;
}
const LOCKTXT={selfExclude:'You excluded yourself',coolOff:'You are on a break',screenTime:'Daily screen time reached',lossLimit:'Daily loss limit reached'};
const until=t=>{const d=new Date(t);return d.toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})};
function drawLockBar(){
  let bar=$('#lockbar');const st=limStatus(),lk=S.user&&st&&st.lock;
  if(!lk){if(bar)bar.remove();document.body.classList.remove('locked');return}
  if(!bar){bar=document.createElement('div');bar.id='lockbar';bar.className='lockbar';bar.setAttribute('role','status');document.body.appendChild(bar)}
  document.body.classList.add('locked');
  bar.innerHTML=`${ic('shield',16,2)}<b>${LOCKTXT[lk.reason]}</b><span>Playing and deposits are paused until ${until(lk.until)}. Withdrawals stay open.</span><button data-go="settings">Details</button>`;
}
function lockReason(){const st=limStatus();return S.user&&st&&st.lock?`${LOCKTXT[st.lock.reason]}. Playing is paused until ${until(st.lock.until)}.`:null}

/* ---------- hooks into play ---------- */
// Every bet goes through take(). Refuse it while paused, above the bet limit, or before the terms are accepted.
{const base=take;take=function(a){
  if(!S.user)return base(a);
  const why=lockReason();if(why){toast(why,'loss');drawLockBar();return false}
  const mb=limStatus().settings.maxBet;if(mb&&a>mb){toast(`That's above your largest-bet limit of ${fmt0(mb)} Rodux. You can change it under Responsible play.`,'loss');return false}
  if(!accepted('tos')){needTos();return false}
  return base(a);
}}
// Track the day's net result for the loss limit.
{const base=settle;settle=function(game,bet,mult,payout,o){
  const L=localLim();L.net=Math.round(L.net+(payout-bet));save();
  const r=base(game,bet,mult,payout,o);
  if(!WAPI.live){LIM=localStatus();if(LIM.lock)drawLockBar()}
  return r;
}}
// Screen time: count a minute for every minute the tab is open and visible while signed in.
let remindAt=0;
setInterval(async()=>{
  if(!S.user||document.hidden)return;
  const L=localLim();L.seconds+=60;L.last=Date.now();save();
  if(WAPI.live){const r=await api('/api/limits/heartbeat',{seconds:60,net:L.net});if(r.ok)LIM=r.j}else LIM=localStatus();
  const st=limStatus(),rm=st.settings.reminderMinutes,used=Math.floor(st.usedSeconds/60);
  if(rm&&used>=remindAt+rm&&used>0){remindAt=used-(used%rm);toast(`Reality check: you've played for ${used} minute${used===1?'':'s'} today.`,'gold')}
  drawLockBar();
},60000);
addEventListener('load',()=>setTimeout(()=>{drawLimits();if(WAPI.live&&WAPI.me)needTos()},1500));

/* ---------- Responsible play page ---------- */
PAGES.settings=el=>{
  if(!S.user){el.innerHTML=`<div class="empty"><h3>Responsible play</h3><p>Sign in to set limits on your time, deposits and bets.</p><button class="cta inline" data-open="login">Sign in</button></div>`;return}
  const draw=()=>{
    const st=limStatus(),s=st.settings,P=st.pending||{},used=Math.floor(st.usedSeconds/60),lk=st.lock;
    el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Account</div><h2>Responsible play</h2><p>Set limits that keep TradeBlacket fun. Stricter limits start now. Raising or removing a limit waits 24 hours, so a decision made with a clear head sticks. Withdrawals are never limited.</p></div></div>
    ${lk?`<div class="card lockcard">${ic('shield',20,2)}<div><b>${LOCKTXT[lk.reason]}</b><span>Playing and deposits are paused until ${until(lk.until)}. You can still withdraw Rodux and items.</span></div></div>`:''}
    <div class="fl-stats"><div class="stat"><span>Played today</span><b>${used} min${s.dailyMinutes?` <small>of ${s.dailyMinutes}</small>`:''}</b></div><div class="stat"><span>Net today</span><b class="${st.net>=0?'w':'l'}">${st.net>=0?'+':'−'}${fmt0(Math.abs(st.net))}</b></div>${WAPI.live?`<div class="stat"><span>Deposited today</span><b>${chip(13)}${fmt0(st.depositedToday)}</b></div>`:''}</div>
    <div class="set-grid">
      <form class="card set-card" id="limf"><h3>Limits</h3><p class="note">Leave a box empty for no limit.</p>
        ${LIM_KEYS.map(([k,l,u,d])=>`<label class="fld set-row"><span>${l}</span><div class="set-in"><input class="txt" name="${k}" type="number" min="0" step="1" inputmode="numeric" placeholder="No limit" value="${s[k]||''}"><em>${u}</em></div><small>${d}${P[k]?` <b class="pend">Changes to ${P[k].value||'no limit'} on ${until(P[k].at)}</b>`:''}</small></label>`).join('')}
        <div class="err" id="lime"></div><button class="cta">Save limits</button></form>
      <div class="mstack">
        <div class="card set-card"><h3>Take a break</h3><p class="note">Stops playing and deposits for the time you choose. It cannot be ended early.</p>
          <div class="brk">${[['24h','24 hours'],['72h','3 days'],['7d','7 days']].map(([v,l])=>`<button class="cta ghost sm" data-cool="${v}">${l}</button>`).join('')}</div>
          ${s.coolOffUntil>Date.now()?`<p class="note">On a break until ${until(s.coolOffUntil)}.</p>`:''}</div>
        <div class="card set-card"><h3>Self-exclusion</h3><p class="note">A longer break for when you need real distance. You can still sign in to withdraw. It cannot be ended early.</p>
          <div class="brk">${[['30d','30 days'],['90d','90 days'],['180d','180 days']].map(([v,l])=>`<button class="cta ghost sm" data-excl="${v}">${l}</button>`).join('')}</div>
          ${s.selfExcludedUntil>Date.now()?`<p class="note">Excluded until ${until(s.selfExcludedUntil)}.</p>`:''}</div>
        <div class="card set-card"><h3>Need to talk?</h3><p class="note">If playing stops feeling like a game, take a break and talk to someone you trust. Rodux and items have no real-world value, and nothing on TradeBlacket is worth stress.</p></div>
      </div>
    </div>`;
    $('#limf').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),p={};LIM_KEYS.forEach(([k])=>p[k]=f.get(k));
      try{await saveLimits(p);toast('Limits saved.','win');draw()}catch(er){$('#lime').textContent=er.message}};
    $$('[data-cool],[data-excl]',el).forEach(b=>b.onclick=()=>{
      const cool=b.dataset.cool,label=b.textContent;
      const m=modal(`<h3>${cool?'Take a break':'Exclude yourself'} for ${label}?</h3><p>Playing and deposits stop until ${until(Date.now()+({'24h':1,'72h':3,'7d':7,'30d':30,'90d':90,'180d':180})[cool||b.dataset.excl]*DAYMS)}. This cannot be undone early. Withdrawals stay open.</p><div class="mstack"><button class="cta red" id="bk1">Start ${label} ${cool?'break':'exclusion'}</button><button class="cta ghost" id="bk0">Cancel</button></div>`);
      $('#bk0',m.root).onclick=m.close;
      $('#bk1',m.root).onclick=async()=>{try{await saveLimits(cool?{coolOff:cool}:{selfExclude:b.dataset.excl});m.close();toast('Done. Take care of yourself.');draw()}catch(er){toast(er.message,'loss')}};
    });
  };
  draw();drawLimits().then(()=>{if(el.isConnected&&cur==='settings')draw()});
};
