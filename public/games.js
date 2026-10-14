'use strict';
/* =========================================================
   Originals: Crash · Roulette · Blackjack · Mines · Towers
              Plinko · Dice · Cups · Coinflip
   ========================================================= */
const pillCls=m=>m<1.5?'lo':m>=10?'hi':m>=2?'w':'mid';

/* ---------- CRASH ---------- */
const CR={hist:[],auto:2};
for(let i=0;i<14;i++)CR.hist.push(Math.max(1,Math.floor(99/(1-rnd()))/100));
PAGES.crash=el=>{
  el.innerHTML=head('crash','Bet before launch, then cash out while the rocket climbs. If it blows up first, the bet is gone.','99%')+`
  <div class="game">
    <div class="side-p">${betField()}
      <label class="fld"><span>Auto cash out</span><div class="amt"><input id="auto" type="number" step="0.01" min="1.01" value="${CR.auto}"><b class="sfx">×</b></div></label>
      <button class="cta" id="act">Place bet</button>
      <div class="kv"><span>Your bet</span><b id="ybet">—</b></div>
      <div class="kv"><span>Payout now</span><b id="ywin">—</b></div>
      <p class="note">Bets placed mid-flight join the next round.</p>
    </div>
    <div class="stage">
      <div class="hist" id="hist"></div>
      <div class="crash-wrap"><canvas id="cv"></canvas><div class="crash-read"><div class="big" id="cm">1.00×</div><div class="phase" id="ph"></div><div class="bar" id="pbar"><i></i></div></div></div>
      <div class="round"><div class="round-h"><span>Players this round</span><span id="rc"></span></div><div class="rlist" id="rlist"></div></div>
    </div>
  </div>`;
  wireBet(el);
  const cv=$('#cv'),ctx=cv.getContext('2d'),cm=$('#cm'),ph=$('#ph'),pbar=$('#pbar'),act=$('#act');
  const C={acc:css('--accent'),gold:css('--gold'),loss:css('--loss'),fg:css('--fg'),dim:css('--dim'),line:css('--line'),num:css('--f-num')};
  let W=0,H=0;
  const size=()=>{const r=cv.getBoundingClientRect(),d=devicePixelRatio||1;W=r.width;H=r.height;cv.width=W*d;cv.height=H*d;ctx.setTransform(d,0,0,d,0,0)};
  size();const ro=new ResizeObserver(size);ro.observe(cv);
  const stars=Array.from({length:70},()=>({x:rnd(),y:rnd(),s:rnd()*1.3+.3,v:rnd()*.6+.15}));
  const K=0.11,WAIT=5000,AFTER=3200;
  let lastMy=null,phase='wait',t0=performance.now(),cp=1,mult=1,my=null,queued=null,bots=[],raf=0,boomAt=0,lastTxt='';
  const drawHist=()=>{$('#hist').innerHTML=CR.hist.slice(0,18).map(m=>`<span class="pill ${pillCls(m)}">${m.toFixed(2)}×</span>`).join('')};
  drawHist();
  function makeBots(){bots=Array.from({length:ri(4,8)},()=>({u:bot(pick(NAMES)),bet:pick([5,10,25,50,100,250]),target:r2(1.05+Math.pow(rnd(),2)*7),cashed:0}))}
  function row(u,bet,st,cls,isMe){return `<div class="rrow${isMe?' me':''}">${avatar(u,22)}<span class="nm">${esc(u.name)}</span><span class="num">${chip(12)}${fmt0(bet)}</span><span class="st ${cls}">${st}</span></div>`}
  function drawPlayers(){
    const rows=[],mine=my&&phase!=='boom'?my:(phase==='boom'?lastMy:null);
    if(my&&phase==='boom')rows.push(row(me(),my.bet,'Next round','',1));
    if(mine&&S.user)rows.push(row(me(),mine.bet,mine.cashed?mine.cashed.toFixed(2)+'×':phase==='boom'?'Busted':'—',mine.cashed?'w':phase==='boom'?'l':'',1));
    bots.forEach(b=>rows.push(row(b.u,b.bet,b.cashed?b.cashed.toFixed(2)+'×':phase==='boom'?'Busted':'—',b.cashed?'w':phase==='boom'?'l':'')));
    $('#rlist').innerHTML=rows.join('');$('#rc').textContent=(bots.length+(mine?1:0))+' playing';
  }
  function newRound(now){
    phase='wait';t0=now;mult=1;lastMy=null;cp=Math.min(1000,Math.max(1,Math.floor(99/(1-rnd()))/100));makeBots();
    if(queued){my=queued;queued=null}
    cm.className='big';drawPlayers();upd();
  }
  function cashout(at){
    if(!my||my.cashed)return;my.cashed=at;const p=r2(my.bet*at);pay(p);settle('crash',my.bet,at,p);
    cm.classList.add('cashed');drawPlayers();upd();
  }
  function upd(){
    let txt,cls='cta';
    if(phase==='fly'){
      if(my&&!my.cashed){txt=`Cash out ${fmt(my.bet*mult)}`;cls='cta gold'}
      else if(queued){txt='Cancel next-round bet';cls='cta ghost'}
      else txt='Bet next round';
    }else{txt=my?'Cancel bet':'Place bet';cls=my?'cta ghost':'cta'}
    if(txt!==lastTxt){act.textContent=txt;act.className=cls;lastTxt=txt}
    $('#ybet').textContent=my?fmt(my.bet):queued?fmt(queued.bet)+' (next)':'—';
    const w=$('#ywin');w.textContent=my?(my.cashed?fmt(my.bet*my.cashed):phase==='fly'?fmt(my.bet*mult):'—'):'—';w.className=my&&my.cashed?'w':'';
  }
  act.onclick=()=>{
    const auto=Math.max(0,+$('#auto').value||0);CR.auto=auto||2;
    if(phase==='fly'){
      if(my&&!my.cashed)return cashout(Math.floor(mult*100)/100);
      if(queued){pay(queued.bet);queued=null;return upd()}
      const a=getBet();if(take(a)){queued={bet:a,auto,cashed:0};toast('Bet queued for the next round.')}
      return upd();
    }
    if(my){pay(my.bet);my=null;drawPlayers();return upd()}
    const a=getBet();if(take(a)){my={bet:a,auto,cashed:0};drawPlayers()}upd();
  };
  function rocket(x,y,a,f){
    ctx.save();ctx.translate(x,y);ctx.rotate(a);
    const g=ctx.createLinearGradient(-14,0,-14-26*f,0);g.addColorStop(0,C.gold);g.addColorStop(1,'rgba(255,77,106,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-12,-5);ctx.quadraticCurveTo(-14-26*f,0,-12,5);ctx.fill();
    ctx.fillStyle=C.loss;ctx.beginPath();ctx.moveTo(-8,-6);ctx.lineTo(-16,-14);ctx.lineTo(-2,-7);ctx.fill();ctx.beginPath();ctx.moveTo(-8,6);ctx.lineTo(-16,14);ctx.lineTo(-2,7);ctx.fill();
    ctx.fillStyle=C.fg;ctx.beginPath();ctx.moveTo(22,0);ctx.bezierCurveTo(16,-10,-4,-10,-12,-6);ctx.lineTo(-12,6);ctx.bezierCurveTo(-4,10,16,10,22,0);ctx.fill();
    ctx.fillStyle=C.acc;ctx.strokeStyle='#0B1E4A';ctx.lineWidth=2;ctx.beginPath();ctx.arc(5,0,4.2,0,7);ctx.fill();ctx.stroke();
    ctx.restore();
  }
  function frame(now){
    raf=requestAnimationFrame(frame);
    if(phase==='wait'&&now-t0>=WAIT){phase='fly';t0=now;upd()}
    if(phase==='boom'&&now-boomAt>=AFTER)newRound(now);
    let t=0;
    if(phase==='fly'){
      t=(now-t0)/1000;mult=Math.exp(K*t);
      if(mult>=cp){
        mult=cp;phase='boom';boomAt=now;CR.hist.unshift(cp);CR.hist.length=Math.min(CR.hist.length,30);drawHist();
        if(my&&!my.cashed)settle('crash',my.bet,0,0);
        lastMy=my;my=null;cm.className='big boom';drawPlayers();upd();
      }else{
        if(my&&!my.cashed&&my.auto>=1.01&&mult>=my.auto)cashout(my.auto);
        let ch=0;bots.forEach(b=>{if(!b.cashed&&mult>=b.target){b.cashed=b.target;ch=1}});if(ch)drawPlayers();
      }
    }
    if(phase==='boom')t=Math.log(cp)/K;
    if(phase==='wait'){
      const left=Math.max(0,(WAIT-(now-t0))/1000);
      cm.textContent='1.00×';ph.textContent=`Launching in ${left.toFixed(1)}s`;pbar.hidden=false;pbar.firstChild.style.transform=`scaleX(${left/(WAIT/1000)})`;
    }else{
      pbar.hidden=true;cm.textContent=mult.toFixed(2)+'×';
      ph.textContent=phase==='boom'?`Blew up at ${cp.toFixed(2)}×`:(my&&my.cashed?`You cashed out at ${my.cashed.toFixed(2)}×`:'Climbing');
    }
    if(phase==='fly')upd();
    ctx.clearRect(0,0,W,H);
    const drift=phase==='fly'?(now-t0)/1000:0;ctx.fillStyle=C.fg;
    stars.forEach(s=>{const x=((s.x*W-drift*s.v*60)%W+W)%W,y=((s.y*H+drift*s.v*18)%H+H)%H;ctx.globalAlpha=.25+s.v*.4;ctx.fillRect(x,y,s.s,s.s)});ctx.globalAlpha=1;
    const pad={l:46,r:30,t:24,b:28},tMax=Math.max(8,t*1.12),mNow=Math.exp(K*t),mMax=Math.max(2,1+(mNow-1)*1.25);
    const X=tt=>pad.l+tt/tMax*(W-pad.l-pad.r),Y=m=>H-pad.b-(m-1)/(mMax-1)*(H-pad.t-pad.b);
    const steps=[.2,.5,1,2,5,10,20,50,100,200,500];const st=steps.find(s=>(mMax-1)/s<=4)||1000;
    ctx.font='600 11px '+C.num;ctx.textAlign='right';ctx.textBaseline='middle';
    for(let m=1;m<=mMax+1e-9;m+=st){const y=Y(m);ctx.strokeStyle=C.line;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();ctx.fillStyle=C.dim;ctx.fillText(m.toFixed(st<1?1:0)+'×',pad.l-8,y)}
    if(t>0){
      const pts=[],n=80;for(let i=0;i<=n;i++){const tt=t*i/n;pts.push([X(tt),Y(Math.exp(K*tt))])}
      const g=ctx.createLinearGradient(pad.l,0,X(t),0);g.addColorStop(0,C.acc);g.addColorStop(1,phase==='boom'?C.loss:C.gold);
      ctx.beginPath();ctx.moveTo(pts[0][0],H-pad.b);pts.forEach(p=>ctx.lineTo(p[0],p[1]));ctx.lineTo(pts[n][0],H-pad.b);ctx.closePath();
      const fg=ctx.createLinearGradient(0,pad.t,0,H);fg.addColorStop(0,phase==='boom'?'rgba(255,77,106,.22)':'rgba(59,123,255,.25)');fg.addColorStop(1,'rgba(59,123,255,0)');ctx.fillStyle=fg;ctx.fill();
      ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle=g;ctx.lineWidth=4;ctx.lineCap='round';ctx.shadowColor=phase==='boom'?C.loss:C.gold;ctx.shadowBlur=14;ctx.stroke();ctx.shadowBlur=0;
      const[x2,y2]=pts[n],[x1,y1]=pts[n-3],a=Math.atan2(y2-y1,x2-x1);
      if(phase==='fly')rocket(x2,y2,a,.7+Math.sin(now/40)*.3);
      else{const p=Math.min(1,(now-boomAt)/700);ctx.globalAlpha=1-p;ctx.strokeStyle=C.loss;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x2,y2,8+p*60,0,7);ctx.stroke();ctx.fillStyle=C.gold;for(let i=0;i<14;i++){const an=i/14*6.283;ctx.beginPath();ctx.arc(x2+Math.cos(an)*p*70,y2+Math.sin(an)*p*70,3*(1-p)+1,0,7);ctx.fill()}ctx.globalAlpha=1}
    }else rocket(X(0)+16,Y(1)-14,-.5,.4+Math.sin(now/90)*.2);
  }
  newRound(performance.now());raf=requestAnimationFrame(frame);
  cleanup=()=>{
    cancelAnimationFrame(raf);ro.disconnect();
    if(queued)pay(queued.bet);
    if(my&&!my.cashed){
      if(phase!=='fly')pay(my.bet);
      else if(my.auto>=1.01&&my.auto<=cp){const p=r2(my.bet*my.auto);pay(p);settle('crash',my.bet,my.auto,p)}else settle('crash',my.bet,0,0);
    }
  };
};

