'use strict';
/* =========================================================
   Stocks — a simulated market of fictional companies
   ========================================================= */
const STK={
  list:[
    ['EMPR','Empire Holdings',142,.012,'#F2B33D'],['VLT','Vault & Co',58,.016,'#3D8BFD'],['NEON','Neon Fruits',23,.028,'#B42F8C'],
    ['CRWN','Crown Logistics',211,.009,'#A26BFA'],['PXL','Pixel Labs',37,.024,'#1FCB6B'],['BOOM','Boombox Media',12,.035,'#F04D5E'],
    ['RVN','Raven Air',88,.018,'#5FB4F2'],['MINT','Mint Condition',64,.014,'#38DB82']
  ].map(([t,n,p,v,c])=>({t,n,p,v,c,open:p,c10:[],ticks:[]})),
  fee:.005,news:[],CANDLE:10
};
const STKMAP=Object.fromEntries(STK.list.map(s=>[s.t,s]));
(function seedStocks(){
  const saved=store.get('stk',null);
  STK.list.forEach(s=>{
    if(saved&&saved[s.t])s.p=saved[s.t];
    let p=s.p;for(let i=0;i<120;i++){const o=p,hi=[o],k=10;for(let j=0;j<k;j++){p*=Math.exp((rnd()-.5)*s.v*.45);hi.push(p)}s.c10.push({o,c:p,h:Math.max(...hi),l:Math.min(...hi)})}
    const drift=s.p/p;s.c10.forEach(c=>{c.o*=drift;c.c*=drift;c.h*=drift;c.l*=drift});s.p=s.c10[s.c10.length-1].c;s.open=s.c10[0].o;
    s.cur={o:s.p,c:s.p,h:s.p,l:s.p,n:0};
  });
})();
const HEAD=[['beats earnings expectations',.06,.12],['announces a new partnership',.03,.08],['opens a second headquarters',.02,.05],['CEO steps down unexpectedly',-.1,-.04],['misses quarterly targets',-.09,-.03],['faces a supply delay',-.06,-.02],['launches a new product line',.03,.09],['gets a rating upgrade',.02,.05],['gets a rating downgrade',-.05,-.02]];
setInterval(()=>{
  STK.list.forEach(s=>{
    s.p=Math.max(.5,s.p*Math.exp((rnd()-.5)*s.v*.45));
    const c=s.cur;c.c=s.p;c.h=Math.max(c.h,s.p);c.l=Math.min(c.l,s.p);c.n++;
    if(c.n>=STK.CANDLE){s.c10.push({o:c.o,c:c.c,h:c.h,l:c.l});if(s.c10.length>240)s.c10.shift();s.cur={o:s.p,c:s.p,h:s.p,l:s.p,n:0}}
  });
  if(rnd()<.03){const s=pick(STK.list),[h,a,b]=pick(HEAD),j=a+rnd()*(b-a);s.p=Math.max(.5,s.p*(1+j));s.cur.c=s.p;s.cur.h=Math.max(s.cur.h,s.p);s.cur.l=Math.min(s.cur.l,s.p);STK.news.unshift({t:s.t,txt:`${s.n} ${h}`,j,at:Date.now()});STK.news.length=Math.min(STK.news.length,20);if(STK.onNews)STK.onNews()}
  if(STK.onTick)STK.onTick();
  if(rnd()<.1)store.set('stk',Object.fromEntries(STK.list.map(s=>[s.t,s.p])));
},1000);
const port=()=>{S.port=S.port||{};return S.port};
const posVal=()=>Object.entries(port()).reduce((a,[t,p])=>a+(STKMAP[t]?p.sh*STKMAP[t].p:0),0);
const pct=(a,b)=>(a-b)/b*100;
PAGES.stocks=(el,sel)=>{
  let cur=STKMAP[sel]?sel:store.get('stkSel','EMPR'),side='buy',tf=1;
  el.innerHTML=`<div class="ghead"><div><div class="crumb"><button data-go="home">Home</button> / Stocks</div><h2>Stocks</h2><p>Buy and sell shares in fictional Trade Empire companies with Rodux. Prices move every second and react to company news. Each trade has a 0.5% fee.</p></div><span class="rtp">${ic('shield',14,2)} Simulated market</span></div>
  <div class="stk">
    <aside class="stk-list card" id="sl"></aside>
    <section class="stk-main">
      <div class="card stk-chart">
        <div class="stk-h"><div><b id="sn"></b><span id="st" class="tag"></span></div><div class="stk-px"><b id="sp"></b><span id="sc"></span></div>
          <div class="tabs" id="tf"><button data-f="1" class="on">10s</button><button data-f="6">1m</button><button data-f="30">5m</button></div></div>
        <canvas id="cv"></canvas>
        <div class="stk-stats" id="ss"></div>
      </div>
      <div class="stk-row">
        <section class="card"><h3 class="sec" style="margin-bottom:10px">Your portfolio</h3><div id="pf"></div></section>
        <section class="card"><h3 class="sec" style="margin-bottom:10px">Market news</h3><div class="stk-news" id="nw"></div></section>
      </div>
    </section>
    <aside class="card stk-order">
      <div class="seg" id="sd"><button data-v="buy" class="on">Buy</button><button data-v="sell">Sell</button></div>
      <label class="fld"><span id="al">Amount to invest</span><div class="amt">${chip(16)}<input id="sa" type="number" min="1" step="1" value="${S.lastBet}" aria-label="Amount"><button type="button" data-q=".25">25%</button><button type="button" data-q=".5">50%</button><button type="button" data-q="1">Max</button></div></label>
      <div class="kv"><span>Price per share</span><b id="op"></b></div>
      <div class="kv"><span id="oql">Shares</span><b id="oq"></b></div>
      <div class="kv"><span>Fee (0.5%)</span><b id="of"></b></div>
      <button class="cta" id="go">Buy</button>
      <hr style="border:0;border-top:1px solid var(--line);margin:4px 0">
      <div class="kv"><span>You own</span><b id="ys"></b></div>
      <div class="kv"><span>Average cost</span><b id="ya"></b></div>
      <div class="kv"><span>Position value</span><b id="yv"></b></div>
      <div class="kv"><span>Profit / loss</span><b id="yp"></b></div>
    </aside>
  </div>`;
  const cv=$('#cv'),ctx=cv.getContext('2d');let W=0,H=0;
  const size=()=>{const r=cv.getBoundingClientRect(),d=devicePixelRatio||1;W=r.width;H=r.height;cv.width=W*d;cv.height=H*d;ctx.setTransform(d,0,0,d,0,0)};
  size();const ro=new ResizeObserver(()=>{size();chart()});ro.observe(cv);
  const C={win:css('--win'),loss:css('--loss'),line:css('--line'),dim:css('--dim'),fg:css('--fg'),blue:css('--blue')};
  function candles(s){
    const all=[...s.c10,{...s.cur}];if(tf===1)return all.slice(-70);
    const out=[];for(let i=Math.max(0,all.length-70*tf);i<all.length;i+=tf){const g=all.slice(i,i+tf);out.push({o:g[0].o,c:g[g.length-1].c,h:Math.max(...g.map(x=>x.h)),l:Math.min(...g.map(x=>x.l))})}return out.slice(-70);
  }
  function chart(){
    const s=STKMAP[cur],cs=candles(s);ctx.clearRect(0,0,W,H);if(!cs.length)return;
    const pad={l:8,r:58,t:12,b:18},hi=Math.max(...cs.map(c=>c.h)),lo=Math.min(...cs.map(c=>c.l)),rg=(hi-lo)||1;
    const Y=v=>pad.t+(hi-v)/rg*(H-pad.t-pad.b),cw=(W-pad.l-pad.r)/70;
    ctx.font='500 11px Rubik,system-ui';ctx.textAlign='left';ctx.textBaseline='middle';
    for(let i=0;i<=4;i++){const v=lo+rg*i/4,y=Y(v);ctx.strokeStyle=C.line;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();ctx.fillStyle=C.dim;ctx.fillText(v.toFixed(2),W-pad.r+8,y)}
    cs.forEach((c,i)=>{const x=pad.l+(i+.5)*cw+(70-cs.length)*cw,up=c.c>=c.o;ctx.strokeStyle=ctx.fillStyle=up?C.win:C.loss;ctx.beginPath();ctx.moveTo(x,Y(c.h));ctx.lineTo(x,Y(c.l));ctx.stroke();const y1=Y(Math.max(c.o,c.c)),y2=Y(Math.min(c.o,c.c));ctx.fillRect(x-cw*.32,y1,cw*.64,Math.max(1.5,y2-y1))});
    const py=Y(s.p);ctx.setLineDash([3,3]);ctx.strokeStyle=C.blue;ctx.beginPath();ctx.moveTo(pad.l,py);ctx.lineTo(W-pad.r,py);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=C.blue;ctx.fillRect(W-pad.r+2,py-10,pad.r-4,20);ctx.fillStyle='#fff';ctx.fillText(s.p.toFixed(2),W-pad.r+8,py);
    const p=port()[cur];if(p&&p.sh>0){const ay=Y(p.cost/p.sh);if(ay>pad.t&&ay<H-pad.b){ctx.setLineDash([6,4]);ctx.strokeStyle=css('--gold');ctx.beginPath();ctx.moveTo(pad.l,ay);ctx.lineTo(W-pad.r,ay);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=css('--gold');ctx.fillText('Your avg',pad.l+4,ay-9)}}
  }
  function list(){
    $('#sl').innerHTML=STK.list.map(s=>{const ch=pct(s.p,s.open);return `<button class="stk-it${s.t===cur?' on':''}" data-t="${s.t}"><span class="stk-tk" style="background:${s.c}22;color:${s.c}">${s.t}</span><span class="stk-nm"><b>${s.n}</b><small>${fmt(s.p)}</small></span>${sparkSVG(s.c10.slice(-30).map(c=>c.c),'stk-sp',ch>=0?'var(--win)':'var(--loss)')}<span class="stk-ch ${ch>=0?'up':'dn'}">${ch>=0?'+':''}${ch.toFixed(2)}%</span></button>`}).join('');
  }
  function head(){
    const s=STKMAP[cur],ch=pct(s.p,s.open),cs=s.c10;
    $('#sn').textContent=s.n;$('#st').textContent=s.t;$('#sp').textContent=fmt(s.p);
    const e=$('#sc');e.textContent=`${ch>=0?'+':''}${fmt(s.p-s.open)} (${ch>=0?'+':''}${ch.toFixed(2)}%)`;e.className=ch>=0?'up':'dn';
    const hi=Math.max(...cs.map(c=>c.h),s.cur.h),lo=Math.min(...cs.map(c=>c.l),s.cur.l);
    $('#ss').innerHTML=[['Open',fmt(s.open)],['High',fmt(hi)],['Low',fmt(lo)],['Volatility',s.v>=.025?'High':s.v>=.015?'Medium':'Low']].map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('');
  }
  function order(){
    const s=STKMAP[cur],p=port()[cur]||{sh:0,cost:0},a=+$('#sa').value||0;
    $('#al').textContent=side==='buy'?'Amount to invest':'Shares to sell';
    $('#op').textContent=fmt(s.p);
    if(side==='buy'){const fee=a*STK.fee,sh=(a-fee)/s.p;$('#oql').textContent='Shares you get';$('#oq').textContent=sh>0?sh.toFixed(4):'—';$('#of').textContent=fmt(fee);$('#go').textContent=`Buy ${s.t}`;$('#go').className='cta'}
    else{const gross=a*s.p,fee=gross*STK.fee;$('#oql').textContent='You receive';$('#oq').textContent=a>0?fmt(gross-fee):'—';$('#of').textContent=fmt(fee);$('#go').textContent=`Sell ${s.t}`;$('#go').className='cta red'}
    $('#ys').textContent=p.sh?p.sh.toFixed(4)+' shares':'None';$('#ya').textContent=p.sh?fmt(p.cost/p.sh):'—';$('#yv').textContent=p.sh?fmt(p.sh*s.p):'—';
    const pl=p.sh*s.p-p.cost,y=$('#yp');y.textContent=p.sh?`${pl>=0?'+':''}${fmt(pl)} (${(pl/p.cost*100).toFixed(2)}%)`:'—';y.style.color=!p.sh?'':pl>=0?'var(--win)':'var(--loss)';
  }
  function portfolio(){
    const rows=Object.entries(port()).filter(([t,p])=>p.sh>1e-9&&STKMAP[t]);
    if(!rows.length){$('#pf').innerHTML='<p class="note">You have no open positions. Pick a company and buy some shares.</p>';return}
    const tv=rows.reduce((a,[t,p])=>a+p.sh*STKMAP[t].p,0),tc=rows.reduce((a,[,p])=>a+p.cost,0);
    $('#pf').innerHTML=`<div class="stk-pt"><div class="hd"><span>Stock</span><span>Shares</span><span>Value</span><span>P/L</span></div>${rows.map(([t,p])=>{const v=p.sh*STKMAP[t].p,pl=v-p.cost;return `<button data-t="${t}"><span><b>${t}</b></span><span>${p.sh.toFixed(3)}</span><span>${fmt(v)}</span><span style="color:${pl>=0?'var(--win)':'var(--loss)'}">${pl>=0?'+':''}${fmt(pl)}</span></button>`}).join('')}<div class="ft"><span>Total</span><span></span><span>${fmt(tv)}</span><span style="color:${tv-tc>=0?'var(--win)':'var(--loss)'}">${tv-tc>=0?'+':''}${fmt(tv-tc)}</span></div></div>`;
  }
  function news(){$('#nw').innerHTML=STK.news.length?STK.news.slice(0,8).map(n=>`<button class="stk-n" data-t="${n.t}"><span class="stk-tk" style="background:${STKMAP[n.t].c}22;color:${STKMAP[n.t].c}">${n.t}</span><span class="q">${esc(n.txt)}</span><b class="${n.j>=0?'up':'dn'}">${n.j>=0?'+':''}${(n.j*100).toFixed(1)}%</b></button>`).join(''):'<p class="note">No headlines yet. Company news moves prices when it lands.</p>'}
  const all=()=>{list();head();chart();order();portfolio()};
  el.addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(b&&!e.target.closest('#sd')){cur=b.dataset.t;store.set('stkSel',cur);all()}});
  wireSeg($('#sd'),v=>{side=v;const p=port()[cur];$('#sa').value=side==='sell'?(p&&p.sh?+p.sh.toFixed(4):0):S.lastBet;order()});
  $$('#tf button').forEach(b=>b.onclick=()=>{tf=+b.dataset.f;$$('#tf button').forEach(x=>x.classList.toggle('on',x===b));chart()});
  $('#sa').oninput=order;
  $$('[data-q]',el).forEach(b=>b.onclick=()=>{const q=+b.dataset.q,p=port()[cur];$('#sa').value=side==='buy'?Math.floor(S.bal*q):p&&p.sh?+(p.sh*q).toFixed(4):0;order()});
  $('#go').onclick=()=>{
    const s=STKMAP[cur],a=+$('#sa').value||0,P=port();
    if(side==='buy'){const amt=Math.floor(a);if(!take(amt))return;const fee=amt*STK.fee,sh=(amt-fee)/s.p;P[cur]=P[cur]||{sh:0,cost:0};P[cur].sh+=sh;P[cur].cost=r2(P[cur].cost+amt);save();toast(`Bought ${sh.toFixed(3)} ${s.t} at ${fmt(s.p)}`,'gold');addFeed({u:me(),game:'stocks',bet:amt,mult:0,payout:0,me:1})}
    else{const p=P[cur];if(!p||p.sh<=0){toast(`You don't own any ${s.t}.`);return}const sh=Math.min(p.sh,a);if(!(sh>0)){toast('Enter how many shares to sell.');return}
      const gross=sh*s.p,net=r2(gross*(1-STK.fee)),basis=r2(p.cost*sh/p.sh);p.cost=r2(p.cost-basis);p.sh-=sh;if(p.sh<1e-6){delete P[cur]}
      pay(net);settle('stocks',basis,basis?r2(net/basis):0,net,{quiet:true});toast(`Sold ${sh.toFixed(3)} ${s.t} for ${fmt(net)}. ${net>=basis?'Profit':'Loss'} ${fmt(Math.abs(net-basis))}`,net>=basis?'win':'loss');$('#sa').value=P[cur]?+P[cur].sh.toFixed(4):0}
    all();
  };
  STK.onTick=()=>{list();head();chart();order();portfolio()};STK.onNews=news;
  all();news();
  cleanup=()=>{ro.disconnect();STK.onTick=null;STK.onNews=null};
};
