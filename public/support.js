'use strict';
/* =========================================================
   Support (tradeblacket.com/support) and the Trade Empire account page (tradeblacket.com/tradeempire).

   Support is a help desk: tickets on the left, the conversation on the right. A new ticket carries
   the player's whole account (Roblox profile, Trade Empire save and standing, TradeBlacket record)
   so staff never have to ask for it, and players can attach screenshots (pick, paste or drop).
   Staff get the account beside the conversation and act on it from there: warn, suspend, kick,
   ban, terminate, unban, let in, remove access, internal notes.
   ========================================================= */
const SUP_CATS2=[['deposit','Deposit','Rodux or limiteds that did not arrive'],['withdraw','Withdrawal','Something did not come back to the game'],['limiteds','Limiteds','Items, the marketplace or Limited Flip'],['game','A game','Cases, battles or a casino game'],['account','My account','Sign-in, profile or settings'],['appeal','Appeal','A ban, suspension or warning'],['report','Report a player','Scams, cheating or abuse'],['bug','Bug','Something on the site is broken'],['other','Something else','Anything not listed']];
const SUP_CAT=Object.fromEntries(SUP_CATS2.map(([k,l])=>[k,l]));
const STAND_SEG=['Excellent','Good','Warning','Restricted','Suspended'];
const SUP={tab:'open',sel:null,data:null,files:[],q:'',newCat:null};
const dt=t=>t?new Date(t).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'';
const dtt=t=>t?new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
const ageOf=t=>{if(!t)return'';const d=Math.floor((Date.now()-t)/864e5);return d>=365?`${Math.floor(d/365)} yr${d>=730?'s':''}`:d>=30?`${Math.floor(d/30)} mo`:`${d} day${d===1?'':'s'}`};
const hrs=s=>{const h=Math.floor((s||0)/3600);return h>=1?`${fmt0(h)} h`:`${Math.floor((s||0)/60)} min`};

/* ---------- preview data (no server) ---------- */
function demoAccount(){
  const n=(S.user&&S.user.name)||'Player',t=Date.now();
  return{robloxId:1,at:t,preview:true,
    roblox:{id:1,exists:true,name:n,displayName:n,created:t-3.2*365*864e5,isBanned:false,verified:false},
    tradeEmpire:{available:true,hasSave:true,inGame:false,rodux:1840,totalValue:126400,totalRAP:118250,items:37,uniqueItems:29,playSeconds:412000,trades:58,activeTrades:2,previousNames:[],tradePlus:{tier:'Silver',expires:t+12*864e5},earned:52000,purchases:14,soldLimiteds:9,dailyStreak:41,giftCredit:0,siteWallet:{deposited:2500,withdrawn:800},
      valueHistory:Array.from({length:30},(_,i)=>({t:t-(29-i)*864e5,v:Math.round(98000+i*900+Math.sin(i/3)*4000)})),
      standing:{level:'warning',label:'Warning',step:3,steps:5,message:'Has an active violation. Further violations will restrict it.',activeCount:1,terminated:false,suspendedUntil:0,spotless:false,totals:{all:2,warnings:2,suspensions:0,terminations:0,overturned:0},
        violations:[{id:'v2',action:'Warning',reason:'Spamming trade ads',note:'Sent the same ad 40 times in a minute.',issuedAt:t-6*864e5,expiresAt:0,appeal:'none',counts:true},{id:'v1',action:'Warning',reason:'Inappropriate language',note:'',issuedAt:t-140*864e5,expiresAt:0,appeal:'none',counts:false}]}},
    tradeBlacket:{username:n,walletId:walletId()||'TBW-DEMO-0000',joined:(S.stats&&S.stats.joined)||t-20*864e5,balance:S.bal,bonusLock:S.lock||0,deposited:0,withdrawn:0,withdrawable:0,itemValue:0,access:true,admin:false,banned:null,
      standing:{level:'excellent',label:'Excellent',step:1,steps:5,message:'In excellent standing. No violations, ever.',activeCount:0,totals:{all:0,warnings:0,suspensions:0,terminations:0},violations:[]},actions:[],referrals:{invited:0,paid:0},tickets:(S.tickets||[]).length}};
}