/* ---------- ROULETTE ---------- */
const RORD=[1,14,2,13,3,12,4,0,11,5,10,6,9,7,8];
const rcol=n=>n===0?'g':n<=7?'r':'b';
const RL={hist:Array.from({length:14},()=>Math.floor(rnd()*15))};
PAGES.roulette=el=>{
  el.innerHTML=head('roulette','A new round every few seconds. Bet on red or black for 2×, or green for 14×. Stack as many bets as you like before the timer ends.','93.3%')+`
  <div class="stage solo">
    <div class="rl-top"><div class="rl-hist" id="rh"></div><div class="rl-last" id="rlast"></div></div>
    <div class="rstrip" id="rs"><div class="rtrack" id="rt"></div><i class="rmark"></i></div>
    <div class="rl-timer"><span id="rtxt" style="min-width:150px">Starting…</span><div class="rl-bar"><i id="rbar"></i></div></div>
    <div class="rl-bet">${betField()}<div class="stat"><span>Your bets this round</span><b id="myt">0.00</b></div></div>
    <div class="rl-cols">${['r','g','b'].map(c=>`<div class="rcol" id="c${c}"><button class="rbet b-${c}" data-c="${c}">${c==='r'?'Red':c==='g'?'Green':'Black'}<b>${c==='g'?'14×':'2×'}</b></button><div class="rcol-h"><span id="n${c}">0 players</span><b id="t${c}">0.00</b></div><div class="rlist" id="l${c}"></div></div>`).join('')}</div>
  </div>`;
  wireBet(el);
  const TW=82,REP=11,BET=12000,SPIN=5600,SHOW=2600,tr=$('#rt'),strip=$('#rs');
  tr.innerHTML=Array.from({length:REP*15},(_,i)=>{const n=RORD[i%15];return `<div class="rsq ${rcol(n)}">${n}</div>`}).join('');
  let phase='bet',t0=performance.now(),res=0,jit=0,idx=2*15+RORD.indexOf(RL.hist[0]),bets={r:[],g:[],b:[]},myB={r:0,g:0,b:0},timer=0;
  const place=(i,j,dur)=>{tr.style.transition=dur?`transform ${dur}ms cubic-bezier(.12,.68,.14,1)`:'none';tr.style.transform=`translateX(${-(i*TW+38+j-strip.clientWidth/2)}px)`};
  place(idx,0,0);
  const drawHist=()=>{$('#rh').innerHTML=RL.hist.slice(0,14).map(n=>`<span class="rh ${rcol(n)}">${n}</span>`).join('');const L=RL.hist.slice(0,100);$('#rlast').innerHTML=`Last ${L.length}: <span style="color:#FF5A75">●</span> <b>${L.filter(n=>rcol(n)==='r').length}</b> <span style="color:#38E39A">●</span> <b>${L.filter(n=>n===0).length}</b> <span style="color:var(--muted)">●</span> <b>${L.filter(n=>rcol(n)==='b').length}</b>`};
  function drawBets(){
    ['r','g','b'].forEach(c=>{
      const list=[...bets[c]].sort((a,b)=>b.amt-a.amt);
      $('#n'+c).textContent=list.length+' player'+(list.length===1?'':'s');$('#t'+c).innerHTML=fmt(list.reduce((a,x)=>a+x.amt,0));
      $('#l'+c).innerHTML=list.map(x=>`<div class="rrow${x.me?' me':''}">${avatar(x.u,22)}<span class="nm">${esc(x.u.name)}</span><span class="st">${chip(12)}${fmt(x.amt)}</span></div>`).join('');
    });
    $('#myt').textContent=fmt(myB.r+myB.g+myB.b);
  }
  $$('.rbet',el).forEach(b=>b.onclick=()=>{
    if(phase!=='bet'){toast('Bets are closed for this spin. Next round starts soon.');return}
    const c=b.dataset.c,a=getBet();if(!take(a))return;
    myB[c]=r2(myB[c]+a);const ex=bets[c].find(x=>x.me);if(ex)ex.amt=myB[c];else bets[c].push({u:me(),amt:myB[c],me:1});drawBets();
  });
  function settleMine(){
    const tot=r2(myB.r+myB.g+myB.b);if(!tot)return;
    const c=rcol(res),p=r2(myB[c]*(c==='g'?14:2));pay(p);settle('roulette',tot,r2(p/tot),p);myB={r:0,g:0,b:0};
  }
  function tick(){
    const now=performance.now(),e=now-t0;
    if(phase==='bet'){
      const left=Math.max(0,BET-e);$('#rtxt').textContent=`Rolling in ${(left/1000).toFixed(1)}s`;$('#rbar').style.transform=`scaleX(${left/BET})`;
      if(rnd()<.14){const c=rnd()<.07?'g':rnd()<.5?'r':'b';bets[c].push({u:bot(pick(NAMES)),amt:pick([5,10,25,50,100,250,500])});drawBets()}
      if(e>=BET){
        phase='spin';t0=now;res=Math.floor(rnd()*15);$$('.rbet',el).forEach(b=>b.disabled=true);$('#rtxt').textContent='Rolling…';$('#rbar').style.transform='scaleX(0)';
        jit=(rnd()-.5)*60;idx=8*15+RORD.indexOf(res);place(idx,jit,REDUCED?200:SPIN);
      }
    }else if(phase==='spin'){
      if(e>=(REDUCED?250:SPIN)+60){
        phase='show';t0=now;RL.hist.unshift(res);RL.hist.length=Math.min(RL.hist.length,100);drawHist();
        tr.children[idx].classList.add('hit');const c=rcol(res);
        ['r','g','b'].forEach(k=>$('#c'+k).classList.toggle('lose',k!==c));
        $('#rtxt').textContent=`Landed on ${res} · ${c==='g'?'Green':c==='r'?'Red':'Black'}`;
        settleMine();
      }
    }else if(e>=SHOW){
      tr.children[idx].classList.remove('hit');idx=2*15+RORD.indexOf(res);place(idx,jit,0);
      phase='bet';t0=now;bets={r:[],g:[],b:[]};drawBets();$$('.rbet',el).forEach(b=>b.disabled=false);['r','g','b'].forEach(k=>$('#c'+k).classList.remove('lose'));
    }
  }
  drawHist();drawBets();timer=setInterval(tick,100);
  const onR=()=>place(idx,jit,0);addEventListener('resize',onR);
  cleanup=()=>{
    clearInterval(timer);removeEventListener('resize',onR);
    const tot=myB.r+myB.g+myB.b;if(!tot)return;
    if(phase==='bet'){pay(tot);myB={r:0,g:0,b:0}}else if(phase==='spin')settleMine();
  };
};

