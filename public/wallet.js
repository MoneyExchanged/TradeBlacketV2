'use strict';
/* =========================================================
   Wallet: Deposit / Withdraw / Rakeback.

   Everything happens on the website. Trade Empire takes no part: the TradeBlacket server reads
   and writes the player's Trade Empire save through Roblox Open Cloud, and only while the player
   is out of the game (the game keeps the save open while they play).
   - Rodux: moved between the save's balance and the TradeBlacket balance.
   - Limiteds: moved between the save's inventory and the TradeBlacket inventory (limiteds.js).

   Two modes:
   - Live: the page is served by the TradeBlacket server (server.js).
   - Preview: anywhere else (like this artifact). Trade Empire is simulated.
   ========================================================= */
const TE={place:82632312078859,name:'Trade Empire'}; // change place to the live game's id
const WAPI={live:false,me:null,seen:null};
(async()=>{
  try{
    const c=new AbortController();setTimeout(()=>c.abort(),2500);
    const r=await fetch('/api/health',{signal:c.signal,credentials:'same-origin'});
    const j=await r.json();if(r.ok&&j.ok){WAPI.live=true;await syncMe()}
  }catch{}
})();
async function syncMe(){
  if(!WAPI.live)return null;
  try{
    const r=await fetch('/api/me',{credentials:'same-origin',cache:'no-store'});
    if(!r.ok){WAPI.me=null;return null}
    const me=await r.json();WAPI.me=me;
    // Credit or debit the play balance once per confirmed transfer, keyed by its reference.
    S.seenRefs=S.seenRefs||[];const seen=new Set(S.seenRefs);
    // First time this browser sees this account: take the server's balance once, and mark the
    // history as seen so it is not counted a second time.
    const fresh=S.seenFor!==me.robloxId;
    if(fresh){S.seenFor=me.robloxId;S.seenRefs=[];seen.clear();if(me.balance>0)pay(me.balance);if(me.bonusLock>0)S.lock=Math.max(S.lock||0,me.bonusLock)}
    for(const t of me.transfers.slice().reverse()){
      if(t.status!=='ok'||!t.reference||seen.has(t.reference))continue;
      seen.add(t.reference);S.seenRefs.push(t.reference);
      if(fresh)continue;
      if(t.kind==='bonus'){bonus(t.amount);toast(`Referral reward: ${fmt(t.amount)} bonus Rodux`,'win')}
      else if(t.kind==='deposit'){pay(t.amount);toast(`${fmt(t.amount)} Rodux arrived from Trade Empire`,'win')}
      else{setBal(S.bal-t.amount);toast(`${fmt(t.amount)} Rodux went back to Trade Empire`,'gold')}
    }
    S.seenRefs=S.seenRefs.slice(-200);save();
    return me;
  }catch{return null}
}

/* ---------- prototype ledger (what the game would hold) ---------- */
function teState(){
  if(!S.te||S.te.dep==null){S.te={rodux:2500,dep:0,wd:0};save()}
  return S.te;
}
function addTx(t){S.tx=S.tx||[];t.id=uid();t.t=Date.now();S.tx.unshift(t);S.tx.length=Math.min(S.tx.length,60);save();return t}
const txRef=k=>(k==='in'?'TBD-':'TBW-')+uid().slice(0,5).toUpperCase()+uid().slice(0,5).toUpperCase();
function wState(){
  if(WAPI.live&&WAPI.me){const m=WAPI.me;return{deposited:m.deposited,withdrawn:m.withdrawn,canBack:Math.max(0,Math.min(S.bal-(S.lock||0),m.withdrawable)),tx:m.transfers.map(t=>({dir:t.kind==='withdraw'?'out':'in',amt:t.amount,status:t.status==='ok'?'Completed':'Refused',ref:t.reference||'',reason:t.reason,t:t.created_at}))}}
  const te=teState();
  return{deposited:te.dep,withdrawn:te.wd,canBack:Math.max(0,Math.floor(Math.min(S.bal-(S.lock||0),te.dep-te.wd))),
    tx:(S.tx||[]).filter(t=>t.kind==='rodux').map(t=>({dir:t.dir,amt:t.amt,status:t.status,ref:t.code,t:t.t}))};
}