/* ---------- account pieces ---------- */
function standBar(st,{big=false}={}){
  if(!st)return'';
  const lit=i=>i<st.step,grey=st.step===5,green=st.spotless;
  return`<div class="sb${big?' big':''} l-${esc(st.level)}"><div class="sb-bar">${STAND_SEG.map((l,i)=>`<i class="${lit(i)?'on':''}${grey?' grey':''}${green?' green':''}" title="${l}"></i>`).join('')}</div>
    <div class="sb-l">${STAND_SEG.map((l,i)=>`<span class="${i===st.step-1?'cur':''}">${l}</span>`).join('')}</div></div>`;
}
function standCounts(st){
  const T=st.totals||{};
  return`<dl class="sc"><div><dt>Warnings</dt><dd>${fmt0(T.warnings||0)}</dd></div><div><dt>Suspensions</dt><dd>${fmt0(T.suspensions||0)}</dd></div><div><dt>Terminations</dt><dd>${fmt0(T.terminations||0)}</dd></div><div><dt>Counting now</dt><dd>${fmt0(st.activeCount||0)}</dd></div></dl>`;
}
function violList(v,{empty='Nothing on record.'}={}){
  if(!v||!v.length)return`<p class="note">${empty}</p>`;
  return`<ul class="vl">${v.map(x=>`<li class="${x.counts?'live':'old'}${x.appeal==='accepted'?' over':''}"><span class="vk ${esc(x.action.toLowerCase())}">${esc(x.action)}</span><div><b>${esc(x.reason)}</b>${x.note?`<p>${esc(x.note)}</p>`:''}<small>${dt(x.issuedAt)}${x.action==='Suspension'&&x.expiresAt?`, until ${dt(x.expiresAt)}`:''}${x.appeal==='accepted'?', overturned':x.appeal==='pending'?', appeal pending':x.appeal==='rejected'?', appeal rejected':''}${x.counts?'':x.appeal==='accepted'?'':', no longer counts'}</small></div></li>`).join('')}</ul>`;
}
function acctCard(a,{staff=false,compact=false}={}){
  if(!a)return`<div class="ac empty"><p class="note">No account details on this ticket.</p></div>`;
  const R=a.roblox||{},T=a.tradeEmpire||{},B=a.tradeBlacket||{},ts=T.standing,bs=B.standing;
  const rbx=R.error?`<p class="note">${esc(R.error)}</p>`:R.exists===false?`<p class="note">This Roblox account no longer exists.</p>`:
    `<div class="ac-id"><img src="/img/avatar/${a.robloxId}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ac-ph',textContent:'${esc((R.name||'?')[0])}'}))"><div><b>${esc(R.displayName||R.name||'')}</b><span>@${esc(R.name||'')}${R.verified?' <i class="ac-ver" title="Verified">✓</i>':''}</span></div>
      <span class="ac-pill ${R.isBanned?'bad':'ok'}">${R.isBanned?'Banned on Roblox':'Roblox account active'}</span></div>
     <dl class="ac-kv"><div><dt>Roblox id</dt><dd>${a.robloxId}</dd></div><div><dt>Account age</dt><dd>${ageOf(R.created)}</dd></div><div><dt>Created</dt><dd>${dt(R.created)}</dd></div></dl>`;
  const te=!T.available?`<p class="note">${esc(T.error||'Trade Empire saves cannot be read right now.')}</p>`:!T.hasSave?`<p class="note">No Trade Empire save. This player has not played yet.</p>`:
    `${standBar(ts)}<p class="ac-msg">${esc(ts.message)}</p>${standCounts(ts)}
     <dl class="ac-kv"><div><dt>Rodux</dt><dd>${fmt0(T.rodux)}</dd></div><div><dt>Value</dt><dd>${fmt0(T.totalValue)}</dd></div><div><dt>RAP</dt><dd>${fmt0(T.totalRAP)}</dd></div><div><dt>Items</dt><dd>${fmt0(T.items)}</dd></div><div><dt>Trades</dt><dd>${fmt0(T.trades)}</dd></div><div><dt>Played</dt><dd>${hrs(T.playSeconds)}</dd></div><div><dt>TradePlus</dt><dd>${T.tradePlus?esc(T.tradePlus.tier):'None'}</dd></div><div><dt>In game</dt><dd>${T.inGame?'Yes':'No'}</dd></div></dl>
     ${compact?'':`<details class="ac-more"${ts.violations.length&&staff?' open':''}><summary>Violation history (${ts.violations.length})</summary>${violList(ts.violations,{empty:'No violations in Trade Empire.'})}</details>`}`;
  const ban=B.banned?`<span class="ac-pill bad">${B.banned.kind==='suspend'?`Suspended until ${dtt(B.banned.until)}`:B.banned.kind==='terminate'?'Terminated':'Banned'}</span>`:B.access?'<span class="ac-pill ok">Has access</span>':'<span class="ac-pill">On the waitlist</span>';
  const tb=!B.walletId?'<p class="note">No TradeBlacket account.</p>':
    `<div class="ac-row">${ban}${B.admin?'<span class="ac-pill gold">Admin</span>':''}</div>
     ${B.banned?`<p class="ac-msg">${esc(B.banned.reason)}${B.banned.automatic?' (automatic)':''}</p>`:''}
     ${standBar(bs)}${standCounts(bs)}
     <dl class="ac-kv"><div><dt>Wallet ID</dt><dd><code>${esc(B.walletId)}</code></dd></div><div><dt>Joined</dt><dd>${dt(B.joined)}</dd></div><div><dt>Balance</dt><dd>${fmt0(B.balance)}</dd></div><div><dt>Bonus</dt><dd>${fmt0(B.bonusLock)}</dd></div><div><dt>Deposited</dt><dd>${fmt0(B.deposited)}</dd></div><div><dt>Withdrawn</dt><dd>${fmt0(B.withdrawn)}</dd></div><div><dt>Site items</dt><dd>${fmt0(B.itemValue)}</dd></div><div><dt>Referrals</dt><dd>${fmt0(B.referrals?B.referrals.paid:0)} of ${fmt0(B.referrals?B.referrals.invited:0)}</dd></div></dl>
     ${compact?'':`<details class="ac-more"><summary>Staff actions (${(B.actions||[]).length})</summary>${(B.actions||[]).length?`<ul class="al">${B.actions.map(x=>`<li><span class="vk ${esc(x.action)}">${esc(x.action)}</span><div><b>${esc(x.reason||x.note||'')}</b>${staff&&x.note&&x.reason?`<p>${esc(x.note)}</p>`:''}<small>${dtt(x.at)}${staff?`, by ${esc(x.by)}`:''}${x.until?`, until ${dtt(x.until)}`:''}</small></div></li>`).join('')}</ul>`:'<p class="note">None.</p>'}</details>`}`;
  const st=staff&&B.walletId?`<section class="ac-s staff"><h4>Staff only</h4>
     <dl class="ac-kv"><div><dt>Signed in on</dt><dd>${fmt0(B.sessions||0)} device${B.sessions===1?'':'s'}</dd></div><div><dt>Networks</dt><dd>${fmt0((B.seen||{}).ip||0)}</dd></div><div><dt>Devices</dt><dd>${fmt0((B.seen||{}).dev||0)}</dd></div><div><dt>Tickets</dt><dd>${fmt0(B.tickets||0)}</dd></div></dl>
     <h5>Linked accounts</h5>${(B.linked||[]).length?`<ul class="lk">${B.linked.map(l=>`<li><button class="lk-n" data-staffacct="${l.robloxId}">${esc(l.username||String(l.robloxId))}</button><span>${l.via.map(v=>({ip:'same network',dev:'same device',hw:'same hardware'}[v]||v)).join(', ')}</span>${l.banned?'<span class="ac-pill bad">Banned</span>':''}</li>`).join('')}</ul>`:'<p class="note">No other accounts share a network, device or hardware.</p>'}
     ${B.referrals&&B.referrals.referredBy?`<p class="note">Referred by ${esc(B.referrals.referredBy)}</p>`:''}</section>`:'';
  return`<div class="ac${compact?' compact':''}">
    <section class="ac-s"><h4>Roblox</h4>${rbx}</section>
    <section class="ac-s"><h4>Trade Empire</h4>${te}</section>
    <section class="ac-s"><h4>TradeBlacket</h4>${tb}</section>${st}
    <p class="ac-at">Account as of ${dtt(a.at)}${a.preview?' (preview data)':''}</p></div>`;
}