/* ---------- MINES ---------- */
const GEM='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10l4 5-9 11L3 9z" fill="#5FF2C0" stroke="#0B5C4A" stroke-width="1.2" stroke-linejoin="round"/><path d="M3 9h18M9 4l3 5 3-5M12 9v11" stroke="#0B5C4A" stroke-width="1" fill="none"/></svg>';
const BOMB='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="14" r="7" fill="#1A0A12" stroke="#FF4D6A" stroke-width="1.4"/><circle cx="8.5" cy="11.5" r="1.8" fill="#ffffff44"/><path d="M15.5 9l2.5-2.5" stroke="#FF4D6A" stroke-width="2" stroke-linecap="round"/><path d="M19 5.5l1.6-1M19 5.5l1 1.6M19 5.5l-.4-1.8" stroke="#F5B83D" stroke-width="1.4" stroke-linecap="round"/></svg>';
PAGES.mines=el=>{
  const MC=store.get('mines',3);
  el.innerHTML=head('mines','Pick tiles to find gems. Every gem raises your multiplier. Hit a mine and the round ends.','99%')+`
  <div class="game">
    <div class="side-p">${betField()}
      <label class="fld"><span>Mines</span><select class="sel" id="mc">${Array.from({length:24},(_,i)=>`<option value="${i+1}"${i+1===MC?' selected':''}>${i+1}</option>`).join('')}</select></label>
      <button class="cta" id="act">Start game</button>
      <button class="cta ghost" id="rand" hidden>Pick random tile</button>
      <div class="kv"><span>Gems found</span><b id="gf">0</b></div>
      <div class="kv"><span>Multiplier</span><b id="cmul">1.00×</b></div>
      <div class="kv"><span>Next gem</span><b id="nmul">—</b></div>
    </div>
    <div class="stage center"><div class="mines" id="grid">${Array.from({length:25},(_,i)=>`<button class="tile" data-i="${i}" disabled aria-label="Tile ${i+1}"></button>`).join('')}</div><div id="res"></div></div>
  </div>`;
  wireBet(el);
  const mm=(k,m)=>{if(!k)return 1;let x=1;for(let i=0;i<k;i++)x*=(25-i)/(25-m-i);return Math.floor(x*.99*100)/100};
  let g=null;const tiles=$$('#grid .tile'),act=$('#act');
  function stats(){
    const k=g?g.picked.size:0,m=g?g.m:+$('#mc').value;
    $('#gf').textContent=k;$('#cmul').textContent=mm(k,m).toFixed(2)+'×';$('#nmul').textContent=k<25-m?mm(k+1,m).toFixed(2)+'×':'—';
    if(g&&!g.over){act.textContent=k?`Cash out ${fmt(g.bet*mm(k,m))}`:'Pick a tile';act.className=k?'cta gold':'cta';act.disabled=!k}
  }
  function end(win){
    g.over=true;const k=g.picked.size,m=g.m,mult=win?mm(k,m):0,p=win?r2(g.bet*mult):0;
    tiles.forEach((t,i)=>{t.disabled=true;if(!g.picked.has(i)&&!t.classList.contains('bomb')){t.classList.add(g.mines.has(i)?'bomb':'gem','dim','flip');t.innerHTML=g.mines.has(i)?BOMB:GEM}});
    if(win)pay(p);settle('mines',g.bet,mult,p);
    $('#res').innerHTML=win?resultBox(mult.toFixed(2)+'×','+'+fmt(p)+' Rodux'):'';
    act.textContent='Play again';act.className='cta';act.disabled=false;$('#rand').hidden=true;$('#mc').disabled=false;lockBet(false,el);
  }
  function reveal(i){
    if(!g||g.over||g.picked.has(i))return;const t=tiles[i];t.disabled=true;t.classList.add('flip');
    if(g.mines.has(i)){t.classList.add('bomb','hit');t.innerHTML=BOMB;$('#res').innerHTML='';end(false);return}
    g.picked.add(i);t.classList.add('gem');t.innerHTML=GEM;stats();
    if(g.picked.size===25-g.m)end(true);
  }
  tiles.forEach(t=>t.onclick=()=>reveal(+t.dataset.i));
  $('#rand').onclick=()=>{const free=tiles.map((t,i)=>i).filter(i=>!g.picked.has(i)&&!tiles[i].disabled);reveal(pick(free))};
  $('#mc').onchange=()=>{store.set('mines',+$('#mc').value);stats()};
  act.onclick=()=>{
    if(g&&!g.over){if(g.picked.size)end(true);return}
    const a=getBet();if(!take(a))return;
    const m=+$('#mc').value,idx=shuffle(Array.from({length:25},(_,i)=>i));
    g={bet:a,m,mines:new Set(idx.slice(0,m)),picked:new Set(),over:false};
    $('#res').innerHTML='';tiles.forEach(t=>{t.className='tile';t.innerHTML='';t.disabled=false});
    $('#mc').disabled=true;lockBet(true,el);$('#rand').hidden=false;stats();
  };
  stats();
  cleanup=()=>{if(g&&!g.over){if(g.picked.size){const x=mm(g.picked.size,g.m),p=r2(g.bet*x);pay(p);settle('mines',g.bet,x,p)}else pay(g.bet)}};
};

