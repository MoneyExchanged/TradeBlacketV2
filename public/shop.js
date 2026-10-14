'use strict';
/* =========================================================
   Cases · Case Battles · Upgrader · Inventory
   ========================================================= */
function spinReel(reel,c,win,dur,vert){
  return new Promise(res=>{
    const tr=reel.querySelector('.track'),AT=vert?28:46,list=Array.from({length:AT+5},(_,i)=>i===AT?win:pickFrom(c));
    tr.style.transition='none';tr.style.transform='none';tr.innerHTML=list.map(reelTile).join('');void tr.offsetWidth;
    const t=tr.children[AT];
    const off=vert?t.offsetTop+t.offsetHeight/2-reel.clientHeight/2+(rnd()-.5)*t.offsetHeight*.55:t.offsetLeft+t.offsetWidth/2-reel.clientWidth/2+(rnd()-.5)*t.offsetWidth*.7;
    const d=REDUCED?200:dur;
    tr.style.transition=`transform ${d}ms cubic-bezier(.08,.72,.12,1)`;tr.style.transform=vert?`translateY(${-off}px)`:`translateX(${-off}px)`;
    setTimeout(()=>{
      t.classList.add('won');
      const r=ITEM[win].r;if((r==='legendary'||r==='limited')&&reel.isConnected){const b=t.getBoundingClientRect();confetti(b.left+b.width/2,b.top+b.height/2,70)}
      res();
    },d+40);
  });
}
function idleReel(reel,c,vert){
  const tr=reel.querySelector('.track');tr.style.transition='none';tr.style.transform='none';
  tr.innerHTML=Array.from({length:vert?7:16},()=>reelTile(pickFrom(c))).join('');
  requestAnimationFrame(()=>{const o=vert?(tr.scrollHeight-reel.clientHeight)/2:(tr.scrollWidth-reel.clientWidth)/2;tr.style.transform=vert?`translateY(${-Math.max(0,o)}px)`:`translateX(${-Math.max(0,o)}px)`});
}
const caseCard=c=>`<button class="ccard" data-go="case" data-p="${c.id}" style="--h:${c.h}">${c.tag?`<span class="ctag ${c.tag==='New'?'new':c.tag==='Limited'?'ltd':''}">${c.tag}</span>`:''}${caseArt(c)}<b>${esc(c.n)}</b><span class="cprice">${chip(14)}${fmt(c.price)}</span></button>`;

/* ---------- case list ---------- */
PAGES.cases=el=>{
  let q='',sort='pop';
  el.innerHTML=`<div class="page-h"><div><h2>Cases</h2><p>Every case shows its full drop table. Drops land in your inventory, ready to sell for Rodux, upgrade, or show off on your profile.</p></div>
  <div class="tools"><label class="search">${ic('search',16)}<input id="q" placeholder="Search cases" aria-label="Search cases"></label>${seg('srt',[['pop','Popular'],['lo','Cheapest'],['hi','Priciest']],'pop')}</div></div>
  <div class="cgrid" id="cg"></div>
  <div class="sec-h"><h3 class="sec">Free every day</h3></div>
  <div class="card" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap"><div style="width:120px">${caseArt(CASE.daily)}</div><div style="flex:1;min-width:200px"><h3 class="sec">Daily Case</h3><p class="muted" style="margin:6px 0 0">Open one free case every 24 hours. Up to a ${ITEM[CASE.daily.items[0].id].n} inside.</p></div><button class="cta inline" data-go="case" data-p="daily">Open daily case</button></div>`;
  const draw=()=>{let list=SHOP.filter(c=>c.n.toLowerCase().includes(q));if(sort==='lo')list.sort((a,b)=>a.price-b.price);if(sort==='hi')list.sort((a,b)=>b.price-a.price);$('#cg').innerHTML=list.map(caseCard).join('')||'<p class="note">No cases match that search.</p>'};
  $('#q').oninput=e=>{q=e.target.value.trim().toLowerCase();draw()};
  wireSeg($('#srt'),v=>{sort=v;draw()});draw();
};