/* ---------- rakeback ---------- */
// A share of everything wagered comes back. 5% of wagered x 4% typical edge = 0.20% to start,
// rising with level to 0.40%. Paid as bonus Rodux, so it is wagered once before it can leave.
const RB={base:.002,step:.0002,cap:.004};
const rbRate=()=>Math.min(RB.cap,RB.base+Math.floor(lvl()/5)*RB.step);
function rbState(){
  S.rb=S.rb||{at:S.stats.wagered,acc:0,total:0};
  const d=S.stats.wagered-S.rb.at;if(d>0){S.rb.acc=r2(S.rb.acc+d*rbRate());S.rb.at=S.stats.wagered;save()}
  return S.rb;
}

/* ---------- art ---------- */
const TE_MARK=(s=44)=>`<svg width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="teg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1C5B44"/><stop offset="1" stop-color="#0D2E2A"/></linearGradient><linearGradient id="teo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD27A"/><stop offset="1" stop-color="#E39A1E"/></linearGradient></defs><rect width="48" height="48" rx="12" fill="url(#teg)"/><path d="M12 15.5l4.2 4 3.8-6 4 6 4-6 3.8 6 4.2-4-2 10.5H14z" fill="url(#teo)"/><path d="M14 28.5h20v3.2H27v8.8h-6v-8.8h-7z" fill="url(#teo)"/><rect x="11" y="11" width="26" height="26" rx="13" fill="none" stroke="#FFD27A" stroke-opacity=".08" stroke-width="8"/></svg>`;
const WI={
  deposit:`<svg class="i" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>`,
  withdraw:`<svg class="i" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7 9l5-5 5 5M5 20h14"/></svg>`,
  rakeback:`<svg class="i" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4.5h-4.5"/><path d="M12 8v4l2.5 2"/></svg>`,
  back:`<svg class="i" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>`,
  ext:`<svg class="i" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
};

/* ---------- API helper ---------- */
async function api(path,body){
  try{
    const r=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
    let j={};try{j=await r.json()}catch{}
    if(r.status===403&&j.limit&&typeof drawLimits==='function')drawLimits();
    return{ok:r.ok,status:r.status,j};
  }catch{return{ok:false,status:0,j:{error:'Could not reach TradeBlacket. Check your connection.'}}}
}

/* ---------- the modal ---------- */
function openWallet(tab='deposit',pre=null){
  if(!S.user){openLogin();return}
  if(!['deposit','withdraw','rakeback'].includes(tab))tab='deposit';
  let method=pre,poll=0;
  const m=modal(`<div class="wtabs" role="tablist">${['deposit','withdraw','rakeback'].map(t=>`<button role="tab" data-wt="${t}">${WI[t]}<span>${t[0].toUpperCase()+t.slice(1)}</span></button>`).join('')}</div><div id="wbody" class="wbody"></div>`,{cls:'wal lux',onClose:()=>clearInterval(poll)});
  const R=m.root,B=()=>$('#wbody',R);
  R.addEventListener('click',e=>{const q=e.target.closest('[data-q]');if(!q)return;const a=$('.amt',R),i=$('#wa',R);if(a&&i){i.value=Math.max(0,Math.floor((+a.dataset.cap||0)*+q.dataset.q));$$('[data-q]',R).forEach(x=>x.classList.toggle('on',x===q))}});
  if(WAPI.live)poll=setInterval(async()=>{if(method!=='te')return;const before=JSON.stringify(WAPI.me&&WAPI.me.transfers);await syncMe();if(JSON.stringify(WAPI.me&&WAPI.me.transfers)!==before){await loadGE(true);if(!($('#wa',R)&&document.activeElement===$('#wa',R)))draw()}},6000);

  function draw(){
    $$('[data-wt]',R).forEach(b=>{const on=b.dataset.wt===tab;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});
    if(tab==='rakeback')return rakeback();
    if(!method)return picker();
    return tab==='deposit'?deposit():withdraw();
  }
  function picker(){
    const dep=tab==='deposit',iv=WAPI.me?WAPI.me.itemValue:0;
    const g=GE&&GE.available&&GE.hasSave&&!GE.inGame?GE:null;
    B().innerHTML=`<div class="lx-head"><span class="lx-eyebrow">${dep?'Deposit':'Withdraw'}</span><h3>${dep?`What are you bringing from ${TE.name}?`:`What goes back to ${TE.name}?`}</h3><p>${dep?'Straight from your save. You never have to open the game.':'Straight into your save, within seconds.'}</p></div>
      <div class="lx-methods"><button class="lx-method" data-m="te"><img src="te-rodux.webp" alt="${TE.name}"><span class="lx-mcap"><span class="lx-tag">Currency</span><b>Rodux</b><small>${dep?(g?`${chip(12)}${fmt0(g.balance)} in your save`:'Your in-game balance'):`${chip(12)}${fmt0(wState().canBack)} you can withdraw`}</small></span><i class="lx-arrow">${ic('chev',18,2.2)}</i></button>
        <button class="lx-method l" data-m="ltd"><img src="te-limiteds.webp" alt="${TE.name} Limiteds"><span class="lx-mcap"><span class="lx-tag">Collectibles</span><b>Limiteds</b><small>${dep?'Pick items from your inventory':iv?`${HEX(12)}${fmt0(iv)} on TradeBlacket`:'Items you hold on TradeBlacket'}</small></span><i class="lx-arrow">${ic('chev',18,2.2)}</i></button></div>
      <p class="wnote lx-fine">${ic('shield',13,2)} Moves are checked against your save before anything changes, and never run while you're in the game.</p>`;
    if(dep&&WAPI.live&&!GE)loadGE().then(()=>{if(B()&&!method&&tab==='deposit')picker()});
    $$('[data-m]',R).forEach(b=>b.onclick=()=>{if(b.dataset.m==='ltd'){m.close();openInventory(dep?'game':'site');return}method='te';draw()});
  }
  function head(t){return`<div class="whd"><button class="ib wbk" id="wbk" aria-label="Back">${WI.back}</button><img class="whd-img" src="te-rodux.webp" alt=""><div><b>${t}</b><span>${TE.name} · Rodux</span></div>${WAPI.live?'<i class="wlive">Connected</i>':''}</div>`}
  function history(dir){
    const tx=wState().tx.filter(t=>t.dir===dir).slice(0,4);
    if(!tx.length)return'';
    return`<div class="wlist"><span class="wlbl">Recent</span>${tx.map(t=>`<div class="wrow"><span class="dot ${t.status==='Completed'?'ok':'no'}"></span><b>${dir==='in'?'+':'−'}${fmt0(t.amt)}</b><span class="ref">${esc(t.ref||t.reason||'')}</span><time>${wAgo(t.t)}</time></div>`).join('')}</div>`;
  }
  // Live: read the Trade Empire save once per view.
  let GE=null,geAt=0;
  async function loadGE(force){
    if(!WAPI.live)return null;
    if(GE&&!force&&Date.now()-geAt<8000)return GE;
    const r=await api('/api/game/wallet');GE=r.ok?r.j:{available:false,error:r.j.error};
    geAt=Date.now();return GE;
  }
  async function direct(kind){
    const a=Math.floor(+$('#wa',R).value||0),e=$('#we',R),btn=$('#wgo',R);e.textContent='';
    if(a<1){e.textContent='Enter a whole amount of Rodux.';return}
    if(kind==='deposit'&&!accepted('cds')){if(await needCds())openWallet('deposit','te');return}
    btn.disabled=true;const label=btn.innerHTML;btn.innerHTML=`<div class="spin sm"></div>${kind==='deposit'?'Moving Rodux from':'Sending Rodux to'} ${TE.name}`;
    const r=await api('/api/game/'+kind,{amount:a}),j=r.j;
    if(!B())return;
    if(r.ok){
      await syncMe();await loadGE(true);
      toast(kind==='deposit'?`${fmt0(a)} Rodux moved from ${TE.name} to TradeBlacket`:`${fmt0(a)} Rodux is back in ${TE.name}`,kind==='deposit'?'win':'gold');
      if(j.pending)toast('Roblox is slow to confirm. It will finish on its own in a minute.');
      draw();return;
    }
    btn.disabled=false;btn.innerHTML=label;e.textContent=j.error||'Nothing was moved.';
    if(j.inGame){await loadGE(true);draw()}
  }
  const outOfGame=dep=>`<div class="wwarn">You're in ${TE.name} right now. The game keeps your save open while you play, so ${dep?'deposits':'withdrawals'} can't touch it. Leave the game, wait a few seconds, then press Check again.</div><button class="cta ghost" id="wre">Check again</button>`;
  function liveBody(dep){
    const g=GE;
    if(!g)return`<div class="wwait"><div class="spin"></div><span>Checking your ${TE.name} save…</span></div>`;
    if(!g.available)return`<div class="wwarn">${esc(g.error||`Moving Rodux to and from ${TE.name} is not switched on yet. Please try again later.`)}</div>`;
    if(!g.hasSave)return`<div class="wwarn">We couldn't find a ${TE.name} save for this account. Play ${TE.name} once so your save exists.</div>`;
    if(g.inGame)return outOfGame(dep);
    const cap=dep?g.balance:Math.max(0,Math.min(Math.floor(S.bal-(S.lock||0)),WAPI.me?WAPI.me.withdrawable:0,g.gameWithdrawable));
    return`<div class="wstat"><div><span>In ${TE.name}</span><b>${chip(14)}${fmt0(g.balance)}</b></div><div><span>${dep?'On TradeBlacket':'Can withdraw'}</span><b>${chip(14)}${dep?fmt(S.bal):fmt0(cap)}</b></div></div>
      <div class="wsim live"><span class="wlbl">${dep?`Deposit from your ${TE.name} save`:`Withdraw to your ${TE.name} save`}</span><div class="amt" data-cap="${cap}">${chip(20)}<input id="wa" type="number" min="1" step="1" value="${Math.min(dep?500:cap,cap)}" aria-label="Amount"><button type="button" id="wmax">Max</button></div><div class="lx-quick"><button type="button" data-q=".1">10%</button><button type="button" data-q=".25">25%</button><button type="button" data-q=".5">50%</button><button type="button" data-q="1">Max</button></div><div class="err" id="we"></div><button class="cta" id="wgo"${cap<1?' disabled':''}>${dep?'Deposit':'Withdraw'}</button></div>
      <p class="wnote">Stay out of ${TE.name} while a transfer runs. It takes a few seconds.</p>`;
  }
  function wireLive(dep){
    const cap=()=>dep?GE.balance:Math.max(0,Math.min(Math.floor(S.bal-(S.lock||0)),WAPI.me?WAPI.me.withdrawable:0,GE.gameWithdrawable));
    if($('#wmax',R))$('#wmax',R).onclick=()=>{$('#wa',R).value=cap()};
    if($('#wgo',R))$('#wgo',R).onclick=()=>direct(dep?'deposit':'withdraw');
    if($('#wre',R))$('#wre',R).onclick=async()=>{$('#wre',R).innerHTML='<div class="spin sm"></div>Checking';await loadGE(true);draw()};
  }
  function deposit(){
    const w=wState();
    B().innerHTML=`${head('Deposit Rodux')}
      ${WAPI.live?`<div id="gx">${liveBody(true)}</div>`:`<div class="wstat"><div><span>Signed in as</span><b>${esc(S.user.name)}</b></div><div><span>Deposited so far</span><b>${chip(14)}${fmt0(w.deposited)}</b></div></div>
      <div class="wsim"><span class="wlbl">Preview · ${TE.name} is simulated</span><div class="amt" data-cap="${Math.floor(teState().rodux)}">${chip(20)}<input id="wa" type="number" min="1" step="1" value="${Math.min(500,teState().rodux)}" aria-label="Amount"><button type="button" id="wmax">Max</button></div><div class="lx-quick"><button type="button" data-q=".1">10%</button><button type="button" data-q=".25">25%</button><button type="button" data-q=".5">50%</button><button type="button" data-q="1">Max</button></div><div class="err" id="we"></div><button class="cta" id="wgo">Deposit</button><p class="wnote">${fmt0(teState().rodux)} Rodux left in the simulated ${TE.name} save.</p></div>`}
      ${history('in')}
      <p class="wnote">Deposits follow the <button class="lnk" data-legal="cds">${TE.name} Currency Deduction Service</button>.</p>`;
    $('#wbk',R).onclick=()=>{method=null;draw()};
    if(WAPI.live){if(GE)wireLive(true);else loadGE().then(()=>{if(B()&&tab==='deposit'&&method)draw()});return}
    $('#wmax',R).onclick=()=>{$('#wa',R).value=Math.floor(teState().rodux)};
    $('#wgo',R).onclick=async()=>{const te=teState(),a=Math.floor(+$('#wa',R).value||0),e=$('#we',R);
      if(a<1){e.textContent='Enter a whole amount of Rodux.';return}
      if(a>te.rodux){e.textContent=`Not enough Rodux in ${TE.name}.`;return}
      if(!accepted('cds')){if(await needCds())openWallet('deposit','te');return}
      const btn=$('#wgo',R);btn.disabled=true;btn.innerHTML='<div class="spin sm"></div>Moving Rodux';te.rodux-=a;save();
      await sleep(ri(900,1600));te.dep+=a;pay(a);addTx({dir:'in',kind:'rodux',amt:a,code:txRef('in'),status:'Completed'});
      toast(`${fmt(a)} Rodux moved from ${TE.name}`,'win');if(B())draw()};
  }
  function withdraw(){
    const w=wState(),lockNote=S.lock>0?`<div class="wwarn">${fmt(S.lock)} bonus Rodux still has to be wagered once before it can be withdrawn.</div>`:'';
    B().innerHTML=`${head('Withdraw Rodux')}
      <div class="wbig"><span>Can withdraw</span><b>${chip(22)}${fmt0(w.canBack)}</b><small>You can withdraw up to what you've deposited from ${TE.name}: ${fmt0(w.deposited)} deposited, ${fmt0(w.withdrawn)} already withdrawn.</small></div>
      ${lockNote}
      ${WAPI.live?`<div id="gx">${liveBody(false)}</div>`:`<div class="wsim"><span class="wlbl">Preview · ${TE.name} is simulated</span><div class="amt" data-cap="${w.canBack}">${chip(20)}<input id="wa" type="number" min="1" step="1" value="${w.canBack}" aria-label="Amount"><button type="button" id="wmax">Max</button></div><div class="lx-quick"><button type="button" data-q=".1">10%</button><button type="button" data-q=".25">25%</button><button type="button" data-q=".5">50%</button><button type="button" data-q="1">Max</button></div><div class="err" id="we"></div><button class="cta" id="wgo"${w.canBack<1?' disabled':''}>Withdraw</button></div>`}
      ${history('out')}`;
    $('#wbk',R).onclick=()=>{method=null;draw()};
    if(WAPI.live){if(GE)wireLive(false);else loadGE().then(()=>{if(B()&&tab==='withdraw'&&method)draw()});return}
    $('#wmax',R).onclick=()=>{$('#wa',R).value=wState().canBack};
    $('#wgo',R).onclick=async()=>{const a=Math.floor(+$('#wa',R).value||0),e=$('#we',R),can=wState().canBack;
      if(a<1){e.textContent='Enter a whole amount of Rodux.';return}
      if(a>can){e.textContent=can>0?`You can withdraw up to ${fmt0(can)} Rodux.`:'You have no Rodux to withdraw.';return}
      const btn=$('#wgo',R);btn.disabled=true;btn.innerHTML=`<div class="spin sm"></div>Sending to ${TE.name}`;
      await sleep(ri(900,1600));const te=teState();setBal(S.bal-a);te.wd+=a;te.rodux+=a;save();
      addTx({dir:'out',kind:'rodux',amt:a,code:txRef('out'),status:'Completed'});toast(`${fmt(a)} Rodux is back in ${TE.name}`,'gold');if(B())draw()};
  }
  function rakeback(){
    const rb=rbState(),rate=rbRate(),next=Math.min(RB.cap,rate+RB.step),L=lvl(),toNext=5-(L%5);
    B().innerHTML=`<div class="rbhero"><span>Ready to claim</span><b>${chip(24)}<i id="rba">${fmt(rb.acc)}</i></b><button class="cta" id="rbc"${rb.acc<1?' disabled':''}>${rb.acc<1?'Keep playing to earn rakeback':'Claim rakeback'}</button></div>
      <div class="wstat"><div><span>Your rate</span><b>${(rate*100).toFixed(2)}% of wagered</b></div><div><span>Claimed all time</span><b>${chip(14)}${fmt(rb.total)}</b></div></div>
      <div class="rbbar"><div class="kv"><span>${rate>=RB.cap?'Top rate reached':`${(next*100).toFixed(2)}% at level ${L+toNext}`}</span><b>Level ${L}</b></div><div class="rbtrack"><i style="width:${rate>=RB.cap?100:((L%5)/5*100)}%"></i></div></div>
      <ul class="how"><li>Every bet you place earns rakeback, win or lose.</li><li>The rate goes up by 0.02% every 5 levels, to a top rate of 0.40%.</li><li>Rakeback is paid as bonus Rodux, so it has to be wagered once before you can withdraw it to ${TE.name}.</li></ul>`;
    $('#rbc',R).onclick=()=>{const s=rbState();const a=Math.floor(s.acc*100)/100;if(a<1)return;s.acc=r2(s.acc-a);s.total=r2(s.total+a);save();bonus(a);
      const r=$('#rbc',R).getBoundingClientRect();confetti(r.left+r.width/2,r.top,40);toast(`+${fmt(a)} Rodux rakeback`,'win');draw()};
  }
  $$('[data-wt]',R).forEach(b=>b.onclick=()=>{if(tab!==b.dataset.wt){tab=b.dataset.wt;method=null;draw()}});
  draw();
}
function wAgo(t){const s=Math.max(0,(Date.now()-t)/1e3);return s<60?'now':s<3600?`${Math.floor(s/60)}m`:s<86400?`${Math.floor(s/3600)}h`:`${Math.floor(s/86400)}d`}

document.addEventListener('click',e=>{const w=e.target.closest('[data-wallet]');if(w)openWallet(w.dataset.wallet||'deposit')});
PAGES.wallet=el=>{el.innerHTML=`<div class="empty"><h3>Wallet</h3><p>Move Rodux and limiteds between ${TE.name} and TradeBlacket, and claim rakeback. All from here, no need to open the game.</p><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px"><button class="cta inline" data-wallet="deposit">Deposit</button><button class="cta ghost inline" data-wallet="withdraw">Withdraw</button><button class="cta ghost inline" data-inv="site">Limiteds</button><button class="cta ghost inline" data-wallet="rakeback">Rakeback</button></div></div>`;openWallet('deposit')};