/* ---------- TOWERS ---------- */
const TD={easy:{c:4,b:1,l:'Easy'},medium:{c:3,b:1,l:'Medium'},hard:{c:2,b:1,l:'Hard'},expert:{c:3,b:2,l:'Expert'}};
const ROWS=8;
PAGES.towers=el=>{
  let diff=store.get('tdiff','medium');
  el.innerHTML=head('towers','Climb one floor at a time. Each floor hides traps. Cash out whenever you like, or reach the top.','98%')+`
  <div class="game">
    <div class="side-p">${betField()}
      <div class="fld"><span>Difficulty</span>${seg('td',Object.entries(TD).map(([k,v])=>[k,v.l]),diff)}</div>
      <button class="cta" id="act">Start climb</button>
      <div class="kv"><span>Floor</span><b id="fl">0 / ${ROWS}</b></div>
      <div class="kv"><span>Multiplier</span><b id="tm">1.00×</b></div>
    </div>
    <div class="stage center"><div class="towers" id="tw"></div><div id="res"></div></div>
  </div>`;
  wireBet(el);
  const rm=()=>TD[diff].c/(TD[diff].c-TD[diff].b)*.98,lm=L=>L?Math.floor(Math.pow(rm(),L)*100)/100:1;
  let g=null;const act=$('#act');
  function draw(){
    const c=TD[diff].c;
    $('#tw').innerHTML=Array.from({length:ROWS},(_,ri_)=>{const r=ROWS-1-ri_;
      const cls=g?(r<g.level?'done':r===g.level&&!g.over?'active':g.over?'reveal':''):'';
      return `<div class="trow ${cls}" data-r="${r}"><div class="cells" style="grid-template-columns:repeat(${c},1fr)">${Array.from({length:c},(_,ci)=>`<button class="tile" data-c="${ci}" disabled aria-label="Floor ${r+1} tile ${ci+1}"></button>`).join('')}</div><span class="x">${lm(r+1).toFixed(2)}×</span></div>`}).join('');
    $$('#tw .trow').forEach(row=>{const r=+row.dataset.r;$$('.tile',row).forEach(t=>{
      const c=+t.dataset.c;
      if(g&&g.picks[r]===c){t.classList.add(g.bombs[r].has(c)?'bomb':'gem');t.innerHTML=g.bombs[r].has(c)?BOMB:GEM}
      else if(g&&g.over&&r>=g.level){t.classList.add(g.bombs[r].has(c)?'bomb':'gem','dim');t.innerHTML=g.bombs[r].has(c)?BOMB:GEM}
      if(g&&!g.over&&r===g.level){t.disabled=false;t.onclick=()=>step(c)}
    })});
    $('#fl').textContent=(g?g.level:0)+' / '+ROWS;$('#tm').textContent=lm(g?g.level:0).toFixed(2)+'×';
    if(g&&!g.over){act.textContent=g.level?`Cash out ${fmt(g.bet*lm(g.level))}`:'Pick a tile on floor 1';act.className=g.level?'cta gold':'cta';act.disabled=!g.level}
  }
  function step(c){
    const r=g.level;g.picks[r]=c;
    if(g.bombs[r].has(c)){g.over=true;draw();const t=$(`#tw .trow[data-r="${r}"] .tile[data-c="${c}"]`);t.classList.add('hit','flip');finish(false);return}
    g.level++;draw();const t=$(`#tw .trow[data-r="${r}"] .tile[data-c="${c}"]`);if(t)t.classList.add('flip');
    if(g.level===ROWS){g.over=true;draw();finish(true)}
  }
  function finish(win){
    g.over=true;const mult=win?lm(g.level):0,p=win?r2(g.bet*mult):0;if(win)pay(p);settle('towers',g.bet,mult,p);
    $('#res').innerHTML=win?resultBox(mult.toFixed(2)+'×','+'+fmt(p)+' Rodux'):'';
    act.textContent='Play again';act.className='cta';act.disabled=false;lockBet(false,el);$$('#td button').forEach(b=>b.disabled=false);
  }
  wireSeg($('#td'),v=>{diff=v;store.set('tdiff',v);g=null;$('#res').innerHTML='';draw()});
  act.onclick=()=>{
    if(g&&!g.over){if(g.level){g.over=true;draw();finish(true)}return}
    const a=getBet();if(!take(a))return;const{c,b}=TD[diff];
    g={bet:a,level:0,over:false,picks:{},bombs:Array.from({length:ROWS},()=>{const s=new Set();while(s.size<b)s.add(Math.floor(rnd()*c));return s})};
    $('#res').innerHTML='';lockBet(true,el);$$('#td button').forEach(x=>x.disabled=true);draw();
  };
  draw();
  cleanup=()=>{if(g&&!g.over){if(g.level){const p=r2(g.bet*lm(g.level));pay(p);settle('towers',g.bet,lm(g.level),p)}else pay(g.bet)}};
};

