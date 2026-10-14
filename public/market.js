'use strict';
/* =========================================================
   Marketplace · Predictions · News
   ========================================================= */
function seeded(seed){let s=seed%2147483647||1;return()=>(s=s*16807%2147483647)/2147483647}
function sparkSVG(pts,cls='spark',col='var(--blue)'){
  const w=200,h=50,mn=Math.min(...pts),mx=Math.max(...pts),rg=mx-mn||1;
  const xy=pts.map((v,i)=>[i/(pts.length-1)*w,h-4-(v-mn)/rg*(h-8)]);
  const d=xy.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join('');
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}L${w} ${h}L0 ${h}Z" fill="${col}" opacity=".12"/><path d="${d}" fill="none" stroke="${col}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`;
}

/* ---------- marketplace ---------- */
const MK={list:[],sales:[],hist:{}};
function priceHist(id){
  if(MK.hist[id])return MK.hist[id];const r=seeded(hash(id)),v=ITEM[id].v;let p=v*(.85+r()*.2);const a=[];
  for(let i=0;i<30;i++){p=p*(1+(r()-.48)*.06);p=p*.9+v*.1;a.push(r2(p))}a[29]=v;return MK.hist[id]=a;
}
function mkListing(id,seller,mine){const v=ITEM[id].v,r=rnd();return{id:uid(),item:id,s:ITEM[id].r==='limited'?ri(1,500):0,price:r2(v*(mine?1:(.9+r*.32))),seller:seller||bot(pick(NAMES)),t:Date.now()-ri(0,7200)*1000,mine:!!mine}}
function randCatItem(){const r=rnd();const pool=r<.55?CAT.filter(i=>i.v<100):r<.85?CAT.filter(i=>i.v>=100&&i.v<1500):r<.97?CAT.filter(i=>i.v>=1500&&i.v<10000):CAT.filter(i=>i.v>=10000);return pick(pool).id}
for(let i=0;i<46;i++)MK.list.push(mkListing(randCatItem()));
for(let i=0;i<14;i++){const id=randCatItem();MK.sales.push({item:id,price:r2(ITEM[id].v*(.9+rnd()*.25)),buyer:bot(pick(NAMES)),t:Date.now()-ri(60,7200)*1000})}
MK.sales.sort((a,b)=>b.t-a.t);
setInterval(()=>{
  let ch=false;
  if(rnd()<.45){const bots=MK.list.filter(l=>!l.mine);const l=pick(bots);if(l){MK.list.splice(MK.list.indexOf(l),1);MK.sales.unshift({item:l.item,price:l.price,buyer:bot(pick(NAMES)),t:Date.now()});ch=true}}
  if(rnd()<.5||MK.list.length<40){MK.list.unshift(mkListing(randCatItem()));ch=true}
  MK.list.filter(l=>l.mine).forEach(l=>{const v=ITEM[l.item].v;if(l.price<=v*1.12&&rnd()<(l.price<=v?.35:.15)){MK.list.splice(MK.list.indexOf(l),1);const net=r2(l.price*.95);pay(net);MK.sales.unshift({item:l.item,price:l.price,buyer:bot(pick(NAMES)),t:Date.now(),mine:1});toast(`Your ${ITEM[l.item].n} sold for ${fmt(l.price)}. ${fmt(net)} Rodux added after the 5% fee.`,'win',l.item);ch=true}});
  MK.sales.length=Math.min(MK.sales.length,60);
  if(ch&&typeof MK.redraw==='function')MK.redraw();
},4000);
const ago=t=>{const s=Math.max(1,Math.floor((Date.now()-t)/1000));return s<60?s+'s ago':s<3600?Math.floor(s/60)+'m ago':Math.floor(s/3600)+'h ago'};
function lstCard(l){
  const v=ITEM[l.item].v,d=(l.price-v)/v*100;
  return `<div class="lst">${itemCard(l.item,{cls:'pick',attr:`data-item="${l.item}" tabindex="0"`,top:l.s?`<span class="ser">#${l.s}</span>`:''})}
  <div class="pr"><b>${chip(13)}${fmt(l.price)}</b><span class="delta ${d>0.5?'up':d<-.5?'dn':''}" title="Asking price compared with value">${d>0?'+':''}${d.toFixed(0)}%</span></div>
  <div class="seller">${avatar(l.seller,18)}<span>${l.mine?'Your listing':esc(l.seller.name)}</span><span style="margin-left:auto">${ago(l.t)}</span></div>
  ${l.mine?`<button class="cta ghost sm" data-unlist="${l.id}" style="width:100%">Cancel listing</button>`:`<button class="cta sm" data-buy="${l.id}" style="width:100%">Buy</button>`}</div>`;
}
function buyListing(id){
  const l=MK.list.find(x=>x.id===id);if(!l){toast('Someone else bought that one first.');return false}
  if(!take(l.price))return false;
  MK.list.splice(MK.list.indexOf(l),1);const it=addItem(l.item,'Marketplace');if(l.s)it.s=l.s;save();
  MK.sales.unshift({item:l.item,price:l.price,buyer:me(),t:Date.now(),mine:1});
  toast(`Bought ${ITEM[l.item].n} for ${fmt(l.price)}`,'win',l.item);return true;
}
function openItem(id){
  const it=ITEM[id],h=priceHist(id),ls=MK.list.filter(l=>l.item===id).sort((a,b)=>a.price-b.price),sl=MK.sales.filter(s=>s.item===id);
  const m=modal(`<div class="mk-detail"><div>${itemCard(id)}</div><div class="mstack" style="min-width:0">
    <div><h3 style="margin:0">${esc(it.n)}</h3><span class="rar r-${it.r}" style="font-size:12.5px">${RAR[it.r]}</span></div>
    <div class="stats3"><div class="stat"><span>Value</span><b>${chip(14)}${fmt(it.v)}</b></div><div class="stat"><span>Lowest listing</span><b>${ls.length?chip(14)+fmt(ls[0].price):'—'}</b></div><div class="stat"><span>Listings</span><b>${ls.length}</b></div></div>
    <div><div class="kv" style="margin-bottom:6px"><span>Sale prices, last 30 days</span><b>${fmt(Math.min(...h))} – ${fmt(Math.max(...h))}</b></div>${sparkSVG(h,'chart')}</div>
  </div></div>
  <h4 style="margin:18px 0 8px">Listings</h4><div class="mstack" style="gap:6px">${ls.length?ls.slice(0,6).map(l=>`<div class="pos">${avatar(l.seller,22)}<span class="q">${l.mine?'Your listing':esc(l.seller.name)}${l.s?` · #${l.s}`:''}</span><b>${chip(13)} ${fmt(l.price)}</b>${l.mine?'':`<button class="cta sm" data-buy="${l.id}">Buy</button>`}</div>`).join(''):'<p class="note">Nobody is selling this right now.</p>'}</div>
  ${sl.length?`<h4 style="margin:18px 0 8px">Recent sales</h4><div class="sales">${sl.slice(0,6).map(s=>`<div class="pos">${avatar(s.buyer,20)}<span class="q">${esc(s.buyer.name)}</span><b>${fmt(s.price)}</b><span class="note">${ago(s.t)}</span></div>`).join('')}</div>`:''}`,{cls:'mid'});
  m.root.addEventListener('click',e=>{const b=e.target.closest('[data-buy]');if(b&&buyListing(b.dataset.buy)){m.close();if(MK.redraw)MK.redraw()}});
}
function openSell(){
  if(!S.user){openLogin();return}
  if(!S.inv.length){toast('Your inventory is empty. Open a case first.');return}
  let sel=null;
  const m=modal(`<h3>List an item</h3><p>Pick an item and set your price. Buyers pay the price you set, and you receive it minus a 5% marketplace fee.</p>
  <div class="igrid sm" id="sg" style="max-height:300px">${S.inv.map(x=>itemCard(x.id,{cls:'pick',attr:`data-su="${x.u}" tabindex="0"`,top:`<span class="ck">${ic('check',12,3)}</span>`})).join('')}</div>
  <div class="mstack" style="margin-top:14px"><label class="fld"><span>Price</span><div class="amt">${chip(16)}<input id="sp" type="number" min="1" step="0.01" placeholder="Pick an item first"></div></label>
  <div class="kv"><span>Value</span><b id="sgp">—</b></div><div class="kv"><span>You receive</span><b class="w" id="snet">—</b></div>
  <button class="cta" id="sl" disabled>List for sale</button></div>`,{cls:'mid'});
  const R=m.root,upd=()=>{const p=+$('#sp',R).value||0;$('#snet',R).textContent=p?fmt(p*.95):'—';$('#sl',R).disabled=!sel||p<1};
  $('#sg',R).onclick=e=>{const c=e.target.closest('[data-su]');if(!c)return;sel=c.dataset.su;$$('[data-su]',R).forEach(x=>x.classList.toggle('sel',x===c));const it=S.inv.find(x=>x.u===sel);$('#sp',R).value=ITEM[it.id].v;$('#sgp',R).textContent=fmt(ITEM[it.id].v);upd()};
  $('#sp',R).oninput=upd;
  $('#sl',R).onclick=()=>{const it=S.inv.find(x=>x.u===sel),p=r2(+$('#sp',R).value);if(!it||!(p>=1))return;
    S.inv=S.inv.filter(x=>x.u!==sel);S.profile.showcase=S.profile.showcase.filter(u=>u!==sel);save();drawInvCount();
    const l=mkListing(it.id,me(),true);l.price=p;l.s=it.s;l.t=Date.now();l.inv=it;MK.list.unshift(l);m.close();toast(`Listed ${ITEM[it.id].n} for ${fmt(p)}`);if(MK.redraw)MK.redraw()};
}
PAGES.market=(el,openId)=>{
  let tab='browse',q='',rar='all',sort='new';
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Marketplace</div><h2>Marketplace</h2><p>Buy items other players are selling, or list your own at your price. Everything trades in Rodux. Items are worth their value. The percentage on each listing shows how far the asking price is above or below that value.</p></div><div class="tools"><button class="cta inline" id="sell">${ic('tag',17)} List an item</button></div></div>
  <div class="tools" style="justify-content:space-between;margin-bottom:12px"><div class="tabs" id="mt"><button data-t="browse" class="on">Browse</button><button data-t="mine">My listings</button><button data-t="sales">Recent sales</button></div>
  <div class="tools"><label class="search">${ic('search',16)}<input id="mq" placeholder="Search items" aria-label="Search items"></label><select class="sel" id="mr" aria-label="Rarity"><option value="all">All rarities</option>${Object.entries(RAR).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><select class="sel" id="ms" aria-label="Sort"><option value="new">Newest</option><option value="lo">Price: low to high</option><option value="hi">Price: high to low</option><option value="deal">Best deals</option></select></div></div>
  <div id="mb"></div>`;
  function draw(){
    const b=$('#mb');if(!b)return;
    if(tab==='sales'){b.innerHTML=`<div class="card"><div class="mstack" style="gap:6px">${MK.sales.slice(0,30).map(s=>`<div class="pos"><span class="mini r-${ITEM[s.item].r}">${itemSvg(s.item)}${esc(ITEM[s.item].n)}</span><span class="q" style="text-align:right;color:var(--muted)">${s.mine&&s.buyer.me?'You bought':s.mine?'You sold':'Bought by '+esc(s.buyer.name)}</span><b>${chip(13)} ${fmt(s.price)}</b><span class="note" style="width:60px;text-align:right">${ago(s.t)}</span></div>`).join('')}</div></div>`;return}
    let list=MK.list.filter(l=>(tab==='mine'?l.mine:true)&&(rar==='all'||ITEM[l.item].r===rar)&&ITEM[l.item].n.toLowerCase().includes(q));
    list=[...list].sort(sort==='lo'?(a,b)=>a.price-b.price:sort==='hi'?(a,b)=>b.price-a.price:sort==='deal'?(a,b)=>a.price/ITEM[a.item].v-b.price/ITEM[b.item].v:(a,b)=>b.t-a.t);
    b.innerHTML=list.length?`<div class="mk-grid">${list.slice(0,60).map(lstCard).join('')}</div>`:`<div class="empty"><h3>${tab==='mine'?'You have nothing listed':'No listings match'}</h3><p>${tab==='mine'?'List an item and other players can buy it with Rodux.':'Try a different search or rarity.'}</p>${tab==='mine'?'<button class="cta inline" data-sellopen>List an item</button>':''}</div>`;
  }
  MK.redraw=draw;
  el.addEventListener('click',e=>{
    const b=e.target.closest('[data-buy]');if(b){if(buyListing(b.dataset.buy))draw();return}
    const u=e.target.closest('[data-unlist]');if(u){const l=MK.list.find(x=>x.id===u.dataset.unlist);if(l){MK.list.splice(MK.list.indexOf(l),1);S.inv.unshift(l.inv||{u:uid(),id:l.item,s:l.s,t:Date.now()});save();drawInvCount();toast('Listing cancelled. The item is back in your inventory.')}draw();return}
    if(e.target.closest('[data-sellopen]')){openSell();return}
    const it=e.target.closest('[data-item]');if(it)openItem(it.dataset.item);
  });
  $$('#mt button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;$$('#mt button').forEach(x=>x.classList.toggle('on',x===b));draw()});
  $('#mq').oninput=e=>{q=e.target.value.trim().toLowerCase();draw()};$('#mr').onchange=e=>{rar=e.target.value;draw()};$('#ms').onchange=e=>{sort=e.target.value;draw()};
  $('#sell').onclick=openSell;
  draw();if(openId&&ITEM[openId])openItem(openId);
  cleanup=()=>{MK.redraw=null};
};

/* ---------- predictions ---------- */
const PX={BTC:{p:100000,h:[]},ETH:{p:3600,h:[]},SOL:{p:180,h:[]}};
Object.values(PX).forEach(c=>{for(let i=0;i<60;i++){c.p*=1+(rnd()-.5)*.003;c.h.push(c.p)}});
setInterval(()=>Object.values(PX).forEach(c=>{c.p*=1+(rnd()-.498)*.0025;c.h.push(c.p);if(c.h.length>60)c.h.shift()}),1000);
const PR={list:[],mine:[]};
const PCAT={football:'Football',crypto:'Crypto',esports:'Esports',empire:'Trade Empire',community:'Community'};
function mkMarket(cat,q,opts,mins,o={}){
  const vol=o.vol??ri(800,24000),m={id:uid(),cat,q,opts:opts.map(([l,p])=>({l,p,pool:0})),closes:Date.now()+mins*6e4,status:'open',win:null,creator:o.creator||null,coin:o.coin,line:o.line,dir:o.dir};
  m.opts.forEach(x=>x.pool=r2(vol*x.p*(.8+rnd()*.4)+5));return m;
}
function seedPredictions(){
  const L=PR.list;
  L.push(mkMarket('football','Arsenal vs Chelsea · Who wins?',[['Arsenal',.46],['Draw',.26],['Chelsea',.28]],ri(6,14)));
  L.push(mkMarket('football','Real Madrid vs Barcelona · Who wins?',[['Real Madrid',.41],['Draw',.24],['Barcelona',.35]],ri(20,40)));
  L.push(mkMarket('football','Ajax vs PSV · Over or under 2.5 goals?',[['Over 2.5',.58],['Under 2.5',.42]],ri(9,25)));
  L.push(mkMarket('football','Bayern vs Dortmund · Both teams to score?',[['Yes',.62],['No',.38]],ri(30,90)));
  const btc=Math.round(PX.BTC.p/500)*500,eth=Math.round(PX.ETH.p/10)*10,sol=Math.round(PX.SOL.p);
  L.push(mkMarket('crypto',`Will BTC be above $${fmt0(btc)} at close?`,[['Yes',.5],['No',.5]],ri(4,9),{coin:'BTC',line:btc}));
  L.push(mkMarket('crypto','ETH up or down over the next 10 minutes?',[['Up',.5],['Down',.5]],10,{coin:'ETH',line:PX.ETH.p,dir:1}));
  L.push(mkMarket('crypto',`Will SOL be above $${sol} at close?`,[['Yes',.5],['No',.5]],ri(12,30),{coin:'SOL',line:sol}));
  L.push(mkMarket('esports','NAVI vs FaZe · Map 1 winner',[['NAVI',.52],['FaZe',.48]],ri(5,15)));
  L.push(mkMarket('esports','T1 vs Gen.G · Series winner',[['T1',.55],['Gen.G',.45]],ri(40,120)));
  L.push(mkMarket('empire','Most opened case on TradeBlacket today?',[['Starter Crate',.5],['Street Drop',.3],["Trader's Vault",.2]],ri(60,300)));
  L.push(mkMarket('empire','Will an Empire Crown sell on the Marketplace today?',[['Yes',.35],['No',.65]],ri(120,600)));
  L.push(mkMarket('community','Will someone hit 100× or more on Crash in the next 15 minutes?',[['Yes',.3],['No',.7]],15,{creator:bot('rook_sprint')}));
  L.push(mkMarket('community','Royal Treasury battle tonight: who takes it?',[['LunaTrades',.5],['PixelMarlin',.5]],ri(30,80),{creator:bot('VaultVibes')}));
}
seedPredictions();
const mult=(m,i,add=0)=>{const tot=m.opts.reduce((a,o)=>a+o.pool,0)+add,pi=m.opts[i].pool+add;return pi?tot*.95/pi:0};
const share=(m,i)=>{const tot=m.opts.reduce((a,o)=>a+o.pool,0);return tot?m.opts[i].pool/tot:0};
function resolveMarket(m,wi){
  if(m.status==='resolved')return;
  if(wi==null){
    if(m.coin){const p=PX[m.coin].p;wi=m.dir?(p>=m.line?0:1):(p>m.line?0:1)}
    else{let r=rnd();wi=m.opts.length-1;for(let i=0;i<m.opts.length;i++){if((r-=m.opts[i].p)<0){wi=i;break}}}
  }
  m.status='resolved';m.win=wi;m.resolvedAt=Date.now();
  const k=mult(m,wi);
  PR.mine.filter(x=>x.mid===m.id&&!x.done).forEach(x=>{x.done=1;const p=x.oi===wi?r2(x.amt*k):0;x.payout=p;pay(p);settle('predictions',x.amt,p?r2(k):0,p,{quiet:true});
    toast(p?`Prediction won: ${m.opts[wi].l}. +${fmt(p-x.amt)} Rodux`:`Prediction lost: ${esc(m.q)}`,p?'win':'loss')});
}
setInterval(()=>{
  const now=Date.now();let ch=false;
  PR.list.forEach(m=>{
    if(m.status==='open'){
      if(now>=m.closes){m.status='closed';m.closedAt=now;ch=true}
      else if(rnd()<.35){const i=m.coin?(rnd()<.5?0:1):(()=>{let r=rnd();for(let k=0;k<m.opts.length;k++)if((r-=m.opts[k].p)<0)return k;return 0})();m.opts[i].pool=r2(m.opts[i].pool+pick([5,10,25,50,100,250]));ch=true}
    }else if(m.status==='closed'&&!(m.creator&&m.creator.me)&&now-m.closedAt>6000){resolveMarket(m);ch=true}
    else if(m.status==='resolved'&&now-m.resolvedAt>90000&&!PR.mine.some(x=>x.mid===m.id)){m.gone=1;ch=true}
  });
  if(PR.list.some(m=>m.gone)){
    const gone=PR.list.filter(m=>m.gone);PR.list=PR.list.filter(m=>!m.gone);
    gone.forEach(g=>{const re=g.coin?(g.dir?mkMarket('crypto',`${g.coin} up or down over the next 10 minutes?`,[['Up',.5],['Down',.5]],10,{coin:g.coin,line:PX[g.coin].p,dir:1}):mkMarket('crypto',`Will ${g.coin} be above $${fmt0(Math.round(PX[g.coin].p/(g.coin==='BTC'?500:g.coin==='ETH'?10:1))*(g.coin==='BTC'?500:g.coin==='ETH'?10:1))} at close?`,[['Yes',.5],['No',.5]],ri(5,12),{coin:g.coin,line:Math.round(PX[g.coin].p/(g.coin==='BTC'?500:g.coin==='ETH'?10:1))*(g.coin==='BTC'?500:g.coin==='ETH'?10:1)})):null;if(re)PR.list.unshift(re)});
  }
  if(ch&&PR.redraw)PR.redraw();else if(PR.tick)PR.tick();
},1000);
const left=ms=>{if(ms<=0)return'Closed';const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}h ${m}m`:`${m}:${String(x).padStart(2,'0')}`};
function pmCard(m){
  const myPos=PR.mine.filter(x=>x.mid===m.id),open=m.status==='open';
  return `<article class="pm" data-m="${m.id}">
    <div class="pm-h"><span class="tag ${m.cat==='crypto'?'y':m.cat==='football'?'g':m.cat==='community'?'b':''}">${PCAT[m.cat]}</span>${m.status==='resolved'?'<span class="tag">Settled</span>':m.status==='closed'?'<span class="tag r">Closed</span>':''}<span class="cl" data-cl="${m.id}">${ic('trend',13,2)}${open?left(m.closes-Date.now()):m.status==='closed'?(m.creator&&m.creator.me?'Waiting for you':'Settling…'):'Settled'}</span></div>
    <h4>${esc(m.q)}</h4>
    ${m.coin?`<div class="kv"><span>${m.coin} · simulated feed</span><b data-px="${m.coin}">$${fmt(PX[m.coin].p)}</b></div>${sparkSVG(PX[m.coin].h,'spark',PX[m.coin].p>(m.line||0)?'var(--win)':'var(--loss)')}`:''}
    <div class="pm-opts">${m.opts.map((o,i)=>`<button class="opt${myPos.some(x=>x.oi===i)?' mine':''}${m.win===i?' won':''}" style="--p:${(share(m,i)*100).toFixed(1)}%" ${open?`data-pick="${m.id}:${i}"`:'disabled'}><span>${esc(o.l)}</span><b>${(share(m,i)*100).toFixed(0)}% <small>${mult(m,i).toFixed(2)}×</small></b></button>`).join('')}</div>
    ${m.status==='closed'&&m.creator&&m.creator.me?`<div class="mstack" style="gap:6px"><span class="note">You created this market. Pick the result to settle it.</span><div style="display:flex;gap:6px;flex-wrap:wrap">${m.opts.map((o,i)=>`<button class="cta ghost sm" data-res="${m.id}:${i}">${esc(o.l)}</button>`).join('')}</div></div>`:''}
    <div class="pm-f"><span>Pool <b>${fmt0(m.opts.reduce((a,o)=>a+o.pool,0))}</b></span>${m.creator?`<span data-user="${esc(m.creator.name)}" style="cursor:pointer;display:flex;gap:6px;align-items:center">${avatar(m.creator,16)}${esc(m.creator.name)}</span>`:''}${myPos.length?`<span style="color:var(--gold)">Your stake ${fmt(myPos.reduce((a,x)=>a+x.amt,0))}</span>`:''}</div>
  </article>`;
}
function openPick(mid,oi){
  if(!S.user){openLogin();return}
  const m=PR.list.find(x=>x.id===mid);if(!m||m.status!=='open')return;
  const md=modal(`<h3>${esc(m.q)}</h3><p>You're backing <b style="color:var(--fg)">${esc(m.opts[oi].l)}</b>. Winners split the whole pool in proportion to their stake, minus a 5% fee, so the payout moves as people join.</p>
  <div class="mstack"><label class="fld"><span>Stake</span>${miniAmt('pa')}</label><div class="kv"><span>Payout if it wins, right now</span><b class="w" id="pp"></b></div><button class="cta" id="pg">Place prediction</button></div>`);
  const R=md.root;wireBet(R);const up=()=>{const a=Math.floor(+$('#pa',R).value||0);$('#pp',R).textContent=a?`${fmt(a*mult(m,oi,a))} (${mult(m,oi,a).toFixed(2)}×)`:'—'};$('#pa',R).oninput=up;up();
  $('#pg',R).onclick=()=>{const a=getBet('pa');if(m.status!=='open'){toast('This market just closed.');md.close();return}if(!take(a))return;m.opts[oi].pool=r2(m.opts[oi].pool+a);PR.mine.push({mid,oi,amt:a,t:Date.now()});md.close();toast(`Prediction placed on ${m.opts[oi].l}`,'gold');if(PR.redraw)PR.redraw()};
}
function openCreatePred(){
  if(!S.user){openLogin();return}
  const md=modal(`<h3>Create a prediction</h3><p>Ask a yes-or-no or multiple-choice question. Anyone can stake on it until it closes, then you pick the result.</p>
  <form class="mstack" id="cpf"><label class="fld"><span>Question</span><input class="txt" id="cq" maxlength="110" placeholder="Will LunaTrades win the Royal battle tonight?"></label>
  <div class="fld"><span>Options</span><div class="mstack" style="gap:6px" id="cops"><input class="txt" maxlength="30" value="Yes"><input class="txt" maxlength="30" value="No"></div><button type="button" class="more" id="addo" style="align-self:flex-start">Add option</button></div>
  <div class="fld"><span>Closes in</span>${seg('cdur',[[10,'10 min'],[60,'1 hour'],[1440,'24 hours']],60)}</div>
  <div class="err" id="cerr"></div><button class="cta">Publish prediction</button></form>`);
  const R=md.root;let dur=60;wireSeg($('#cdur',R),v=>dur=+v);
  $('#addo',R).onclick=()=>{const c=$('#cops',R);if(c.children.length>=4)return;c.insertAdjacentHTML('beforeend','<input class="txt" maxlength="30" placeholder="Another option">')};
  $('#cpf',R).onsubmit=e=>{e.preventDefault();const q=$('#cq',R).value.trim(),ops=$$('#cops input',R).map(i=>i.value.trim()).filter(Boolean);
    if(q.length<8){$('#cerr',R).textContent='Write a question of at least 8 characters.';return}
    if(ops.length<2||new Set(ops).size!==ops.length){$('#cerr',R).textContent='Give at least two different options.';return}
    const m=mkMarket('community',q,ops.map(l=>[l,1/ops.length]),dur,{creator:me(),vol:0});m.opts.forEach(o=>o.pool=0);PR.list.unshift(m);md.close();toast('Prediction published','gold');pTab='community';if(PR.redraw)PR.redraw()};
}
let pTab='all';
PAGES.predictions=el=>{
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Predictions</div><h2>Predictions</h2><p>Stake Rodux on how things turn out. Odds come from the pool, so the payout shifts as other players pick sides. Anyone can open a community market.</p></div><div class="tools"><button class="cta inline" id="mkp">${ic('plus',17,2.2)} Create prediction</button></div></div>
  <div class="card" style="margin-bottom:12px;padding:10px 14px"><p class="note" style="color:var(--muted)">Demo markets: football and esports results here are simulated, and crypto prices come from a simulated feed. The live site would settle these from real results.</p></div>
  <div class="tools" style="justify-content:space-between;margin-bottom:12px"><div class="tabs" id="pt">${[['all','All'],...Object.entries(PCAT),['mine','My predictions']].map(([k,l])=>`<button data-t="${k}" class="${pTab===k?'on':''}">${l}</button>`).join('')}</div></div>
  <div id="pb"></div>`;
  function draw(){
    const b=$('#pb');if(!b)return;
    if(pTab==='mine'){
      const rows=PR.mine.slice().reverse();
      b.innerHTML=rows.length?`<div class="card"><div class="mstack" style="gap:6px">${rows.map(x=>{const m=PR.list.find(y=>y.id===x.mid)||{q:'Settled market',opts:[{l:'—'}],status:'resolved'};const o=m.opts[x.oi]||{l:'—'};return `<div class="pos"><span class="q">${esc(m.q)}</span><span class="tag">${esc(o.l)}</span><b>${fmt(x.amt)}</b>${x.done?`<b style="color:${x.payout?'var(--win)':'var(--loss)'}">${x.payout?'+'+fmt(x.payout):'Lost'}</b>`:`<span class="note">${m.status==='open'?'Open':'Settling'}</span>`}</div>`}).join('')}</div></div>`:`<div class="empty"><h3>No predictions yet</h3><p>Pick a side on any open market to see it here.</p></div>`;
      return;
    }
    const list=PR.list.filter(m=>pTab==='all'||m.cat===pTab).sort((a,b)=>(a.status==='open'?0:1)-(b.status==='open'?0:1)||a.closes-b.closes);
    b.innerHTML=list.length?`<div class="pm-grid">${list.map(pmCard).join('')}</div>`:`<div class="empty"><h3>No markets here yet</h3><p>Create one and let people stake on it.</p></div>`;
  }
  PR.redraw=draw;
  PR.tick=()=>{$$('[data-cl]').forEach(e=>{const m=PR.list.find(x=>x.id===e.dataset.cl);if(m&&m.status==='open')e.innerHTML=ic('trend',13,2)+left(m.closes-Date.now())});$$('[data-px]').forEach(e=>{e.textContent='$'+fmt(PX[e.dataset.px].p)})};
  el.addEventListener('click',e=>{
    const p=e.target.closest('[data-pick]');if(p){const[m,i]=p.dataset.pick.split(':');openPick(m,+i);return}
    const r=e.target.closest('[data-res]');if(r){const[mid,i]=r.dataset.res.split(':');const m=PR.list.find(x=>x.id===mid);if(m){resolveMarket(m,+i);toast(`Settled: ${m.opts[+i].l}`,'gold');draw()}}
  });
  $$('#pt button').forEach(b=>b.onclick=()=>{pTab=b.dataset.t;$$('#pt button').forEach(x=>x.classList.toggle('on',x===b));draw()});
  $('#mkp').onclick=openCreatePred;
  draw();
  cleanup=()=>{PR.redraw=null;PR.tick=null};
};

/* ---------- news ---------- */
const NEWS=[
  {id:'stocks',tag:'New',date:'Oct 14, 2026',t:'Stocks are open for trading',art:'gchain',bg:'linear-gradient(135deg,#0F3424,#2B7A52)',
   s:'Buy and sell shares in eight fictional Trade Empire companies. Prices move every second and react to company news.',
   b:['The Stocks page lists eight companies, from steady Crown Logistics to the much jumpier Boombox Media. Each has a live candle chart you can view at 10-second, 1-minute or 5-minute intervals.','Company news lands at random and can move a price by several percent in one go. Buying and selling each costs a 0.5% fee, and your portfolio shows your average cost and profit or loss on every position.']},
  {id:'bj-tables',tag:'Update',date:'Oct 14, 2026',t:'Blackjack tables now seat five',art:'mcrown',bg:'linear-gradient(135deg,#0E3A33,#14504A)',
   s:'Blackjack is now a shared table. Sit next to other players, bet on the same timer, and watch the spotlight move seat to seat.',
   b:['Blackjack has moved from a solo game to shared tables with five seats. Every round starts with a short betting window. When it closes, cards go out to everyone at once and each seat plays in turn.','You get 15 seconds to act on your turn. If the timer runs out, your hand stands automatically. Doubling is available on your first two cards, and the dealer stands on all 17s.','If you leave mid-round, your hand still plays out and pays as normal.']},
  {id:'predictions',tag:'New',date:'Oct 13, 2026',t:'Predictions are live',art:'gchain',bg:'linear-gradient(135deg,#123A6B,#1F6FD1)',
   s:'Call football results, crypto price moves and community questions. Payouts come from the pool, so the odds shift as players pick sides.',
   b:['Predictions let you stake Rodux on how something turns out. Each market has two to four options. The percentage next to an option shows how much of the pool backs it, and the multiplier shows what a winning stake pays right now.','Anyone can open a community market. You write the question, pick when it closes, and choose the result once it does. Markets are settled from the pool, minus a 5% fee.']},
  {id:'slots',tag:'New',date:'Oct 12, 2026',t:'Three new slots on one engine',art:'shalo',bg:'linear-gradient(135deg,#3A1650,#7A2E8E)',
   s:'Vault Breaker, Neon Fruits and Empire Crown all run on a 243-ways engine with free spins.',
   b:['Every machine pays left to right on adjacent reels, with 243 ways to win per spin. Wilds land on reels two to four. Three or more scatters anywhere start free spins, and wins during free spins are doubled.','All three share the same math, which we tested over millions of simulated spins. Turbo mode and autoplay are in the control bar.']},
  {id:'market',tag:'Feature',date:'Oct 10, 2026',t:'The Marketplace is open',art:'apup',bg:'linear-gradient(135deg,#0F3D33,#1FCB6B)',
   s:'List items at your own price and buy from other players. Each listing shows how its price compares with the guide price.',
   b:['Pick an item from your inventory, set a price, and it goes on the Marketplace. When it sells, you receive the price minus a 5% fee.','Every item page shows a 30-day price history, the cheapest current listings and recent sales, so you can see whether a price is fair before you buy.']},
  {id:'battle-pay',tag:'Change',date:'Oct 9, 2026',t:'Battle winnings now go straight to your balance',art:'eblade',bg:'linear-gradient(135deg,#4A1520,#B4283F)',
   s:'No more selling battle drops one by one. The value of everything you win is added to your balance as soon as the battle ends.',
   b:['When a case battle ends, the full value of the drops you won is added to your Rodux balance right away. Shared battles split the pot evenly, and Crazy battles still go to the lowest total.']},
  {id:'rodux',tag:'Guide',date:'Oct 1, 2026',t:'How Rodux works on TradeBlacket',art:'tshade',bg:'linear-gradient(135deg,#2A3B4C,#3D5266)',
   s:'Where your balance comes from, and what bonus Rodux means.',
   b:['Your balance is Rodux. You bring it in from Trade Empire with a deposit, and you can also earn bonus Rodux from the daily claim, missions, level-ups and promo codes.','Bonus Rodux has to be wagered once before it can be withdrawn. Rodux you deposit can be withdrawn at any time.']}
];
const newsCover=n=>`<div class="cover" style="background:${n.bg}">${itemSvg(n.art)}</div>`;
PAGES.news=el=>{
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / News</div><h2>News</h2><p>Updates, new games and changes to how things work.</p></div></div>
  <div class="news-grid">${NEWS.map((n,i)=>`<button class="post${i===0?' lead':''}" data-go="article" data-p="${n.id}">${newsCover(n)}<div class="body"><div class="meta"><span class="tag ${n.tag==='New'?'g':n.tag==='Change'?'r':'b'}">${n.tag}</span>${n.date}</div><h3>${esc(n.t)}</h3><p>${esc(n.s)}</p></div></button>`).join('')}</div>`;
};
PAGES.article=(el,id)=>{
  const n=NEWS.find(x=>x.id===id)||NEWS[0];
  el.innerHTML=`<button class="back" data-go="news">${ic('back',16)} News</button><article class="article"><div class="meta" style="display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--dim)"><span class="tag b">${n.tag}</span>${n.date}</div><h2 style="font-size:28px;margin:10px 0 0;letter-spacing:-.015em">${esc(n.t)}</h2>${newsCover(n)}${n.b.map(p=>`<p>${esc(p)}</p>`).join('')}</article>
  <div class="sec-h"><h3 class="sec">More news</h3></div><div class="news-grid">${NEWS.filter(x=>x!==n).slice(0,3).map(x=>`<button class="post" data-go="article" data-p="${x.id}">${newsCover(x)}<div class="body"><div class="meta">${x.date}</div><h3>${esc(x.t)}</h3></div></button>`).join('')}</div>`;
};