/* ---------- case opening ---------- */
PAGES.case=(el,id)=>{
  const c=CASE[id]||SHOP[0];let n=1,busy=false,pend=null;
  const ready=()=>Date.now()>=S.dailyCase+DAY;
  const left=()=>{const ms=S.dailyCase+DAY-Date.now(),h=Math.floor(ms/36e5),m=Math.floor(ms%36e5/6e4);return `${h}h ${m}m`};
  el.innerHTML=`<button class="back" data-go="${c.daily?'rewards':'cases'}">${ic('back',16)} ${c.daily?'Rewards':'All cases'}</button>
  <section class="copen" style="--h:${c.h}">
    <div class="copen-h">${caseArt(c)}<div><span class="eyebrow">${c.daily?'Free daily case':'Case'}</span><h2>${esc(c.n)}</h2><p class="muted">${c.items.length} possible drops · top drop ${fmt(ITEM[c.items[0].id].v)} Rodux</p></div></div>
    <div class="reels" id="reels"></div>
    <div class="copen-ctl">
      ${c.daily?'':`<div class="fld"><span>Cases at once</span>${seg('cn',[[1,'1'],[2,'2'],[3,'3'],[4,'4']],1)}</div>`}
      <button class="cta inline grow" id="open"></button>
      ${c.daily?'':`<button class="cta ghost inline" id="demo">Demo spin</button>`}
      <label class="tog"><input type="checkbox" id="fast" ${S.fast?'checked':''}><span></span>Fast open</label>
    </div>
    <div id="won"></div>
  </section>
  <div class="sec-h"><h3 class="sec">Case contents</h3><span class="note">Chances add up to 100%</span></div>
  <div class="igrid">${c.items.map(it=>itemCard(it.id,{top:`<span class="pct">${(it.p*100).toFixed(it.p<.01?2:1)}%</span>`})).join('')}</div>`;
  const open=$('#open'),reelsEl=$('#reels');
  function label(){
    if(c.daily){open.innerHTML=!S.user?'Sign in to open':ready()?'Open for free':`Ready in ${left()}`;open.disabled=!!S.user&&!ready();return}
    open.innerHTML=`Open ${n>1?n+' cases':''} for ${chip(16)} ${fmt(c.price*n)}`;
  }
  function reels(){reelsEl.innerHTML=Array.from({length:n},()=>`<div class="reel"><div class="track"></div></div>`).join('');$$('.reel',reelsEl).forEach(r=>idleReel(r,c))}
  if(!c.daily)wireSeg($('#cn'),v=>{if(busy)return;n=+v;label();reels();$('#won').innerHTML=''});
  $('#fast').onchange=e=>{S.fast=e.target.checked;save()};
  function setBusy(on){busy=on;open.disabled=on||(c.daily&&!ready());if($('#demo'))$('#demo').disabled=on;$$('#cn button').forEach(b=>b.disabled=on)}
  async function spinAll(wins){$('#won').innerHTML='';await Promise.all($$('.reel',reelsEl).map((r,i)=>spinReel(r,c,wins[i],S.fast?1700:5400)))}
  function finish(){
    const wins=pend;pend=null;
    const its=wins.map(id=>addItem(id,c.n));S.stats.cases+=wins.length;
    const val=r2(wins.reduce((a,id)=>a+ITEM[id].v,0)),cost=r2(c.price*wins.length);
    settle('cases',cost,cost?r2(val/cost):0,val,{quiet:1});
    if(!el.isConnected){toast(`Your ${c.n} drops went to your inventory.`);return}
    const box=$('#won');
    box.innerHTML=`<div class="wonbar"><div class="wi">${wins.map(mini).join('')}</div><div class="kv" style="gap:8px"><span>Total</span><b>${fmt(val)}</b></div><button class="cta gold sm" id="sellw">Sell for ${fmt(val)}</button><button class="cta ghost sm" data-go="inventory">Inventory</button><button class="cta ghost sm" data-go="upgrader" data-p="${its[0].u}">Upgrade</button></div>`;
    $('#sellw').onclick=()=>{const live=its.map(x=>x.u).filter(u=>S.inv.some(i=>i.u===u));if(!live.length){toast('Those items are already gone.');return}sellItems(live);box.innerHTML=''};
    toast(val>cost?`Nice pull, worth ${fmt(val)} Rodux`:`Added to inventory`,val>cost?'win':'',wins[0]);
  }
  open.onclick=async()=>{
    if(busy)return;
    if(c.daily){if(!S.user){openLogin();return}if(!ready())return;S.dailyCase=Date.now();save()}
    else if(!take(r2(c.price*n)))return;
    setBusy(true);const wins=Array.from({length:n},()=>pickFrom(c));pend=wins;
    await spinAll(wins);if(!pend)return;finish();setBusy(false);label();
  };
  if($('#demo'))$('#demo').onclick=async()=>{if(busy)return;setBusy(true);await spinAll(Array.from({length:n},()=>pickFrom(c)));if(!el.isConnected)return;$('#won').innerHTML=`<p class="note center" style="margin-top:12px">Demo spin. Nothing was spent and nothing was added.</p>`;setBusy(false);label()};
  label();reels();
  cleanup=()=>{if(pend)finish()};
};