/* ---------- staff actions ---------- */
const MOD_UI=[['warn','Warn','Adds a warning to their TradeBlacket record. They see it.',1],['suspend','Suspend','Locks the account for a number of days and signs them out.',1],['kick','Kick','Signs them out on every device. Nothing else changes.',0],['ban','Ban','Locks the account until it is unbanned. They can still withdraw.',1],['terminate','Terminate','Closes the account for good. They can still withdraw.',1],['unban','Unban','Lifts a ban or suspension.',0],['grant','Let in','Gives access to TradeBlacket now.',0],['revoke','Remove access','Puts them back behind the waitlist.',0],['note','Note','A note only staff can read.',0]];
function modDialog(robloxId,name,action,ticketId,done){
  const [k,l,desc,needReason]=MOD_UI.find(m=>m[0]===action);
  const danger=['ban','terminate','suspend'].includes(k);
  const m=modal(`<div class="mod-d"><h3>${esc(l)} ${esc(name)}</h3><p class="note">${esc(desc)}</p>
    ${k==='suspend'?`<label class="fld"><span>How long</span><select class="txt" id="mdd"><option value="1">1 day</option><option value="3">3 days</option><option value="7" selected>7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label>`:''}
    ${k==='note'?'':`<label class="fld"><span>Reason${needReason?'':' (optional)'}${needReason?', shown to the player':''}</span><input class="txt" id="mdr" maxlength="160" placeholder="${k==='warn'?'e.g. Spamming chat':k==='unban'?'e.g. Appeal accepted':'e.g. Scamming in Limited Flip'}"></label>`}
    <label class="fld"><span>${k==='note'?'Note':'Staff note (optional, staff only)'}</span><textarea class="txt" id="mdn" rows="3" maxlength="1000"></textarea></label>
    <div class="err" id="mde"></div>
    <div class="mstack"><button class="cta${danger?' danger':''}" id="mdgo">${esc(l)}</button></div></div>`,{cls:'mod-modal'});
  $('#mdgo',m.root).onclick=async()=>{
    const body={robloxId,action:k,reason:($('#mdr',m.root)||{}).value||'',note:$('#mdn',m.root).value,days:($('#mdd',m.root)||{}).value,ticketId};
    if(!WAPI.live){m.close();toast('Preview: staff actions run on the live site.');return}
    const r=await api('/api/admin/mod',body);if(!r.ok){$('#mde',m.root).textContent=r.j.error;return}
    m.close();toast(k==='note'?'Note saved.':`${l}: done.`,'win');done&&done();
  };
}
function staffBar(a,ticketId,done){
  const B=(a&&a.tradeBlacket)||{},name=B.username||(a&&a.roblox&&a.roblox.name)||'player';
  if(B.admin)return`<p class="note">This is an admin account.</p>`;
  return`<div class="mod-bar">${MOD_UI.filter(([k])=>!(k==='unban'&&!B.banned)&&!(k==='grant'&&(B.access||B.banned))&&!(k==='revoke'&&!B.access)).map(([k,l])=>`<button class="mod-b ${k}" data-mod="${k}" data-rid="${a.robloxId}" data-nm="${esc(name)}">${esc(l)}</button>`).join('')}</div>`;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-mod]');if(b){modDialog(Number(b.dataset.rid),b.dataset.nm,b.dataset.mod,b.dataset.tk||SUP.sel,()=>{if(cur==='support')supDraw();else if(cur==='admin')admPlayer(String(b.dataset.rid))});return}
  const s=e.target.closest('[data-staffacct]');if(s){if(cur==='admin')admPlayer(s.dataset.staffacct);else go('admin','players:'+s.dataset.staffacct)}
});