/* ---------- PLINKO ---------- */
const PL={
  8:{low:[5.6,2.1,1.1,1,.5,1,1.1,2.1,5.6],med:[13,3,1.3,.7,.4,.7,1.3,3,13],high:[29,4,1.5,.3,.2,.3,1.5,4,29]},
  12:{low:[10,3,1.6,1.4,1.1,1,.5,1,1.1,1.4,1.6,3,10],med:[33,11,4,2,1.1,.6,.3,.6,1.1,2,4,11,33],high:[170,24,8.1,2,.7,.2,.2,.2,.7,2,8.1,24,170]},
  16:{low:[16,9,2,1.4,1.4,1.2,1.1,1,.5,1,1.1,1.2,1.4,1.4,2,9,16],med:[110,41,10,5,3,1.5,1,.5,.3,.5,1,1.5,3,5,10,41,110],high:[1000,130,26,9,4,2,.2,.2,.2,.2,.2,2,4,9,26,130,1000]}
};
PAGES.plinko=el=>{
  let R=store.get('prows',12),risk=store.get('prisk','med');
  el.innerHTML=head('plinko','Drop a ball through the pegs. Where it lands sets your multiplier. Drop as many as you like.','99%')+`
  <div class="game">
    <div class="side-p">${betField()}
      <div class="fld"><span>Risk</span>${seg('pr',[['low','Low'],['med','Medium'],['high','High']],risk)}</div>
      <div class="fld"><span>Rows</span>${seg('pn',[[8,'8'],[12,'12'],[16,'16']],R)}</div>
      <button class="cta" id="act">Drop ball</button>
      <div class="kv"><span>Balls in play</span><b id="bip">0</b></div>
    </div>
    <div class="stage"><div class="streak" id="last" style="margin-bottom:6px"></div><div class="plinko"><canvas id="pc"></canvas></div></div>
  </div>`;
  wireBet(el);
  const cv=$('#pc'),ctx=cv.getContext('2d');let W=0,H=0;
  const size=()=>{const r=cv.getBoundingClientRect(),d=devicePixelRatio||1;W=r.width;H=r.height;cv.width=W*d;cv.height=H*d;ctx.setTransform(d,0,0,d,0,0)};
  size();const ro=new ResizeObserver(size);ro.observe(cv);
  const C={fg:css('--fg'),gold:css('--gold'),num:css('--f-num')};
  let balls=[],hitBin={},hitPeg={},raf=0;const last=[];
  const lock=on=>$$('#pr button,#pn button').forEach(b=>b.disabled=on);
  wireSeg($('#pr'),v=>{risk=v;store.set('prisk',v)});wireSeg($('#pn'),v=>{R=+v;store.set('prows',R)});
  const geo=()=>{const top=34,binH=30,dy=(H-top-binH-24)/R,dx=Math.min((W-20)/(R+2),dy*1.25);return{top,dy,dx,cx:W/2,binY:top+R*dy+4,binH,pegR:Math.max(2.4,dx*.085)}};
  $('#act').onclick=()=>{const a=getBet();if(!take(a))return;balls.push({path:Array.from({length:R},()=>rnd()<.5?0:1),t0:performance.now(),step:Math.max(85,1500/R),bet:a});lock(true);$('#bip').textContent=balls.length};
  const binColor=(j,n)=>{const t=Math.abs(j-n/2)/(n/2);return `hsl(${(44-56*t+360)%360} 92% ${58-6*t}%)`};
  function land(b,now){
    const j=b.path.reduce((a,c)=>a+c,0),m=PL[R][risk][j],p=r2(b.bet*m);hitBin[j]=now;pay(p);settle('plinko',b.bet,m,p,{quiet:m<2});
    last.unshift(m);last.length=Math.min(last.length,12);const l=$('#last');if(l)l.innerHTML=last.map(x=>`<span class="pill ${x>=2?'hi':x>=1?'w':'lo'}">${x}×</span>`).join('');
  }
  function frame(now){
    raf=requestAnimationFrame(frame);ctx.clearRect(0,0,W,H);const g=geo(),mults=PL[R][risk];
    for(let r=0;r<R;r++)for(let i=0;i<r+3;i++){const x=g.cx+(i-(r+2)/2)*g.dx,y=g.top+r*g.dy,lit=now-(hitPeg[r+'-'+i]||0)<220;ctx.beginPath();ctx.arc(x,y,g.pegR*(lit?1.5:1),0,7);ctx.fillStyle=lit?C.gold:C.fg;ctx.globalAlpha=lit?1:.75;ctx.shadowColor=C.gold;ctx.shadowBlur=lit?12:0;ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1}
    const fs=Math.max(8,Math.min(12,g.dx*.3));ctx.font=`700 ${fs}px ${C.num}`;ctx.textAlign='center';ctx.textBaseline='middle';
    mults.forEach((m,j)=>{const x=g.cx+(j-R/2)*g.dx,bump=now-(hitBin[j]||0)<320?Math.sin((now-hitBin[j])/320*Math.PI)*6:0,w=g.dx-4;ctx.fillStyle=binColor(j,R);ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x-w/2,g.binY+bump,w,g.binH,6);else ctx.rect(x-w/2,g.binY+bump,w,g.binH);ctx.fill();ctx.fillStyle='#1A0D05';ctx.fillText(m+(g.dx>40?'×':''),x,g.binY+bump+g.binH/2+1)});
    for(let k=balls.length-1;k>=0;k--){
      const b=balls[k],e=(now-b.t0)/b.step-1,r=Math.floor(e),f=e-r,br=g.pegR*1.7;
      const pos=s=>{if(s<0)return[g.cx,g.top-g.dy-br];const kk=b.path.slice(0,s).reduce((a,c)=>a+c,0);return s>=R?[g.cx+(kk-R/2)*g.dx,g.binY+g.binH/2]:[g.cx+(kk-s/2)*g.dx,g.top+s*g.dy-g.pegR-br]};
      if(r>=R){land(b,now);balls.splice(k,1);$('#bip').textContent=balls.length;if(!balls.length)lock(false);continue}
      const[x0,y0]=pos(r),[x1,y1]=pos(r+1);
      if(r>=0&&f<.2){const kk=b.path.slice(0,r).reduce((a,c)=>a+c,0);hitPeg[r+'-'+(kk+1)]=now}
      const x=x0+(x1-x0)*f,y=y0+(y1-y0)*f*f-(r>=0?g.dy*.32*Math.sin(Math.PI*f):0);
      ctx.beginPath();ctx.arc(x,y,br,0,7);ctx.fillStyle=C.gold;ctx.shadowColor=C.gold;ctx.shadowBlur=10;ctx.fill();ctx.shadowBlur=0;
    }
  }
  raf=requestAnimationFrame(frame);
  cleanup=()=>{cancelAnimationFrame(raf);ro.disconnect();const now=performance.now();balls.forEach(b=>land(b,now));balls=[]};
};