/* ---------- case battles ---------- */
const FORMATS={'1v1':{n:2},'1v1v1':{n:3},'1v1v1v1':{n:4},'2v2':{n:4,teams:[[0,1],[2,3]]}};
const MODES={standard:{l:'Standard',d:'Highest total takes every drop.'},crazy:{l:'Crazy',d:'Lowest total takes every drop.'},shared:{l:'Shared',d:'All drops are split evenly between players.'}};
const BT={list:[],viewing:null};
const bCost=b=>r2(b.cases.reduce((a,id)=>a+CASE[id].price,0));
const botSeat=()=>bot(pick(NAMES));
function newBattle(fmtK,mode,cases){return{id:uid(),fmt:fmtK,mode,cases,seats:Array(FORMATS[fmtK].n).fill(null),status:'waiting',round:0,res:null,tot:Array(FORMATS[fmtK].n).fill(0),win:null,mine:false}}
function rollBattle(b){b.res=b.cases.map(cid=>b.seats.map(()=>pickFrom(CASE[cid])));b.tot=b.seats.map(()=>0);b.status='rolling';b.round=0}
function decide(b){
  const F=FORMATS[b.fmt];
  if(b.mode==='shared'){b.win=b.seats.map((_,i)=>i);return}
  const groups=F.teams||b.seats.map((_,i)=>[i]),score=groups.map(g=>g.reduce((a,i)=>a+b.tot[i],0));
  const best=b.mode==='crazy'?Math.min(...score):Math.max(...score);
  b.win=groups.filter((g,i)=>score[i]===best).flat();
}
function distribute(b,seat){
  const all=b.res.flat().sort((x,y)=>ITEM[y].v-ITEM[x].v),w=b.win,k=w.indexOf(seat);
  return k<0?[]:all.filter((_,i)=>i%w.length===k);
}
function finishInstant(b){
  if(b.status==='waiting'){b.seats=b.seats.map(s=>s||botSeat());rollBattle(b)}
  while(b.round<b.cases.length){b.seats.forEach((_,i)=>{b.tot[i]+=ITEM[b.res[b.round][i]].v});b.round++}
  if(b.status!=='done'){decide(b);b.status='done';b.ended=Date.now()}
}
function payMine(b){
  if(!b.mine||b.paid)return null;b.paid=1;
  const s=b.seats.findIndex(x=>x&&x.me),items=distribute(b,s),val=r2(items.reduce((a,id)=>a+ITEM[id].v,0)),cost=bCost(b);
  if(val>0)pay(val);
  if(b.win.includes(s)&&b.mode!=='shared'){S.stats.battles++;S.mis.battle=1}
  settle('battles',cost,cost?r2(val/cost):0,val,{quiet:1});
  return{items,val,won:b.win.includes(s)};
}
function botBattle(){
  const fmtK=pick(['1v1','1v1','1v1v1','2v2','1v1v1v1']),mode=pick(['standard','standard','standard','crazy','shared']);
  const base=pick(SHOP.slice(0,5)),k=ri(1,6),cs=Array.from({length:k},()=>rnd()<.6?base.id:pick(SHOP).id);
  const b=newBattle(fmtK,mode,cs),filled=ri(1,b.seats.length-1);
  for(let i=0;i<filled;i++)b.seats[i]=botSeat();
  if(rnd()<.35){b.seats=b.seats.map(s=>s||botSeat());rollBattle(b);const r=ri(0,b.cases.length-1);for(let x=0;x<r;x++){b.seats.forEach((_,i)=>{b.tot[i]+=ITEM[b.res[x][i]].v});b.round++}}
  return b;
}
const seedLobby=()=>{while(BT.list.length<8)BT.list.push(botBattle())};
seedLobby();
setInterval(()=>{
  let ch=false;
  BT.list.forEach(b=>{
    if(b.id===BT.viewing||(b.mine&&b.status!=='done'))return;
    if(b.status==='waiting'&&rnd()<.22){const i=b.seats.indexOf(null);b.seats[i]=botSeat();ch=true;if(!b.seats.includes(null))rollBattle(b)}
    else if(b.status==='rolling'&&rnd()<.5){b.seats.forEach((_,i)=>{b.tot[i]+=ITEM[b.res[b.round][i]].v});b.round++;ch=true;if(b.round>=b.cases.length){decide(b);b.status='done';b.ended=Date.now()}}
    else if(b.status==='done'&&Date.now()-b.ended>9000){b.gone=1;ch=true}
  });
  if(ch){BT.list=BT.list.filter(b=>!b.gone);seedLobby();refreshLobby()}
},1500);
function caseStrip(b,max=6){
  const g=[];b.cases.forEach((id,i)=>{const last=g[g.length-1];if(last&&last.id===id)last.n++,last.to=i;else g.push({id,n:1,from:i,to:i})});
  return g.slice(0,max).map(x=>caseThumb(CASE[x.id],b.status==='rolling'&&b.round>=x.from&&b.round<=x.to?'now':b.status!=='waiting'&&b.round>x.to?'done':'',x.n)).join('')+(g.length>max?`<span class="note">+${g.length-max}</span>`:'');
}
function battleRow(b){
  const F=FORMATS[b.fmt],cost=bCost(b);
  const seats=b.seats.map((s,i)=>(F.teams&&i===2?'<i class="vs">VS</i>':'')+(s?`<span data-user="${esc(s.name)}" title="${esc(s.name)}">${avatar(s,30)}</span>`:`<span class="seat-empty">${ic('plus',14)}</span>`)).join('');
  let act;
  if(b.status==='waiting')act=b.mine?`<button class="cta sm" data-go="battle" data-p="${b.id}">Open</button>`:`<button class="cta sm" data-join="${b.id}">Join ${chip(13)} ${fmt(cost)}</button>`;
  else if(b.status==='rolling')act=`<span class="rdot">Round ${b.round+1}/${b.cases.length}</span><button class="cta ghost sm" data-go="battle" data-p="${b.id}">Watch</button>`;
  else{const w=b.win.map(i=>b.seats[i].name).join(' & ');act=`<span class="note" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px">${b.mode==='shared'?'Split':esc(w)+' won'}</span><button class="cta ghost sm" data-go="battle" data-p="${b.id}">View</button>`}
  return `<div class="brow${b.mine?' mine':''}"><div class="bmeta"><span class="mode m-${b.mode}">${MODES[b.mode].l}</span><b>${b.fmt}</b></div><div class="bseats">${seats}</div><div class="bcases">${caseStrip(b)}</div><div class="bcost"><span>${b.cases.length} round${b.cases.length>1?'s':''}</span><b>${chip(14)}${fmt(cost)}</b></div><div class="bact">${act}</div></div>`;
}
function joinBattle(b){
  if(b.status!=='waiting'||!b.seats.includes(null))return false;
  if(!take(bCost(b)))return false;
  b.seats[b.seats.indexOf(null)]=me();b.mine=true;return true;
}
document.addEventListener('click',e=>{
  const j=e.target.closest('[data-join]');if(!j)return;
  const b=BT.list.find(x=>x.id===j.dataset.join);if(!b){toast('That battle already started.');return}
  if(joinBattle(b))go('battle',b.id);
});
let lobbyTab='all';
function refreshLobby(){
  const l=$('#blist');if(l){const list=BT.list.filter(b=>lobbyTab==='all'||(lobbyTab==='open'&&b.status==='waiting')||(lobbyTab==='live'&&b.status!=='waiting'));l.innerHTML=list.map(battleRow).join('')||'<p class="note">No battles here right now.</p>';const c=$('#bcount');if(c)c.textContent=BT.list.length}
  const h=$('#hb');if(h)h.innerHTML=BT.list.slice(0,3).map(battleRow).join('');
}
PAGES.battles=el=>{
  el.innerHTML=`<div class="page-h"><div><h2>Case Battles</h2><p>Everyone opens the same cases, round by round. Standard: highest total wins the pot. Crazy: lowest total wins. Shared: the pot is split. Winnings are paid to your balance the moment the battle ends.</p></div>
  <div class="tools"><div class="stats3"><div class="stat"><span>Active battles</span><b id="bcount">${BT.list.length}</b></div></div><button class="cta inline" id="mk">${ic('plus',18,2.2)} Create battle</button></div></div>
  <div class="tabs" id="btabs" style="margin-bottom:12px"><button data-t="all" class="${lobbyTab==='all'?'on':''}">All battles</button><button data-t="open" class="${lobbyTab==='open'?'on':''}">Joinable</button><button data-t="live" class="${lobbyTab==='live'?'on':''}">Live &amp; finished</button></div>
  <div class="blist" id="blist"></div>`;
  $('#mk').onclick=openCreate;
  $$('#btabs button').forEach(b=>b.onclick=()=>{lobbyTab=b.dataset.t;$$('#btabs button').forEach(x=>x.classList.toggle('on',x===b));refreshLobby()});
  refreshLobby();
};
function openCreate(preset){
  if(!S.user){openLogin();return}
  const q={};let fmtK=preset?.fmt||'1v1',mode=preset?.mode||'standard';
  (preset?.cases||[]).forEach(id=>q[id]=(q[id]||0)+1);
  const m=modal(`<span class="eyebrow">New battle</span><h3>Create a case battle</h3>
  <div class="mstack">
    <div class="fld"><span>Players</span>${seg('cf',Object.keys(FORMATS).map(k=>[k,k]),fmtK)}</div>
    <div class="fld"><span>Mode</span>${seg('cmode',Object.entries(MODES).map(([k,v])=>[k,v.l]),mode)}<p class="note" id="mdesc"></p></div>
    <div class="fld"><span>Cases · up to 10 rounds</span><div class="pickcases">${SHOP.map(c=>`<div class="pkc" data-c="${c.id}" style="--h:${c.h}">${caseArt(c)}<b>${esc(c.n)}</b><span>${chip(11)}${fmt(c.price)}</span><div class="qty"><button type="button" data-d="-1" aria-label="Fewer">−</button><span>0</span><button type="button" data-d="1" aria-label="More">+</button></div></div>`).join('')}</div></div>
    <div class="kv"><span>Rounds</span><b id="crn">0</b></div><div class="kv"><span>Your entry</span><b id="cco">0.00</b></div>
    <button class="cta" id="mkb" disabled>Create battle</button>
  </div>`,{cls:'wide'});
  const R=m.root;
  function upd(){
    const rounds=Object.values(q).reduce((a,b)=>a+b,0),cost=Object.entries(q).reduce((a,[id,k])=>a+CASE[id].price*k,0);
    $$('.pkc',R).forEach(p=>{const k=q[p.dataset.c]||0;p.querySelector('.qty span').textContent=k;p.classList.toggle('on',k>0)});
    $('#crn',R).textContent=rounds;$('#cco',R).textContent=fmt(cost);$('#mkb',R).disabled=!rounds;$('#mdesc',R).textContent=MODES[mode].d;
  }
  $$('.pkc',R).forEach(p=>p.querySelectorAll('button').forEach(b=>b.onclick=()=>{const id=p.dataset.c,tot=Object.values(q).reduce((a,c)=>a+c,0),d=+b.dataset.d;if(d>0&&tot>=10){toast('Battles are capped at 10 rounds.');return}q[id]=Math.max(0,(q[id]||0)+d);upd()}));
  wireSeg($('#cf',R),v=>fmtK=v);wireSeg($('#cmode',R),v=>{mode=v;upd()});
  $('#mkb',R).onclick=()=>{
    const cases=[];SHOP.forEach(c=>{for(let i=0;i<(q[c.id]||0);i++)cases.push(c.id)});
    const b=newBattle(fmtK,mode,cases);b.seats[0]=me();b.mine=true;
    if(!take(bCost(b)))return;
    BT.list.unshift(b);m.close();go('battle',b.id);
  };
  upd();
}
PAGES.battle=(el,id)=>{
  const b=BT.list.find(x=>x.id===id);if(!b){go('battles');return}
  BT.viewing=b.id;const F=FORMATS[b.fmt],n=b.seats.length;let alive=true,fillT=0;
  el.innerHTML=`<button class="back" data-go="battles">${ic('back',16)} Battles</button>
  <div class="bv-h"><div><span class="mode m-${b.mode}">${MODES[b.mode].l}</span><b class="fmt">${b.fmt}</b><p class="note" style="margin-top:4px">${MODES[b.mode].d}</p></div><div class="bv-strip" id="strip"></div><div class="bcost"><span>Pot value</span><b>${chip(14)}${fmt(bCost(b)*n)}</b></div></div>
  <div class="arena n${n}${F.teams?' teams':''}" id="arena">${b.seats.map((_,i)=>`<div class="col" id="col${i}"><div class="pcard" id="pc${i}"></div><div class="vslot" id="vs${i}"></div><div class="pdrops" id="pd${i}"></div></div>`).join('')}${n===2||F.teams?'<div class="vsb">VS</div>':''}</div>
  <div id="bnr"></div>`;
  const drawStrip=()=>{$('#strip').innerHTML=b.cases.map((cid,i)=>caseThumb(CASE[cid],b.status==='rolling'&&i===b.round?'now':i<b.round?'done':'')).join('')};
  function drawSeat(i,bump){
    const s=b.seats[i],pc=$('#pc'+i);if(!pc)return;
    if(!s){pc.innerHTML=`<span class="seat-empty">${ic('plus',14)}</span><div class="nm"><b style="color:var(--muted)">Open seat</b></div>`;return}
    pc.innerHTML=`<span data-user="${esc(s.name)}">${avatar(s,38)}</span><div class="nm"><b data-user="${esc(s.name)}" style="cursor:pointer">${esc(s.name)}</b><span class="lv${s.lvl>=30?' g':''}">${s.lvl??lvl()}</span></div><span class="tot${bump?' up':''}">${chip(15)}${fmt(b.tot[i])}</span>`;
  }
  function drawSlot(i){
    const s=b.seats[i],v=$('#vs'+i);if(!v)return;
    if(!s){
      const mineIn=b.mine;
      v.innerHTML=`<div class="seat-wait"><div class="spin"></div>Waiting for a player${mineIn?`<button class="cta ghost sm" data-bot="${i}">Call a bot</button>`:`<button class="cta sm" data-jn>Join ${chip(13)} ${fmt(bCost(b))}</button>`}</div>`;
      return;
    }
    if(!v.querySelector('.vreel')){v.innerHTML=`<div class="vreel"><div class="track"></div></div>`;idleReel(v.querySelector('.vreel'),CASE[b.cases[Math.min(b.round,b.cases.length-1)]],true)}
  }
  const drawDrops=i=>{const d=$('#pd'+i);if(!d||!b.res)return;d.innerHTML=b.res.slice(0,b.round).map(r=>{const it=ITEM[r[i]];return `<div class="pd r-${it.r}" title="${esc(it.n)}">${itemSvg(it.id)}<span>${fmt0(it.v)}</span></div>`}).join('')};
  const drawAll=()=>{drawStrip();b.seats.forEach((_,i)=>{drawSeat(i);drawSlot(i);drawDrops(i)})};
  el.addEventListener('click',e=>{
    const bt=e.target.closest('[data-bot]');if(bt){fill(+bt.dataset.bot);return}
    if(e.target.closest('[data-jn]')){if(joinBattle(b)){drawAll();autoFill()}}
  });
  function fill(i){if(b.status!=='waiting'||b.seats[i])return;b.seats[i]=botSeat();drawSeat(i);drawSlot(i);if(!b.seats.includes(null))start()}
  function autoFill(){clearTimeout(fillT);if(!alive||b.status!=='waiting'||!b.mine)return;fillT=setTimeout(()=>{const i=b.seats.indexOf(null);if(i>=0)fill(i);autoFill()},ri(1400,2600))}
  function start(){clearTimeout(fillT);rollBattle(b);drawAll();run()}
  async function run(){
    while(alive&&b.round<b.cases.length){
      const r=b.round,c=CASE[b.cases[r]];drawStrip();
      await Promise.all(b.seats.map((_,i)=>{const v=$(`#vs${i} .vreel`);return v?spinReel(v,c,b.res[r][i],S.fast?1500:3000,true):Promise.resolve()}));
      if(!alive)return;
      b.seats.forEach((_,i)=>{b.tot[i]+=ITEM[b.res[r][i]].v});b.round++;
      b.seats.forEach((_,i)=>{drawSeat(i,true);drawDrops(i)});drawStrip();
      await sleep(650);
    }
    if(!alive)return;
    if(b.status!=='done'){decide(b);b.status='done';b.ended=Date.now()}
    end();
  }
  function end(){
    drawAll();
    b.seats.forEach((_,i)=>{const c=$('#col'+i);c.classList.toggle('winner',b.win.includes(i));c.classList.toggle('loser',!b.win.includes(i))});
    const res=payMine(b),bn=$('#bnr'),pot=b.res.flat().reduce((a,id)=>a+ITEM[id].v,0);
    if(b.mine){
      const s=b.seats.findIndex(x=>x&&x.me),won=b.win.includes(s),got=res?res.val:distribute(b,s).reduce((a,id)=>a+ITEM[id].v,0);
      bn.innerHTML=`<div class="bv-banner${won?' win':''}"><h3>${b.mode==='shared'?`Split pot: ${fmt(got)} Rodux`:won?`You won ${fmt(got)} Rodux`:'Not this time'}</h3><p class="muted" style="margin:0 0 14px">${won?'The value of every drop you won went straight to your balance.':`The pot of ${fmt(pot)} went to ${esc(b.win.map(i=>b.seats[i].name).join(' & '))}.`}</p><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="cta inline" id="again">Battle again · ${fmt(bCost(b))}</button><button class="cta ghost inline" data-go="battles">Back to lobby</button></div></div>`;
      if(won&&res&&!res.shown){res.shown=1;confetti(innerWidth/2,innerHeight/2,160)}
      $('#again').onclick=()=>openCreate({fmt:b.fmt,mode:b.mode,cases:b.cases});
    }else{
      bn.innerHTML=`<div class="bv-banner"><h3>${b.mode==='shared'?'Pot split evenly':esc(b.win.map(i=>b.seats[i].name).join(' & '))+' won'}</h3><p class="muted" style="margin:0 0 14px">Pot value ${fmt(pot)} Rodux.</p><button class="cta inline" style="margin:0 auto" id="again">Create a battle like this</button></div>`;
      $('#again').onclick=()=>openCreate({fmt:b.fmt,mode:b.mode,cases:b.cases});
    }
  }
  drawAll();
  if(b.status==='waiting'){if(b.mine)autoFill()}
  else if(b.status==='rolling')run();
  else end();
  cleanup=()=>{
    alive=false;clearTimeout(fillT);BT.viewing=null;
    if(b.mine&&b.status!=='done'){finishInstant(b);const r=payMine(b);if(r)toast(r.won?`Battle finished. ${fmt(r.val)} Rodux added to your balance.`:'Battle finished. You lost this one.',r.won?'win':'loss')}
  };
};