/* ---------- screenshots ---------- */
async function supUpload(file){
  if(!/^image\/(png|jpeg|gif|webp)$/.test(file.type))return toast('Attach PNG, JPEG, GIF or WebP images.','loss');
  if(file.size>5*1024*1024)return toast('Screenshots can be up to 5 MB.','loss');
  if(SUP.files.length>=4)return toast('Up to 4 screenshots per message.','loss');
  const local=URL.createObjectURL(file),f={id:null,url:local,busy:true};SUP.files.push(f);drawFiles();
  if(WAPI.live){
    try{const r=await fetch('/api/support/upload',{method:'POST',headers:{'Content-Type':file.type},body:file,credentials:'same-origin'});const j=await r.json();if(!r.ok)throw new Error(j.error);f.id=j.id}
    catch(e){SUP.files=SUP.files.filter(x=>x!==f);toast(e.message||'Upload failed. Try again.','loss')}
  }else f.id='preview'+uid().slice(0,8);
  f.busy=false;drawFiles();
}
function drawFiles(){const box=$('#supfiles');if(!box)return;box.innerHTML=SUP.files.map((f,i)=>`<span class="sf${f.busy?' busy':''}"><img src="${f.url}" alt="Screenshot ${i+1}"><button type="button" data-rmf="${i}" aria-label="Remove screenshot">${ic('x',12,2.4)}</button></span>`).join('');$$('[data-rmf]',box).forEach(b=>b.onclick=()=>{SUP.files.splice(Number(b.dataset.rmf),1);drawFiles()})}
function wireDrop(el){
  const inp=$('#supfi',el);if(inp)inp.onchange=()=>{[...inp.files].forEach(supUpload);inp.value=''};
  const zone=$('.sup-compose',el)||el;
  zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('drag')});zone.addEventListener('dragleave',()=>zone.classList.remove('drag'));
  zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('drag');[...(e.dataTransfer.files||[])].forEach(supUpload)});
  zone.addEventListener('paste',e=>{const fs=[...(e.clipboardData&&e.clipboardData.files||[])];if(fs.length){e.preventDefault();fs.forEach(supUpload)}});
}
const fileThumbs=files=>files&&files.length?`<div class="sm-files">${files.map(f=>`<button class="sm-f" data-img="${esc(f.url)}"><img src="${esc(f.url)}" alt="Screenshot" loading="lazy"></button>`).join('')}</div>`:'';
document.addEventListener('click',e=>{const b=e.target.closest('[data-img]');if(!b)return;modal(`<img class="lightbox" src="${esc(b.dataset.img)}" alt="Screenshot">`,{cls:'lb-modal'})});

/* ---------- loading ---------- */
async function supFetch(){
  if(WAPI.live){const r=await api('/api/support');SUP.data=r.ok?r.j:{tickets:[],error:r.j.error};return SUP.data}
  const acc=demoAccount();
  SUP.data={admin:false,tickets:(S.tickets||[]).map(t=>({...t,account:acc,created:t.created||t.messages[0].at,updated:t.messages.at(-1).at,messages:[{kind:'account',account:acc,at:t.messages[0].at,files:[]},...t.messages.map(m=>({kind:m.kind||'msg',staff:!!m.staff,author:m.staff?'TradeBlacket Support':'You',body:m.body,at:m.at,files:m.files||[]}))]}))};
  return SUP.data;
}
let MYACC=null;
async function myAccount(force){
  if(MYACC&&!force&&Date.now()-MYACC.at<60e3)return MYACC;
  if(!WAPI.live){MYACC=demoAccount();return MYACC}
  const r=await api('/api/account');MYACC=r.ok?r.j:null;return MYACC;
}