/* ---------- DICE ---------- */
PAGES.dice=el=>{
  let over=store.get('dover',true),target=store.get('dtgt',50.5),rolling=false;const last=[];
  el.innerHTML=head('dice','Set a target and roll over or under it. Lower chances pay more.','99%')+`
  <div class="game">
    <div class="side-p">${betField()}
      <div class="fld"><span>Direction</span>${seg('dd',[['1','Roll over'],['0','Roll under']],over?'1':'0')}</div>
      <button class="cta" id="act">Roll dice</button>
      <div class="kv"><span>Profit on win</span><b class="w" id="pf"></b></div>
      <p class="note">Shortcut: press Space to roll.</p>
    </div>
    <div class="stage">
      <div class="streak" id="last"></div>
      <div class="dice-num" id="dn">50.00</div>
      <div class="dtrack"><div class="dbar" id="dbar"></div><div class="pin" id="pin" hidden>0</div><input type="range" id="tg" min="2" max="98" step="0.5" value="${target}" aria-label="Target"></div>
      <div class="ticks"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
      <div class="dstats"><div><span>Target</span><b id="dt"></b></div><div><span>Multiplier</span><b id="dm"></b></div><div><span>Win chance</span><b id="dc"></b></div></div>
    </div>
  </div>`;
  wireBet(el);
  const chance=()=>over?100-target:target,mul=()=>Math.floor(99/chance()*10000)/10000;
  function upd(){
    const t=target;$('#dbar').style.background=over?`linear-gradient(90deg,var(--loss) 0 ${t}%,var(--win) ${t}% 100%)`:`linear-gradient(90deg,var(--win) 0 ${t}%,var(--loss) ${t}% 100%)`;
    $('#dt').textContent=(over?'> ':'< ')+t.toFixed(2);$('#dm').textContent=mul().toFixed(4)+'×';$('#dc').textContent=chance().toFixed(2)+'%';
    const b=Math.floor(+$('#amt').value||0);$('#pf').textContent=fmt(b*mul()-b);
  }
  $('#tg').oninput=e=>{target=+e.target.value;store.set('dtgt',target);upd()};$('#amt').oninput=upd;
  wireSeg($('#dd'),v=>{over=v==='1';store.set('dover',over);upd()});
  async function roll(){
    if(rolling)return;const a=getBet();if(!take(a))return;rolling=true;$('#act').disabled=true;
    const r=Math.floor(rnd()*10001)/100,win=over?r>target:r<target,m=mul(),p=win?r2(a*m):0;
    const dn=$('#dn'),pin=$('#pin');dn.className='dice-num';pin.hidden=false;pin.className='pin';pin.style.left=r+'%';
    const t0=performance.now(),from=+dn.textContent||0;
    await new Promise(res=>{(function s(t){const q=Math.min(1,(t-t0)/450),e=1-Math.pow(1-q,3);dn.textContent=(from+(r-from)*e).toFixed(2);q<1?requestAnimationFrame(s):res()})(t0)});
    if(win)pay(p);settle('dice',a,win?m:0,p,{quiet:true});
    if(!el.isConnected)return;
    dn.classList.add(win?'w':'l');pin.textContent=r.toFixed(2);pin.classList.add(win?'w':'l');
    last.unshift({r,win});last.length=Math.min(last.length,12);$('#last').innerHTML=last.map(l=>`<span class="pill ${l.win?'w':'lo'}">${l.r.toFixed(2)}</span>`).join('');
    rolling=false;$('#act').disabled=false;
  }
  $('#act').onclick=roll;
  const key=e=>{if(e.code==='Space'&&e.target.tagName!=='INPUT'&&!$('#modal').innerHTML){e.preventDefault();roll()}};document.addEventListener('keydown',key);
  upd();cleanup=()=>document.removeEventListener('keydown',key);
};