/* ---------- upgrader ---------- */
PAGES.upgrader=(el,pre)=>{
  const sel=new Set(pre&&S.inv.some(x=>x.u===pre)?[pre]:[]);let target=null,under=true,busy=false,rot=0,tq='';
  el.innerHTML=`<div class="page-h"><div><h2>Upgrader</h2><p>Stake items or Rodux for a chance at something better. The bigger the jump, the smaller the chance. Land in the green zone to win the target.</p></div><span class="rtp">${ic('shield',14,2)} RTP 95%</span></div>
  <div class="upg">
    <div class="card upg-side"><span class="eyebrow">Your stake</span><div class="slot" id="stake"></div><label class="fld"><span>Add Rodux</span><div class="amt">${chip(16)}<input id="uch" type="number" min="0" step="1" value="0"><button type="button" id="uchc">Clear</button></div></label><div class="kv"><span>Stake value</span><b id="sv">0.00</b></div></div>
    <div class="upg-mid">
      <div class="wheel" id="wheel"><svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="100" class="w-track"/><circle cx="120" cy="120" r="100" class="w-arc" id="arc"/><circle cx="120" cy="120" r="82" class="w-in"/></svg><div class="needle" id="needle"><i></i></div><div class="w-read"><b id="pct">0.00%</b><span>chance</span></div></div>
      ${seg('ud',[['u','Roll under'],['o','Roll over']],'u')}
      <div class="presets" id="pre">${[1.5,2,3,5,10,20].map(m=>`<button type="button" data-m="${m}">${m}×</button>`).join('')}</div>
      <button class="cta" id="ugo" disabled>Upgrade</button>
    </div>
    <div class="card upg-side"><span class="eyebrow">Target</span><div class="slot" id="tgt"></div><div class="kv"><span>Multiplier</span><b id="umul">—</b></div></div>
  </div>
  <div class="upg-pick">
    <div class="card"><div class="ph"><h3 class="sec">Your items</h3><span class="note">Pick up to 6</span></div><div class="igrid sm" id="uinv"></div></div>
    <div class="card"><div class="ph"><h3 class="sec">Pick a target</h3><label class="search sm">${ic('search',14)}<input id="tq" placeholder="Search items" aria-label="Search targets"></label></div><div class="igrid sm" id="ucat"></div></div>
  </div>`;
  const C=2*Math.PI*100,arc=$('#arc');
  const stakeVal=()=>r2([...sel].reduce((a,u)=>{const x=S.inv.find(i=>i.u===u);return a+(x?ITEM[x.id].v:0)},0)+Math.max(0,Math.floor(+$('#uch').value||0)));
  const chance=()=>{const s=stakeVal();return target&&s>0?Math.min(.75,s/ITEM[target].v*.95):0};
  function draw(){
    const s=stakeVal(),ch=chance();
    const st=[...sel].map(u=>S.inv.find(i=>i.u===u)).filter(Boolean);
    $('#stake').className='slot'+(st.length?' full':'');
    $('#stake').innerHTML=st.length?`<div class="stack">${st.map(x=>itemCard(x.id,{cls:'pick',attr:`data-un="${x.u}"`})).join('')}</div>`:(+$('#uch').value>0?`<div class="center"><div style="font-size:40px">${chip(54)}</div><b class="num">${fmt(+$('#uch').value)}</b></div>`:'Pick items from your inventory below, or add Rodux.');
    $('#tgt').className='slot'+(target?' full':'');
    $('#tgt').innerHTML=target?`<div class="big">${itemCard(target)}</div>`:'Pick a target item, or use a multiplier preset.';
    $('#sv').textContent=fmt(s);$('#umul').textContent=target&&s?(ITEM[target].v/s).toFixed(2)+'×':'—';
    $('#pct').textContent=(ch*100).toFixed(2)+'%';
    arc.style.strokeDasharray=`${C*ch} ${C}`;arc.style.transform=under?'none':`rotate(${360*(1-ch)}deg)`;
    $('#ugo').disabled=busy||!ch;
    $('#ugo').textContent=target&&s?`Upgrade to ${ITEM[target].n}`:'Upgrade';
    $('#uinv').innerHTML=S.inv.length?S.inv.map(x=>itemCard(x.id,{cls:'pick'+(sel.has(x.u)?' sel':''),attr:`data-ui="${x.u}" tabindex="0"`,top:`<span class="ck">${ic('check',12,3)}</span>${x.s?`<span class="ser">#${x.s}</span>`:''}`})).join(''):`<p class="note">No items yet. Open a case first, or stake Rodux.</p>`;
    const list=CAT.filter(i=>i.v>s&&i.n.toLowerCase().includes(tq)).slice(0,60);
    $('#ucat').innerHTML=list.map(i=>itemCard(i.id,{cls:'pick'+(target===i.id?' sel':''),attr:`data-ut="${i.id}" tabindex="0"`,top:`<span class="ck">${ic('check',12,3)}</span>`})).join('')||'<p class="note">Nothing above your stake matches.</p>';
  }
  el.addEventListener('click',e=>{
    if(busy)return;
    const a=e.target.closest('[data-ui]');if(a){const u=a.dataset.ui;sel.has(u)?sel.delete(u):sel.size<6?sel.add(u):toast('Up to 6 items per upgrade.');if(target&&ITEM[target].v<=stakeVal())target=null;draw();return}
    const t=e.target.closest('[data-ut]');if(t){target=t.dataset.ut;draw();return}
    const r=e.target.closest('[data-un]');if(r){sel.delete(r.dataset.un);draw();return}
    const p=e.target.closest('#pre button');if(p){const s=stakeVal();if(!s){toast('Add a stake first.');return}const want=s*+p.dataset.m;target=(CAT.filter(i=>i.v>s).sort((x,y)=>Math.abs(x.v-want)-Math.abs(y.v-want))[0]||{}).id||null;draw()}
  });
  $('#uch').oninput=()=>{if(target&&ITEM[target].v<=stakeVal())target=null;draw()};
  $('#uchc').onclick=()=>{$('#uch').value=0;draw()};
  $('#tq').oninput=e=>{tq=e.target.value.trim().toLowerCase();draw()};
  wireSeg($('#ud'),v=>{under=v==='u';draw()});
  $('#ugo').onclick=async()=>{
    if(busy)return;const ch=chance(),s=stakeVal(),Rodux=Math.max(0,Math.floor(+$('#uch').value||0));if(!ch)return;
    if(!S.user){openLogin();return}
    if(Rodux>0&&!take(Rodux))return;
    const stake=[...sel];S.inv=S.inv.filter(x=>!sel.has(x.u));S.profile.showcase=S.profile.showcase.filter(u=>!sel.has(u));save();drawInvCount();
    busy=true;$('#ugo').disabled=true;const w=$('#wheel');w.classList.remove('win','lose');
    const r=rnd(),win=under?r<ch:r>1-ch,tgt=target;
    rot=rot-(rot%360)+360*5+r*360;$('#needle').style.transform=`rotate(${rot}deg)`;
    const done=()=>{
      if(win){addItem(tgt,'Upgrader');S.stats.upgrades++;settle('upgrader',s,r2(ITEM[tgt].v/s),ITEM[tgt].v,{quiet:1})}else settle('upgrader',s,0,0);
      return win;
    };
    pendU=done;
    await sleep(REDUCED?300:4700);
    if(!pendU)return;pendU=null;done();
    if(!el.isConnected)return;
    w.classList.add(win?'win':'lose');$('#pct').textContent=win?'Upgraded':'Missed';
    if(win){toast(`Upgraded to ${ITEM[tgt].n}`,'win',tgt);const b=w.getBoundingClientRect();confetti(b.left+b.width/2,b.top+b.height/2,140)}else toast(`Missed. ${stake.length?'Stake items are gone.':'Rodux lost.'}`,'loss');
    sel.clear();target=win?null:tgt;$('#uch').value=0;busy=false;
    setTimeout(()=>{if(el.isConnected){w.classList.remove('win','lose');draw()}},1400);
  };
  let pendU=null;
  draw();
  cleanup=()=>{if(pendU){const f=pendU;pendU=null;f()}};
};

/* ---------- inventory ---------- */
PAGES.inventory=el=>{
  if(!S.user){el.innerHTML=`<div class="empty"><h3>Sign in to see your inventory</h3><p>Items you unbox, win in battles and upgrade into live here.</p><button class="cta inline" data-open="login">Sign in</button></div>`;return}
  const sel=new Set();let sort='hi',rar='all';
  el.innerHTML=`<div class="page-h"><div><h2>Inventory</h2><p>Sell items back for Rodux, send them to the Upgrader, or star up to three for your profile showcase.</p></div><div class="stats3"><div class="stat"><span>Items</span><b id="ic">0</b></div><div class="stat"><span>Total value</span><b id="iv">0</b></div></div></div>
  <div class="tools" style="margin-bottom:14px;justify-content:space-between"><div class="tabs" id="rf">${['all','common','uncommon','rare','epic','legendary','limited'].map(r=>`<button data-r="${r}" class="${r==='all'?'on':''}">${r==='all'?'All':RAR[r]}</button>`).join('')}</div>${seg('isort',[['hi','Value ↓'],['lo','Value ↑'],['new','Newest']],'hi')}</div>
  <div class="igrid" id="ig"></div>
  <div class="invbar" id="ibar"></div>`;
  function draw(){
    const val=invVal();$('#ic').textContent=S.inv.length;$('#iv').innerHTML=chip(15)+fmt(val);
    let list=S.inv.filter(x=>rar==='all'||ITEM[x.id].r===rar);
    list=[...list].sort(sort==='new'?(a,b)=>b.t-a.t:sort==='lo'?(a,b)=>ITEM[a.id].v-ITEM[b.id].v:(a,b)=>ITEM[b.id].v-ITEM[a.id].v);
    $('#ig').innerHTML=list.length?list.map(x=>itemCard(x.id,{cls:'pick'+(sel.has(x.u)?' sel':''),attr:`data-iu="${x.u}" tabindex="0"`,top:`<span class="ck">${ic('check',12,3)}</span>${x.s?`<span class="ser">#${x.s}/500</span>`:''}`,bottom:`<div class="itc-acts"><button data-sell="${x.u}" title="Sell">Sell</button><button data-up="${x.u}" title="Upgrade">${ic('upgrader',14,2.2)}</button><button data-star="${x.u}" class="${S.profile.showcase.includes(x.u)?'on':''}" title="Showcase on profile">${ic('star',14,2.2)}</button></div>`})).join(''):`<div class="empty" style="grid-column:1/-1"><h3>${S.inv.length?'Nothing in this rarity':'Your inventory is empty'}</h3><p>Open a case or win a battle to get your first items.</p><button class="cta inline" data-go="cases">Browse cases</button></div>`;
    const sv=[...sel].reduce((a,u)=>{const x=S.inv.find(i=>i.u===u);return a+(x?ITEM[x.id].v:0)},0);
    $('#ibar').innerHTML=`<span class="muted"><b style="color:var(--fg)">${sel.size}</b> selected · ${chip(13)} <b style="color:var(--fg)">${fmt(sv)}</b></span><div class="spacer"></div><button class="cta ghost sm" id="sa">${sel.size?'Clear':'Select all'}</button><button class="cta ghost sm" id="su" ${sel.size&&sel.size<=6?'':'disabled'}>Upgrade</button><button class="cta gold sm" id="ss" ${sel.size?'':'disabled'}>Sell ${sel.size?'for '+fmt(sv):'selected'}</button>`;
    $('#ibar').hidden=!S.inv.length;
    $('#sa').onclick=()=>{if(sel.size)sel.clear();else list.forEach(x=>sel.add(x.u));draw()};
    $('#ss').onclick=()=>{sellItems([...sel]);sel.clear();draw()};
    $('#su').onclick=()=>go('upgrader',[...sel][0]);
  }
  el.addEventListener('click',e=>{
    const s=e.target.closest('[data-sell]');if(s){sel.delete(s.dataset.sell);sellItems([s.dataset.sell]);draw();return}
    const u=e.target.closest('[data-up]');if(u){go('upgrader',u.dataset.up);return}
    const st=e.target.closest('[data-star]');if(st){const id=st.dataset.star,sc=S.profile.showcase;if(sc.includes(id))sc.splice(sc.indexOf(id),1);else if(sc.length>=3){toast('Your showcase holds 3 items. Unstar one first.')}else{sc.push(id);toast('Added to your profile showcase.','gold')}save();draw();return}
    const c=e.target.closest('[data-iu]');if(c){const id=c.dataset.iu;sel.has(id)?sel.delete(id):sel.add(id);draw()}
  });
  $$('#rf button').forEach(b=>b.onclick=()=>{rar=b.dataset.r;$$('#rf button').forEach(x=>x.classList.toggle('on',x===b));draw()});
  wireSeg($('#isort'),v=>{sort=v;draw()});
  draw();
};