/* ---------- the Support page ---------- */
PAGES.support=(el,p)=>{
  if(p==='new'||(typeof p==='string'&&p.startsWith('new:'))){SUP.sel='new';SUP.newCat=p.split(':')[1]||null}
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Support</div><h2>Support</h2><p>Ask about a transfer, an item or your account, appeal a decision or report a player. Replies arrive in your ticket.</p></div>${S.user?`<button class="cta inline" id="supnew">${ic('plus',16,2.4)}New ticket</button>`:''}</div><div id="supb"><div class="spin"></div></div>`;
  const nb=$('#supnew',el);if(nb)nb.onclick=()=>{SUP.sel='new';SUP.newCat=null;supDraw()};
  if(!S.user){$('#supb',el).innerHTML=`<div class="sup-out"><div class="empty"><h3>Sign in to contact support</h3><p>Tickets are tied to your Roblox account, so we can see your transfers and items.</p><button class="cta inline" data-open="login">Sign in</button></div>${quickAnswers()}</div>`;return}
  supDraw(true);
  const t=setInterval(()=>{if(cur!=='support'||document.hidden||SUP.sel==='new'||$('#modal').innerHTML)return;const box=$('.sup-compose textarea');if(box&&box.value)return;supDraw(true,true)},20000);
  cleanup=()=>clearInterval(t);
};
function quickAnswers(){return`<section class="card glass sup-qa"><h3>Quick answers</h3>
  <details><summary>My deposit says I'm in the game</summary><p>Leave Trade Empire completely, wait a few seconds, then try again. The game keeps your save open while you play.</p></details>
  <details><summary>An item won't deposit</summary><p>Items in their 3-day holding period, listed on the in-game market, or waiting in game mail have to stay in the game until they're free.</p></details>
  <details><summary>How much can I withdraw?</summary><p>Up to the Rodux you deposited, plus Rodux you were paid for items. Bonus Rodux can't be withdrawn.</p></details>
  <details><summary>I was banned for sharing a network</summary><p>One account per player is a rule. If you share a home network with another player, open an Appeal and tell us who it is.</p></details>
  <details><summary>Where do bought items go?</summary><p>To your Limiteds on TradeBlacket. Open Wallet, pick Limiteds, and withdraw them to your save.</p></details>
  <button class="cta ghost inline" data-go="docs">Read the docs</button></section>`}
async function supDraw(fetchData=true,quiet=false){
  const box=$('#supb');if(!box)return;
  if(fetchData){await supFetch();if(!$('#supb'))return;
    const sig=JSON.stringify(SUP.data.tickets.map(t=>[t.id,t.status,t.updated,t.messages.length]));
    if(quiet&&fetchData===true&&SUP.sig===sig&&$('.sup2'))return;SUP.sig=sig}
  const D=SUP.data,admin=!!D.admin;
  const list=D.tickets.filter(t=>SUP.tab==='all'||(SUP.tab==='open'?t.status!=='closed'&&t.status!=='answered':t.status===SUP.tab))
    .filter(t=>!SUP.q||[t.id,t.subject,t.player||'',t.walletId||'',t.reported||''].join(' ').toLowerCase().includes(SUP.q.toLowerCase()));
  if(!SUP.sel&&!quiet)SUP.sel=list[0]?list[0].id:(D.tickets.length?null:'new');
  const cnt=k=>D.tickets.filter(t=>k==='all'||(k==='open'?t.status!=='closed'&&t.status!=='answered':t.status===k)).length;
  const keep=$('#supc textarea')?.value||'';
  box.innerHTML=`<div class="sup2${admin?' admin':''}">
    <aside class="sup-side">
      <div class="sup-me" id="supme"></div>
      <div class="sup-tabs">${[['open',admin?'Needs reply':'Open'],['answered','Answered'],['closed','Closed'],['all','All']].map(([k,l])=>`<button data-st="${k}" class="${SUP.tab===k?'on':''}">${l}<i>${cnt(k)}</i></button>`).join('')}</div>
      ${admin?`<input class="txt sup-q" id="supq" placeholder="Search player, ticket or wallet ID" value="${esc(SUP.q)}">`:''}
      <div class="sup-tl">${list.length?list.map(t=>`<button class="sup-ti${SUP.sel===t.id?' on':''}" data-tk="${esc(t.id)}"><span class="dot ${t.status}"></span><span class="sup-tt"><b>${esc(t.subject)}</b><small>${admin?`${esc(t.player||'')} · `:''}${esc(SUP_CAT[t.category]||t.category)} · ${esc(t.id)}</small></span><time>${ago(t.updated)}</time></button>`).join(''):`<p class="note sup-none">${D.tickets.length?'No tickets here.':'You have no tickets yet.'}</p>`}</div>
      ${admin?'':quickAnswers()}
    </aside>
    <section class="sup-main" id="supmain"></section>
    ${admin?'<aside class="sup-acct" id="supacct"></aside>':''}
  </div>`;
  $$('[data-st]',box).forEach(b=>b.onclick=()=>{SUP.tab=b.dataset.st;SUP.sel=null;supDraw(false)});
  $$('[data-tk]',box).forEach(b=>b.onclick=()=>{SUP.sel=b.dataset.tk;SUP.files=[];supDraw(false,true)});
  const sq=$('#supq',box);if(sq)sq.oninput=()=>{SUP.q=sq.value;clearTimeout(sq._t);sq._t=setTimeout(()=>{supDraw(false,true);const n=$('#supq');if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},250)};
  drawMine();
  const t=D.tickets.find(x=>x.id===SUP.sel);
  if(SUP.sel==='new'||!t)drawNew();else drawTicket(t,admin,keep);
}
async function drawMine(){
  const el=$('#supme');if(!el)return;
  const a=await myAccount();if(!$('#supme'))return;
  if(!a){el.innerHTML='';return}
  const T=a.tradeEmpire||{},B=a.tradeBlacket||{};
  const pill=(st,l)=>st?`<span class="sp l-${esc(st.level)}"><small>${l}</small>${esc(st.label)}</span>`:'';
  el.innerHTML=`<div class="sup-mehead">${avatar(me(),36)}<div><b>${esc(S.user.name)}</b><small>${esc(B.walletId||'')}</small></div></div>
    <div class="sup-pills">${pill(T.standing,'Trade Empire')}${pill(B.standing,'TradeBlacket')}</div>
    <button class="sup-mel" data-go="tradeempire">View your Trade Empire account</button>`;
}
function drawNew(){
  const el=$('#supmain');if(!el)return;$('#supacct')&&($('#supacct').innerHTML='');
  const cat=SUP.newCat;
  el.innerHTML=`<form class="sup-new2" id="snew2">
    <h3>New ticket</h3>
    <fieldset class="sup-cats"><legend>What is it about?</legend>${SUP_CATS2.map(([k,l,d])=>`<label class="${cat===k?'on':''}"><input type="radio" name="scat" value="${k}" ${cat===k?'checked':''}><b>${esc(l)}</b><small>${esc(d)}</small></label>`).join('')}</fieldset>
    <div class="sup-rep" ${cat==='report'?'':'hidden'}><label class="fld"><span>Roblox username of the player</span><input class="txt" id="srep" maxlength="20" placeholder="e.g. Builderman"></label></div>
    <label class="fld"><span>Subject</span><input class="txt" id="ssub2" maxlength="90" placeholder="${cat==='appeal'?'e.g. Appeal for my suspension':'e.g. Withdrawal didn\'t arrive'}"></label>
    <div class="sup-compose new"><label class="fld"><span>What happened?</span><textarea class="txt" id="sbody2" rows="6" maxlength="4000" placeholder="Include times, amounts and item names if a transfer is involved. You can paste screenshots straight in."></textarea></label>
      <div class="sup-files" id="supfiles"></div>
      <div class="sup-cbar"><label class="cta ghost inline sup-att">${ic('plus',15,2.4)}Add screenshots<input type="file" id="supfi" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden></label><span class="note">Or paste or drop images here. Up to 4, 5 MB each.</span></div></div>
    <div class="sup-share"><b>Your account is attached</b><span>Support sees your Roblox profile, your Trade Empire account and standing, and your TradeBlacket balance and history, so you don't have to explain them.</span></div>
    <div class="err" id="serr2"></div>
    <div class="sup-send"><button class="cta inline" id="ssend">Send ticket</button></div>
  </form>`;
  drawFiles();wireDrop(el);
  $$('[name="scat"]',el).forEach(r=>r.onchange=()=>{SUP.newCat=r.value;$$('.sup-cats label',el).forEach(l=>l.classList.toggle('on',l.contains(r)));$('.sup-rep',el).hidden=r.value!=='report'});
  $('#snew2',el).onsubmit=async e=>{e.preventDefault();
    const b={category:SUP.newCat,subject:$('#ssub2',el).value,body:$('#sbody2',el).value,reported:$('#srep',el).value,files:SUP.files.filter(f=>f.id).map(f=>f.id)};
    if(!b.category)return $('#serr2',el).textContent='Pick what the ticket is about.';
    if(SUP.files.some(f=>f.busy))return $('#serr2',el).textContent='Wait for the screenshots to finish uploading.';
    $('#ssend',el).disabled=true;
    if(WAPI.live){const r=await api('/api/support',b);if(!r.ok){$('#ssend',el).disabled=false;return $('#serr2',el).textContent=r.j.error}SUP.sel=r.j.id}
    else{if(b.subject.trim().length<4||b.body.trim().length<10){$('#ssend',el).disabled=false;return $('#serr2',el).textContent='Add a subject and a little more detail.'}
      const id='TKT-'+uid().slice(0,8).toUpperCase();S.tickets=[{id,subject:b.subject,category:b.category,status:'open',reported:b.reported||null,messages:[{staff:0,body:b.body,at:Date.now(),files:SUP.files.map(f=>({id:f.id,url:f.url}))}]},...(S.tickets||[])];save();SUP.sel=id}
    SUP.files=[];SUP.tab='open';toast('Ticket sent. We reply right here.','win');supDraw()};
}
function msgHtml(m,t,admin){
  if(m.kind==='account')return`<div class="sm-acct${m.internal?' internal':''}"><details${admin?'':''}><summary>${ic('users',15)}${admin?(m.internal?'Account refreshed by staff':'Account attached by the player'):'Your account was shared with support'}<time>${dtt(m.at)}</time></summary>${acctCard(m.account,{staff:admin,compact:true})}</details></div>`;
  if(m.kind==='system')return`<div class="sm-sys${m.internal?' internal':''}"><span>${esc(m.body)}</span><time>${dtt(m.at)}</time></div>`;
  const mine=admin?m.staff:!m.staff;
  return`<div class="sm ${mine?'me':'them'}${m.staff?' staff':''}${m.internal?' internal':''}"><div class="sm-h"><b>${esc(m.author||'')}</b>${m.internal?'<span class="sm-int">Internal note</span>':''}<time>${dtt(m.at)}</time></div>${m.body?`<p>${esc(m.body)}</p>`:''}${fileThumbs(m.files)}</div>`;
}
function drawTicket(t,admin,keep=''){
  const el=$('#supmain');if(!el)return;
  el.innerHTML=`<div class="sup-th"><div><h3>${esc(t.subject)}</h3><small><span class="sup-s ${t.status}">${t.status==='answered'?'Answered':t.status==='closed'?'Closed':'Open'}</span>${esc(SUP_CAT[t.category]||t.category)} · ${esc(t.id)}${t.reported?` · Reported: <b>${esc(t.reported)}</b>`:''}${admin?` · ${esc(t.player||'')} · <code>${esc(t.walletId||'')}</code>`:''}</small></div>
      <div class="sup-ta">${t.status!=='closed'?`<button class="cta ghost inline" id="stclose">Close</button>`:admin?`<button class="cta ghost inline" id="streopen">Reopen</button>`:''}</div></div>
    <div class="sup-msgs2" id="supmsgs">${t.messages.map(m=>msgHtml(m,t,admin)).join('')}</div>
    ${t.status==='closed'&&!admin?`<p class="note sup-closed">This ticket is closed. <button class="lnk" id="stagain">Open a new one</button> if you still need help.</p>`:
    `<form class="sup-compose" id="supc"><textarea class="txt" rows="3" maxlength="4000" placeholder="${admin?'Reply to the player, or tick Internal note to write to staff only':'Write a reply. You can paste screenshots straight in.'}">${esc(keep)}</textarea>
      <div class="sup-files" id="supfiles"></div>
      <div class="sup-cbar"><label class="ib sup-att" title="Add screenshots" aria-label="Add screenshots">${ic('plus',17,2.4)}<input type="file" id="supfi" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden></label>
        ${admin?'<label class="sup-int"><input type="checkbox" id="supint"> Internal note</label>':''}<span class="sp-flex"></span><button class="cta inline">Send</button></div></form>`}`;
  const ms=$('#supmsgs',el);ms.scrollTop=ms.scrollHeight;
  drawFiles();wireDrop(el);
  const c=$('#supc',el);if(c){c.onsubmit=async e=>{e.preventDefault();const body=$('textarea',c).value.trim(),files=SUP.files.filter(f=>f.id).map(f=>f.id);if(!body&&!files.length)return;
    if(SUP.files.some(f=>f.busy))return toast('Wait for the screenshots to finish uploading.');
    if(WAPI.live){const r=await api(`/api/support/${t.id}/reply`,{body,files,internal:!!($('#supint',c)||{}).checked});if(!r.ok)return toast(r.j.error,'loss')}
    else{const x=S.tickets.find(z=>z.id===t.id);x.messages.push({staff:0,body,at:Date.now(),files:SUP.files.map(f=>({id:f.id,url:f.url}))});save()}
    $('textarea',c).value='';SUP.files=[];supDraw()};
    $('textarea',c).onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))c.requestSubmit()}}
  const cl=$('#stclose',el);if(cl)cl.onclick=async()=>{if(WAPI.live)await api(`/api/support/${t.id}/close`,{});else{S.tickets.find(x=>x.id===t.id).status='closed';save()}toast('Ticket closed.');supDraw()};
  const ro=$('#streopen',el);if(ro)ro.onclick=async()=>{await api(`/api/support/${t.id}/reopen`,{});supDraw()};
  const ag=$('#stagain',el);if(ag)ag.onclick=()=>{SUP.sel='new';SUP.newCat=t.category;supDraw(false)};
  const ac=$('#supacct');
  if(ac&&admin){ac.innerHTML=`<div class="sup-ah"><h3>Player</h3><button class="lnk" id="supref">Refresh account</button></div>${staffBar(t.account||{robloxId:t.robloxId,tradeBlacket:{username:t.player}},t.id)}${acctCard(t.account,{staff:true})}`;
    $$('[data-mod]',ac).forEach(b=>b.dataset.tk=t.id);
    $('#supref',ac).onclick=async()=>{const r=await api(`/api/support/${t.id}/account`,{});if(!r.ok)return toast(r.j.error,'loss');toast('Account refreshed.');supDraw()}}
}

/* ---------- Trade Empire account page ---------- */
function spark(h){
  if(!h||h.length<2)return'<p class="note">Not enough history yet.</p>';
  const W=600,H=120,min=Math.min(...h.map(p=>p.v)),max=Math.max(...h.map(p=>p.v)),r=max-min||1;
  const pts=h.map((p,i)=>[i/(h.length-1)*W,H-8-(p.v-min)/r*(H-16)]);
  const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const up=h.at(-1).v>=h[0].v;
  return`<svg class="te-spark ${up?'up':'down'}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Value over time, from ${fmt0(h[0].v)} to ${fmt0(h.at(-1).v)}"><defs><linearGradient id="tesg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".28"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><path d="${d} L${W} ${H} L0 ${H}Z" fill="url(#tesg)"/><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" vector-effect="non-scaling-stroke"/></svg>`;
}
PAGES.tradeempire=async el=>{
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Trade Empire</div><h2>Your Trade Empire account</h2><p>Your save, your standing and everything you hold, read straight from the game.</p></div></div><div id="teb"><div class="spin"></div></div>`;
  if(!S.user){$('#teb',el).innerHTML=`<div class="empty"><h3>Sign in to see your account</h3><p>We read it from Trade Empire with your Roblox account.</p><button class="cta inline" data-open="login">Sign in</button></div>`;return}
  const a=await myAccount(true);const box=$('#teb',el);if(!box)return;
  if(!a){box.innerHTML=`<div class="empty"><h3>Could not load your account</h3><p>Try again in a moment.</p></div>`;return}
  const R=a.roblox||{},T=a.tradeEmpire||{},B=a.tradeBlacket||{},st=T.standing;
  const tile=(l,v,s='')=>`<div class="te-t"><span>${l}</span><b>${v}</b>${s?`<small>${s}</small>`:''}</div>`;
  box.innerHTML=`
    <section class="te-hero">
      <div class="te-id"><img src="${WAPI.live?`/img/avatar/${a.robloxId}`:''}" alt="" onerror="this.style.visibility='hidden'"><div><h3>${esc(R.displayName||S.user.name)}</h3><span>@${esc(R.name||S.user.name)}${R.verified?' <i class="ac-ver" title="Verified">✓</i>':''}</span>
        <div class="te-tags">${T.tradePlus?`<span class="ac-pill gold">TradePlus ${esc(T.tradePlus.tier)}</span>`:''}${T.inGame?'<span class="ac-pill ok">In game now</span>':''}<span class="ac-pill ${R.isBanned?'bad':''}">${R.isBanned?'Banned on Roblox':`Roblox account, ${ageOf(R.created)} old`}</span></div></div></div>
      ${T.hasSave?`<div class="te-tiles">${tile('Rodux',fmt0(T.rodux))}${tile('Total value',fmt0(T.totalValue))}${tile('RAP',fmt0(T.totalRAP))}${tile('Limiteds',fmt0(T.items),`${fmt0(T.uniqueItems)} different`)}${tile('Trades',fmt0(T.trades),T.activeTrades?`${T.activeTrades} open`:'')}${tile('Played',hrs(T.playSeconds),T.dailyStreak?`${fmt0(T.dailyStreak)} daily rewards`:'')}</div>`:''}
    </section>
    ${!T.available?`<div class="empty"><h3>Trade Empire can't be read right now</h3><p>${esc(T.error||'Try again later.')}</p></div>`:!T.hasSave?`<div class="empty"><h3>No Trade Empire save yet</h3><p>Play Trade Empire once and your account shows up here.</p></div>`:`
    <div class="te-grid">
      <section class="card te-stand"><div class="sec-h" style="margin-top:0"><h3 class="sec">Account standing</h3><span class="ac-pill l-${esc(st.level)}">${esc(st.label)}</span></div>
        ${standBar(st,{big:true})}<p class="ac-msg">${esc(st.message)}${st.suspendedUntil?` You can play again on ${dtt(st.suspendedUntil)}.`:''}</p>
        ${standCounts(st)}
        <h4 class="te-h4">History</h4>${violList(st.violations,{empty:'No violations. Thank you for following the rules.'})}
        ${st.violations.some(v=>v.counts||v.action==='Termination')?`<p class="note">Appeals for Trade Empire are made in the game, on the Account Standing page. For TradeBlacket decisions, <button class="lnk" data-go="support" data-p="new:appeal">open an appeal ticket</button>.</p>`:''}
      </section>
      <div class="mstack">
        <section class="card te-val"><div class="sec-h" style="margin-top:0"><h3 class="sec">Inventory value</h3><span class="note">${T.valueHistory.length?`last ${T.valueHistory.length} snapshots`:''}</span></div>${spark(T.valueHistory)}</section>
        <section class="card te-tb"><div class="sec-h" style="margin-top:0"><h3 class="sec">On TradeBlacket</h3><span class="ac-pill l-${esc(B.standing.level)}">${esc(B.standing.label)}</span></div>
          <dl class="ac-kv"><div><dt>Balance</dt><dd>${fmt0(B.balance)}</dd></div><div><dt>Site limiteds</dt><dd>${fmt0(B.itemValue)}</dd></div><div><dt>Deposited</dt><dd>${fmt0(T.siteWallet.deposited)}</dd></div><div><dt>Withdrawn</dt><dd>${fmt0(T.siteWallet.withdrawn)}</dd></div><div><dt>Wallet ID</dt><dd><code>${esc(B.walletId)}</code></dd></div><div><dt>Warnings</dt><dd>${fmt0(B.standing.totals.warnings||0)}</dd></div></dl>
          ${B.banned?`<p class="ac-msg bad">${esc(B.banned.reason)}</p>`:''}
          <div class="mstack"><button class="cta ghost inline" data-go="wallet">Open wallet</button><button class="cta ghost inline" data-go="support">Contact support</button></div></section>
        ${T.previousNames.length?`<section class="card"><h3 class="sec" style="margin:0 0 8px">Previous names</h3><p class="note">${T.previousNames.map(esc).join(', ')}</p></section>`:''}
      </div>
    </div>
    <section class="card te-inv"><div class="sec-h" style="margin-top:0"><h3 class="sec">Your limiteds</h3><span class="note" id="teinvn"></span></div><div id="teinv"><div class="spin"></div></div></section>`}`;
  if(!T.hasSave)return;
  const inv=$('#teinv',box);
  if(!WAPI.live){inv.innerHTML=`<p class="note">Preview: your limiteds show here on the live site.</p>`;return}
  const r=await api('/api/items/save');if(!$('#teinv'))return;
  const its=r.ok&&r.j.items?r.j.items.slice().sort((x,y)=>(y.value||0)-(x.value||0)):[];
  $('#teinvn').textContent=its.length?`${fmt0(its.length)} copies`:'';
  inv.innerHTML=its.length?`<div class="te-items">${its.slice(0,48).map(x=>`<div class="te-it">${x.img?`<img src="${esc(x.img)}" alt="" loading="lazy">`:'<span class="te-noimg"></span>'}<b>${esc(x.name||('Item '+x.itemId))}</b><small>#${x.serial} · ${x.value?fmt0(x.value):'No value yet'}</small></div>`).join('')}</div>${its.length>48?`<p class="note">Showing your 48 most valuable. <button class="lnk" data-go="inventory">See all in Inventory</button></p>`:''}`
    :`<p class="note">${r.ok?'No limiteds in your save.':esc(r.j.error||'Could not read your limiteds.')}</p>`;
};

/* ---------- admin: look up a player ---------- */
async function admPlayer(who){
  const box=$('#admp');if(!box)return;
  if(!who){box.innerHTML='';return}
  box.innerHTML='<div class="spin"></div>';
  if(!WAPI.live){box.innerHTML='<p class="note">Preview: player lookups run on the live site.</p>';return}
  const r=await api('/api/admin/account?who='+encodeURIComponent(who));if(!$('#admp'))return;
  if(!r.ok){box.innerHTML=`<p class="note">${esc(r.j.error)}</p>`;return}
  box.innerHTML=`<div class="adm-pl">${staffBar(r.j,null)}${acctCard(r.j,{staff:true})}</div>`;
}
function admPlayersTab(adm,who){
  adm.innerHTML=`<div class="sec-h"><h3 class="sec">Look up a player</h3><span class="note">Roblox profile, Trade Empire standing, TradeBlacket record and linked accounts</span></div>
    <form class="wl-row adm-find" id="admf"><input class="txt" id="admw" placeholder="Roblox username or id" value="${esc(who||'')}"><button class="cta inline">Look up</button></form><div id="admp"></div>`;
  $('#admf',adm).onsubmit=e=>{e.preventDefault();admPlayer($('#admw',adm).value.trim())};
  if(who)admPlayer(who);
}

/* ---------- addresses: tradeblacket.com/support and /tradeempire ---------- */
const PATHS={support:'/support',tradeempire:'/tradeempire',refer:'/refer'};
{const base=go;go=function(v,p){base(v,p);try{const want=PATHS[cur];if(want&&location.pathname!==want)history.replaceState(null,'',want+location.hash);else if(!want&&Object.values(PATHS).includes(location.pathname))history.replaceState(null,'','/'+location.hash)}catch{}}}
{const path=location.pathname.toLowerCase().replace(/\/+$/,''),hit=Object.keys(PATHS).find(k=>PATHS[k]===path);if(hit)go(hit)}