/* ---------- CUPS ---------- */
const CUP='<svg viewBox="0 0 100 130" width="100%" height="100%" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><defs><linearGradient id="cg" x1="0" x2="1"><stop offset="0" stop-color="#B83A55"/><stop offset=".45" stop-color="#FF6B86"/><stop offset="1" stop-color="#8E1D3E"/></linearGradient></defs><path d="M8 126h84L78 18H22z" fill="url(#cg)"/><rect x="18" y="10" width="64" height="12" rx="5" fill="#FF8FA3"/><path d="M14 104h72" stroke="#0004" stroke-width="5"/><ellipse cx="50" cy="126" rx="42" ry="4" fill="#5A1027"/></svg>';
PAGES.cups=el=>{
  let speed=store.get('cspd','fast'),busy=false,state=null;const SP={chill:[7,440],fast:[11,300],insane:[16,190]};
  el.innerHTML=head('cups','Watch the ball, follow the shuffle, then pick the cup hiding it. A correct pick pays 2.88×.','96%')+`
  <div class="game">
    <div class="side-p">${betField()}
      <div class="fld"><span>Shuffle speed</span>${seg('cs',[['chill','Chill'],['fast','Fast'],['insane','Insane']],speed)}</div>
      <button class="cta" id="act">Play</button>
      <div class="kv"><span>Payout</span><b>2.88×</b></div>
      <div class="kv"><span>Win on correct pick</span><b class="w" id="pw"></b></div>
    </div>
    <div class="stage center"><div style="width:100%;display:grid;place-items:center"><div class="cups" id="cups"><div class="floor"></div></div><div class="status" id="st">Place a bet to start</div></div><div id="res"></div></div>
  </div>`;
  wireBet(el);
  const box=$('#cups'),st=$('#st'),act=$('#act');
  const pw=()=>{$('#pw').textContent=fmt(Math.floor(+$('#amt').value||0)*2.88)};$('#amt').oninput=pw;pw();
  const cups=[0,1,2].map(i=>{const w=document.createElement('div');w.className='cupw';w.innerHTML=`<div class="cup">${CUP}</div>`;box.appendChild(w);return{el:w,slot:i}});
  const place=()=>cups.forEach(c=>c.el.style.left=`calc(${c.slot*33.333}% + 3.7%)`);place();
  let ball=1;const setBall=b=>cups.forEach((c,i)=>{const e=c.el.querySelector('.ball');if(e)e.remove();if(i===b)c.el.insertAdjacentHTML('afterbegin','<div class="ball"></div>')});setBall(ball);
  wireSeg($('#cs'),v=>{speed=v;store.set('cspd',v)});
  async function play(){
    const a=getBet();if(busy||!take(a))return;busy=true;state={bet:a};act.disabled=true;lockBet(true,el);$$('#cs button').forEach(b=>b.disabled=true);$('#res').innerHTML='';
    ball=Math.floor(rnd()*3);setBall(ball);
    st.textContent='Watch the ball';cups[ball].el.classList.add('lift');await sleep(1000);if(!state)return;cups[ball].el.classList.remove('lift');await sleep(450);
    // The ball leaves the page once the cup is down, so nothing (hovering, zooming, inspecting the
    // page) can show where it is until the player has picked.
    setBall(-1);
    const[n,ms]=SP[speed];st.textContent='Shuffling…';
    for(let k=0;k<n;k++){
      if(!state)return;
      const a1=Math.floor(rnd()*3);let b1=Math.floor(rnd()*2);if(b1>=a1)b1++;
      const A=cups.find(c=>c.slot===a1),B=cups.find(c=>c.slot===b1);
      [A,B].forEach(c=>{c.el.style.transitionDuration=ms+'ms';c.el.style.setProperty('--sp',ms+'ms');c.el.classList.remove('hopA','hopB')});void A.el.offsetWidth;
      A.el.classList.add('hopA');B.el.classList.add('hopB');A.slot=b1;B.slot=a1;place();await sleep(ms+40);
    }
    if(!state)return;st.textContent='Pick a cup';state.picking=true;
    cups.forEach((c,i)=>{c.el.classList.add('pick');c.el.onclick=()=>choose(i)});
  }
  async function choose(i){
    if(!state||!state.picking)return;state.picking=false;cups.forEach(c=>{c.el.classList.remove('pick');c.el.onclick=null});
    setBall(ball);cups[i].el.classList.add('lift');const win=i===ball,p=win?r2(state.bet*2.88):0;
    await sleep(450);if(!win)cups[ball].el.classList.add('lift');
    if(win)pay(p);settle('cups',state.bet,win?2.88:0,p);
    st.textContent=win?'Found it':'Not that one';$('#res').innerHTML=win?resultBox('2.88×','+'+fmt(p)+' Rodux'):'';
    state=null;await sleep(1300);cups.forEach(c=>c.el.classList.remove('lift'));
    busy=false;act.disabled=false;act.textContent='Play again';lockBet(false,el);$$('#cs button').forEach(b=>b.disabled=false);
  }
  act.onclick=play;
  cleanup=()=>{if(state){if(state.picking)settle('cups',state.bet,0,0);else pay(state.bet);state=null}};
};

/* ---------- COINFLIP ---------- */
const CROWN='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 18h18l1.2-11-5.6 4.4L12 4.5l-4.6 6.9L1.8 7z"/></svg>';
const TOWER='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 21h14v-3H5zM7 17h10l-1-8H8zM6 8h12V4h-2.5v2h-2V4h-3v2h-2V4H6z"/></svg>';
PAGES.coinflip=el=>{
  let side='h',rot=0,busy=false,pend=null;const streak=[];
  el.innerHTML=head('coinflip','Call it, then flip. Crown or Tower, 1.96× on a correct call.','98%')+`
  <div class="game">
    <div class="side-p">${betField()}
      <div class="fld"><span>Your call</span>${seg('cf',[['h','Crown'],['t','Tower']],'h')}</div>
      <button class="cta" id="act">Flip coin</button>
      <div class="kv"><span>Win on correct call</span><b class="w" id="pw"></b></div>
    </div>
    <div class="stage"><div class="streak" id="sk" style="justify-content:center"></div><div class="coin-scene"><div class="toss" id="toss"><div class="coin" id="coin"><div class="face h">${CROWN}</div><div class="face t">${TOWER}</div></div></div></div><div class="status" id="st">Pick a side</div></div>
  </div>`;
  wireBet(el);
  const pw=()=>{$('#pw').textContent=fmt(Math.floor(+$('#amt').value||0)*1.96)};$('#amt').oninput=pw;pw();
  wireSeg($('#cf'),v=>side=v);
  function done(){const{a,res,call}=pend;pend=null;const win=res===call,p=win?r2(a*1.96):0;if(win)pay(p);settle('coinflip',a,win?1.96:0,p);return win}
  $('#act').onclick=async()=>{
    const a=getBet();if(busy||!take(a))return;busy=true;$('#act').disabled=true;$$('#cf button').forEach(b=>b.disabled=true);
    const res=rnd()<.5?'h':'t',face=((rot%360)+360)%360===0?'h':'t';pend={a,res,call:side};
    rot+=1800+(res!==face?180:0);$('#st').textContent='Flipping…';
    const t=$('#toss');t.classList.remove('go');void t.offsetWidth;t.classList.add('go');$('#coin').style.transform=`rotateY(${rot}deg)`;
    await sleep(REDUCED?200:1650);if(!pend)return;
    const win=done();$('#st').innerHTML=`${res==='h'?'Crown':'Tower'}. ${win?'<span style="color:var(--win)">You called it.</span>':'Better luck next flip.'}`;
    streak.unshift({res,win});streak.length=Math.min(streak.length,14);$('#sk').innerHTML=streak.map(s=>`<span class="pill ${s.win?'w':'lo'}">${s.res==='h'?'Crown':'Tower'}</span>`).join('');
    busy=false;$('#act').disabled=false;$$('#cf button').forEach(b=>b.disabled=false);
  };
  cleanup=()=>{if(pend)done()};
};
