'use strict';
/* =========================================================
   Table & instant games: Blackjack (5-seat) · Baccarat · Limbo · Hi-Lo · Keno · Wheel
   ========================================================= */
const SUITS=['♠','♥','♦','♣'],RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const mkShoe=decks=>{const s=[];for(let d=0;d<decks;d++)for(let x=0;x<4;x++)RANKS.forEach((r,i)=>s.push({r,s:x,i,v:r==='A'?11:i>=9?10:i+1}));return shuffle(s)};
const randCard=()=>{const i=Math.floor(rnd()*13);return{r:RANKS[i],s:Math.floor(rnd()*4),i,v:i===0?11:i>=9?10:i+1}};
function cardEl(c,down,nodeal){
  const d=document.createElement('div');d.className='pc'+(c.s===1||c.s===2?' red':'')+(down?' down':'')+(nodeal?' nodeal':'');
  d.innerHTML=`<div class="pc-in"><div class="pc-f"><span class="pc-r">${c.r}<i>${SUITS[c.s]}</i></span><span class="pc-c">${SUITS[c.s]}</span><span class="pc-r b">${c.r}<i>${SUITS[c.s]}</i></span></div><div class="pc-b"></div></div>`;return d;
}
const cardHTML=(c,cls='')=>{const e=cardEl(c,false,true);if(cls)e.classList.add(cls);return e.outerHTML};
const bjv=cs=>{let t=0,a=0;cs.forEach(c=>{t+=c.v;if(c.r==='A')a++});while(t>21&&a){t-=10;a--}return{t,soft:a>0}};
const isBJ=cs=>cs.length===2&&bjv(cs).t===21;
const miniAmt=(id='amt')=>`<div class="amt">${chip(16)}<input id="${id}" type="number" min="1" step="1" inputmode="numeric" value="${S.lastBet}" aria-label="Bet amount"><button type="button" data-m="0.5">½</button><button type="button" data-m="2">2×</button></div>`;

/* ---------- BLACKJACK · shared 5-seat table ---------- */
const BJT={seats:null};
PAGES.blackjack=el=>{
  const N=5;
  if(!BJT.seats){BJT.seats=Array(N).fill(null);[0,2,3].forEach(i=>BJT.seats[i]={u:bot(pick(NAMES)),bot:1})}
  const seats=BJT.seats;seats.forEach((s,i)=>{if(s&&s.me)seats[i]=null});
  let shoe=mkShoe(6),dealer=[],revealed=false,phase='bet',turn=-1,alive=true,act=null,betEnd=0,turnEnd=0,timer=0;
  el.innerHTML=head('blackjack','A shared table with five seats. Sit down, bet while the timer runs, then play your hand when the spotlight reaches you. Blackjack pays 3 to 2 and the dealer stands on 17.','99.4%')+`
  <div class="game" style="grid-template-columns:minmax(0,1fr)">
    <div class="felt" style="border:0;border-radius:0">
      <div class="shoe" aria-hidden="true"></div>
      <div class="dealer"><span class="who">Dealer</span><div class="hand" id="dh"></div><span class="hv" id="dv" hidden></span></div>
      <div class="bj-arc" aria-hidden="true"><svg viewBox="0 0 600 170"><path id="arcp" d="M40 30 Q300 170 560 30" fill="none"/><text><textPath href="#arcp" startOffset="50%" text-anchor="middle">BLACKJACK PAYS 3 TO 2</textPath></text><path id="arcp2" d="M95 60 Q300 178 505 60" fill="none"/><text class="sub"><textPath href="#arcp2" startOffset="50%" text-anchor="middle">DEALER STANDS ON ALL 17s</textPath></text></svg></div>
      <div class="seats" id="seats">${Array.from({length:N},(_,i)=>`<div class="seat" id="st${i}"></div>`).join('')}</div>
    </div>
    <div class="tbar">
      ${miniAmt()}
      <button class="cta sm" id="bbet">Place bet</button>
      <button class="cta ghost sm" id="hit" disabled>Hit</button><button class="cta ghost sm" id="stand" disabled>Stand</button><button class="cta ghost sm" id="dbl" disabled>Double</button>
      <span class="tlog" id="tlog">Waiting for the next round</span>
      <button class="cta ghost sm" id="leave" hidden>Leave seat</button>
    </div>
  </div>`;
  wireBet(el);
  const mine=()=>seats.findIndex(s=>s&&s.me);
  const log=t=>{const e=$('#tlog');if(e)e.textContent=t};
  function seatHTML(i){
    const s=seats[i];
    if(!s)return mine()<0?`<button class="sit" data-sit="${i}">Sit here</button>`:`<div class="sit" style="opacity:.4;cursor:default">Empty</div>`;
    return `<div class="tmr"><i id="tm${i}" style="transform:scaleX(0)"></i></div><div class="hand" id="sh${i}"></div><div class="sinfo" id="si${i}"></div><div class="sname" ${s.me?'':`data-user="${esc(s.u.name)}"`}>${avatar(s.u,20)}<span>${esc(s.u.name)}</span></div>`;
  }
  function drawSeat(i){
    const e=$('#st'+i);if(!e)return;const s=seats[i];
    e.className='seat'+(s&&s.me?' mine':'')+(turn===i?' turn':'');
    e.innerHTML=seatHTML(i);
    if(s&&s.cards)s.cards.forEach(c=>$('#sh'+i).appendChild(cardEl(c,false,true)));
    info(i);
  }
  function info(i){
    const s=seats[i],e=$('#si'+i);if(!s||!e)return;
    const v=s.cards&&s.cards.length?bjv(s.cards):null;
    e.innerHTML=(v?`<span class="hv${v.t>21?' bust':isBJ(s.cards)?' bj':''}">${isBJ(s.cards)?'BJ':v.soft&&v.t<21?`${v.t-10}/${v.t}`:v.t}</span>`:'')+(s.bet?`<span class="sbet">${chip(12)}${fmt(s.bet)}</span>`:phase==='bet'?`<span class="sbet" style="opacity:.6">No bet</span>`:'')+(s.res?`<span class="hres ${s.k}">${s.res}</span>`:'');
    $('#st'+i).classList.toggle('turn',turn===i);
  }
  const drawAll=()=>{for(let i=0;i<N;i++)drawSeat(i);btns()};
  function dealerVal(){const e=$('#dv');if(!e)return;if(!dealer.length){e.hidden=true;return}e.hidden=false;const v=bjv(revealed?dealer:[dealer[0]]);e.textContent=v.t;e.className='hv'+(v.t>21?' bust':'')}
  function btns(){
    if(!alive)return;const m=mine(),me=m>=0?seats[m]:null,myTurn=act&&act.i===m;
    $('#bbet').disabled=!me||phase!=='bet'||me.bet>0;$('#bbet').hidden=!me&&false;
    $('#bbet').textContent=!me?'Take a seat to bet':me.bet?'Bet placed':'Place bet';
    $('#hit').disabled=!myTurn;$('#stand').disabled=!myTurn;$('#dbl').disabled=!myTurn||me.cards.length!==2||S.bal<me.bet;
    $('#leave').hidden=!me;$('#leave').disabled=phase!=='bet';
  }
  function deal(i,down){
    if(shoe.length<60){shoe=mkShoe(6);log('Fresh shoe shuffled')}
    const c=shoe.pop();
    if(i==='d'){dealer.push(c);const h=$('#dh');if(h)h.appendChild(cardEl(c,down));dealerVal()}
    else{seats[i].cards.push(c);const h=$('#sh'+i);if(h)h.appendChild(cardEl(c));info(i)}
    return c;
  }
  function rotateBots(){
    seats.forEach((s,i)=>{if(s&&s.bot&&rnd()<.12)seats[i]=null});
    const empty=seats.map((s,i)=>s?-1:i).filter(i=>i>=0);
    empty.forEach(i=>{if(rnd()<.25)seats[i]={u:bot(pick(NAMES)),bot:1}});
    if(mine()<0&&!seats.includes(null)){const b=seats.findIndex(s=>s&&s.bot);if(b>=0)seats[b]=null}
    while(seats.filter(s=>s&&s.bot).length<2&&seats.includes(null)){const e=seats.map((s,i)=>s?-1:i).filter(i=>i>=0);if(mine()<0&&e.length<=1)break;seats[pick(e)]={u:bot(pick(NAMES)),bot:1}}
  }
  function settleSeat(i,silent){
    const s=seats[i];if(!s||!s.bet||s.paid)return;s.paid=1;
    const v=bjv(s.cards).t,d=bjv(dealer).t,pbj=isBJ(s.cards),dbj=isBJ(dealer);let p=0;
    if(pbj&&!dbj){p=s.bet*2.5;s.res='Blackjack';s.k='bjk'}else if(pbj&&dbj){p=s.bet;s.res='Push';s.k='p'}
    else if(v>21){s.res='Bust';s.k='l'}else if(dbj){s.res='Lose';s.k='l'}
    else if(d>21||v>d){p=s.bet*2;s.res='Win';s.k='w'}else if(v===d){p=s.bet;s.res='Push';s.k='p'}else{s.res='Lose';s.k='l'}
    if(s.me){p=r2(p);pay(p);settle('blackjack',s.bet,r2(p/s.bet),p,{quiet:true});if(!silent&&p>s.bet){toast(`+${fmt(p-s.bet)} Rodux at the blackjack table`,'win');if(s.k==='bjk')confetti(innerWidth/2,innerHeight/2,100)}}
  }
  function botDecide(s){
    const{t,soft}=bjv(s.cards),up=dealer[0].v;
    if(s.cards.length===2&&(t===10||t===11)&&up<=9&&rnd()<.8)return'd';
    if(t<=11)return'h';if(t>=17)return soft&&t===17&&up>=9?'h':'s';
    if(soft)return'h';return up>=7?'h':'s';
  }
  async function playTurn(i){
    const s=seats[i];if(isBJ(s.cards))return;
    turn=i;for(let k=0;k<N;k++)info(k);
    if(s.me){
      log('Your turn. Hit, stand or double.');
      await new Promise(res=>{act={i,res};turnEnd=performance.now()+15000;btns()});
      act=null;btns();return;
    }
    turnEnd=performance.now()+3000;
    while(alive){
      await sleep(650+rnd()*600);if(!alive)return;
      const a=botDecide(s);
      if(a==='s'){log(`${s.u.name} stands on ${bjv(s.cards).t}`);break}
      if(a==='d'){s.bet*=2;deal(i);log(`${s.u.name} doubles`);break}
      deal(i);if(bjv(s.cards).t>=21)break;
    }
  }
  async function myAction(a){
    if(!act)return;const i=act.i,s=seats[i];
    if(a==='d'){if(s.cards.length!==2||!take(s.bet))return;s.bet=r2(s.bet*2);deal(i);act.res();return}
    if(a==='s'){act.res();return}
    deal(i);turnEnd=performance.now()+15000;if(bjv(s.cards).t>=21)act.res();
  }
  $('#hit').onclick=()=>myAction('h');$('#stand').onclick=()=>myAction('s');$('#dbl').onclick=()=>myAction('d');
  $('#bbet').onclick=()=>{const m=mine();if(m<0||phase!=='bet'||seats[m].bet)return;const a=getBet();if(!take(a))return;seats[m].bet=a;info(m);btns();log('Bet placed. Cards come out when the timer ends.')};
  $('#leave').onclick=()=>{const m=mine();if(m<0||phase!=='bet')return;if(seats[m].bet)pay(seats[m].bet);seats[m]=null;drawAll();log('You left the table')};
  el.addEventListener('click',e=>{const b=e.target.closest('[data-sit]');if(!b)return;if(!S.user){openLogin();return}if(mine()>=0)return;const i=+b.dataset.sit;if(seats[i])return;seats[i]={u:me(),me:1,bet:0,cards:[]};drawAll();log('Seated. Place a bet before the timer ends.')});
  const key=e=>{if(!act||e.target.tagName==='INPUT'||$('#modal').innerHTML)return;const k=e.key.toLowerCase();if(k==='h')myAction('h');else if(k==='s')myAction('s');else if(k==='d')myAction('d')};
  document.addEventListener('keydown',key);
  function tick(){
    if(!alive)return;const now=performance.now();
    if(phase==='bet'){const l=Math.max(0,betEnd-now);const m=mine();if(m<0||seats[m].bet)log(`Bets close in ${(l/1000).toFixed(1)}s`);else log(`Place your bet · ${(l/1000).toFixed(1)}s left`)}
    if(turn>=0){const e=$('#tm'+turn);if(e){const tot=seats[turn]&&seats[turn].me?15000:3000;e.style.transform=`scaleX(${Math.max(0,(turnEnd-now)/tot)})`}
      if(act&&now>turnEnd){log('Time ran out. Standing.');act.res()}}
  }
  timer=setInterval(tick,100);
  async function loop(){
    while(alive){
      phase='bet';dealer=[];revealed=false;turn=-1;rotateBots();
      seats.forEach(s=>{if(s){s.bet=0;s.cards=[];s.res=null;s.k=null;s.paid=0}});
      const dh=$('#dh');if(dh)dh.innerHTML='';dealerVal();drawAll();
      betEnd=performance.now()+9000;
      const botBets=seats.map(s=>s&&s.bot?{at:performance.now()+800+rnd()*6500,amt:pick([10,25,50,100,250,500])}:null);
      while(alive&&performance.now()<betEnd){
        botBets.forEach((b,i)=>{if(b&&!b.done&&performance.now()>b.at&&seats[i]&&seats[i].bot){b.done=1;if(rnd()<.85){seats[i].bet=b.amt;info(i)}}});
        await sleep(120);
      }
      if(!alive)return;
      const players=seats.map((s,i)=>s&&s.bet?i:-1).filter(i=>i>=0);
      if(!players.length){log('Nobody bet this round');await sleep(1200);continue}
      phase='deal';btns();drawAll();
      for(let pass=0;pass<2;pass++){
        for(const i of players){if(!alive)return;deal(i);await sleep(230)}
        if(!alive)return;deal('d',pass===1);await sleep(260);
      }
      if(!alive)return;
      phase='turns';
      const peek=dealer[0].v>=10&&isBJ(dealer);
      if(!peek){for(const i of players){if(!alive)return;if(seats[i])await playTurn(i)}}
      if(!alive)return;
      turn=-1;for(let k=0;k<N;k++)info(k);phase='dealer';btns();
      const hole=$('#dh')&&$('#dh').children[1];if(hole)hole.classList.remove('down');revealed=true;dealerVal();log(peek?'Dealer has blackjack':'Dealer reveals');await sleep(700);
      const live=players.some(i=>seats[i]&&bjv(seats[i].cards).t<=21&&!isBJ(seats[i].cards));
      if(live&&!peek){while(alive&&bjv(dealer).t<17){deal('d');await sleep(560)}}
      if(!alive)return;
      phase='done';players.forEach(i=>{settleSeat(i);info(i)});
      log(bjv(dealer).t>21?'Dealer busts':`Dealer has ${bjv(dealer).t}`);btns();
      await sleep(3600);
    }
  }
  drawAll();loop();
  cleanup=()=>{
    alive=false;clearInterval(timer);document.removeEventListener('keydown',key);
    const m=mine();if(m<0)return;const s=seats[m];
    if(s.bet&&!s.paid){
      if(phase==='bet'){pay(s.bet)}
      else{
        while(s.cards.length<2)s.cards.push(shoe.pop());while(dealer.length<2)dealer.push(shoe.pop());
        if(act)act=null;
        if(bjv(s.cards).t<=21&&!isBJ(s.cards)&&!isBJ(dealer))while(bjv(dealer).t<17)dealer.push(shoe.pop());
        settleSeat(m,true);
      }
    }
    seats[m]=null;
  };
};

/* ---------- BACCARAT ---------- */
const BAC={road:[]};
PAGES.baccarat=el=>{
  const stakes={p:0,b:0,t:0};let busy=false,pend=null;
  el.innerHTML=head('baccarat','Back the Player, the Banker or a Tie. Player pays 2×, Banker 1.95× and Tie 9×. Player and Banker bets are returned on a tie.','98.9%')+`
  <div class="game" style="grid-template-columns:minmax(0,1fr)">
    <div class="felt" style="border:0;border-radius:0">
      <div class="shoe" aria-hidden="true"></div>
      <div class="bac-zone"><div class="bac-side"><h4>Player <span class="hv" id="pv" hidden></span></h4><div class="hand" id="ph"></div></div><div class="bac-side"><h4>Banker <span class="hv" id="bv" hidden></span></h4><div class="hand" id="bh"></div></div></div>
      <div class="bac-bets">${[['p','Player','2×'],['t','Tie','9×'],['b','Banker','1.95×']].map(([k,l,m])=>`<button class="bac-bet" data-bk="${k}"><b>${l}</b><span>Pays ${m}</span><span class="stake" id="sk${k}"></span></button>`).join('')}</div>
    </div>
    <div class="tbar">${miniAmt()}<span class="note">Click a box to add your bet amount to it.</span><span class="tlog" id="road" style="display:flex;gap:3px;flex-wrap:wrap"></span><button class="cta ghost sm" id="clr">Clear</button><button class="cta sm" id="deal">Deal</button></div>
  </div>`;
  wireBet(el);
  const bv=c=>c.i===0?1:c.i>=9?0:c.i+1,tot=cs=>cs.reduce((a,c)=>a+bv(c),0)%10;
  const drawStakes=()=>['p','b','t'].forEach(k=>{$('#sk'+k).innerHTML=stakes[k]?chip(12)+' '+fmt(stakes[k]):'';$(`[data-bk="${k}"]`).classList.toggle('on',stakes[k]>0)});
  const drawRoad=()=>{$('#road').innerHTML=BAC.road.slice(-24).map(r=>`<i style="width:14px;height:14px;border-radius:50%;display:inline-block;background:${r==='p'?'var(--blue)':r==='b'?'var(--loss)':'var(--win)'}" title="${r==='p'?'Player':r==='b'?'Banker':'Tie'}"></i>`).join('')};
  $$('.bac-bet',el).forEach(b=>b.onclick=()=>{if(busy)return;const a=getBet();if(!take(a))return;stakes[b.dataset.bk]=r2(stakes[b.dataset.bk]+a);drawStakes()});
  $('#clr').onclick=()=>{if(busy)return;const t=stakes.p+stakes.b+stakes.t;if(t)pay(t);stakes.p=stakes.b=stakes.t=0;drawStakes();$$('.bac-bet',el).forEach(b=>b.classList.remove('win'))};
  function resolve(P,B){
    const pt=tot(P),bt=tot(B),w=pt>bt?'p':bt>pt?'b':'t',st={...stakes};
    let p=0;if(w==='t'){p=st.t*9+st.p+st.b}else p=w==='p'?st.p*2:st.b*1.95;p=r2(p);
    const tb=r2(st.p+st.b+st.t);stakes.p=stakes.b=stakes.t=0;
    if(tb){pay(p);settle('baccarat',tb,r2(p/tb),p,{quiet:true});if(p>tb)toast(`+${fmt(p-tb)} Rodux on Baccarat`,'win')}
    BAC.road.push(w);return{w,pt,bt};
  }
  $('#deal').onclick=async()=>{
    if(busy)return;if(!(stakes.p+stakes.b+stakes.t)){toast('Put Rodux on Player, Banker or Tie first.');return}
    busy=true;$('#deal').disabled=true;$$('.bac-bet',el).forEach(b=>{b.classList.remove('win');b.disabled=true});
    const P=[randCard(),randCard()],B=[randCard(),randCard()];
    let p3=null;const nat=tot(P)>=8||tot(B)>=8;
    if(!nat){
      if(tot(P)<=5){p3=randCard();P.push(p3)}
      const b=tot(B),v=p3?bv(p3):null;
      const draw=p3===null?b<=5:(b<=2||(b===3&&v!==8)||(b===4&&v>=2&&v<=7)||(b===5&&v>=4&&v<=7)||(b===6&&v>=6&&v<=7));
      if(draw)B.push(randCard());
    }
    pend={P,B};
    const ph=$('#ph'),bh=$('#bh');ph.innerHTML='';bh.innerHTML='';$('#pv').hidden=$('#bv').hidden=true;
    const show=(h,v,cs,n)=>{const e=$(v);e.hidden=false;e.textContent=tot(cs.slice(0,n))};
    const order=[[ph,P,0],[bh,B,0],[ph,P,1],[bh,B,1]];if(P[2])order.push([ph,P,2]);if(B[2])order.push([bh,B,2]);
    for(const[h,cs,k] of order){if(!pend)return;h.appendChild(cardEl(cs[k]));show(h,h===ph?'#pv':'#bv',cs,k+1);await sleep(k===2?700:380)}
    if(!pend)return;pend=null;
    const r=resolve(P,B);$(`[data-bk="${r.w}"]`).classList.add('win');drawStakes();drawRoad();
    $('#road').insertAdjacentHTML('afterbegin','');
    busy=false;$('#deal').disabled=false;$$('.bac-bet',el).forEach(b=>b.disabled=false);
  };
  drawStakes();drawRoad();
  cleanup=()=>{if(pend){resolve(pend.P,pend.B);pend=null}else{const t=stakes.p+stakes.b+stakes.t;if(t)pay(t)}};
};

/* ---------- LIMBO ---------- */
const LB={hist:[]};
PAGES.limbo=el=>{
  let busy=false;
  el.innerHTML=head('limbo','Pick a target multiplier. If the roll lands at or above it, you win that multiple. Higher targets win less often.','99%')+`
  <div class="game">
    <div class="side-p">${betField()}
      <label class="fld"><span>Target multiplier</span><div class="amt"><input id="tgt" type="number" min="1.01" max="1000000" step="0.01" value="${store.get('ltgt',2)}"><b class="sfx">×</b></div></label>
      <div class="kv"><span>Win chance</span><b id="wc"></b></div>
      <div class="kv"><span>Profit on win</span><b class="w" id="pf"></b></div>
      <button class="cta" id="act">Bet</button>
    </div>
    <div class="stage center"><div style="width:100%;text-align:center"><div class="streak" id="lh" style="justify-content:center;margin-bottom:24px"></div><div class="dice-num" id="ln" style="margin:0">1.00×</div><p class="note" id="lt" style="margin-top:14px">Target 2.00×</p></div></div>
  </div>`;
  wireBet(el);
  const tg=()=>Math.max(1.01,+$('#tgt').value||2);
  const upd=()=>{const t=tg(),b=Math.floor(+$('#amt').value||0);$('#wc').textContent=(99/t).toFixed(4)+'%';$('#pf').textContent=fmt(b*t-b);$('#lt').textContent=`Target ${t.toFixed(2)}×`;store.set('ltgt',t)};
  $('#tgt').oninput=upd;$('#amt').oninput=upd;
  const drawH=()=>{$('#lh').innerHTML=LB.hist.slice(0,10).map(h=>`<span class="pill ${h.w?'w':'lo'}">${h.r.toFixed(2)}×</span>`).join('')};
  $('#act').onclick=async()=>{
    if(busy)return;const a=getBet(),t=tg();if(!take(a))return;busy=true;$('#act').disabled=true;
    const res=Math.min(1e6,Math.max(1,Math.floor(99/(1-rnd()))/100)),win=res>=t,p=win?r2(a*t):0;
    const n=$('#ln');n.className='dice-num';const t0=performance.now(),D=REDUCED?50:650;
    await new Promise(r=>{(function s(now){const q=Math.min(1,(now-t0)/D),e=1-Math.pow(1-q,3);n.textContent=(1+(res-1)*e).toFixed(2)+'×';q<1?requestAnimationFrame(s):r()})(t0)});
    if(win)pay(p);settle('limbo',a,win?t:0,p,{quiet:true});
    if(!el.isConnected)return;
    n.classList.add(win?'w':'l');LB.hist.unshift({r:res,w:win});drawH();if(win)toast(`+${fmt(p-a)} Rodux on Limbo`,'win');
    busy=false;$('#act').disabled=false;
  };
  upd();drawH();
};

/* ---------- HI-LO ---------- */
PAGES.hilo=el=>{
  let g=null;
  el.innerHTML=head('hilo','Guess whether the next card is higher or lower. Every right call multiplies your stake. Skip cards you do not like, and cash out whenever you want.','99%')+`
  <div class="game">
    <div class="side-p">${betField()}
      <button class="cta" id="start">Start game</button>
      <div class="hl-btns"><button class="cta ghost" id="hi" disabled>Higher<small id="him">—</small></button><button class="cta ghost" id="lo" disabled>Lower<small id="lom">—</small></button></div>
      <button class="cta ghost" id="skip" disabled>Skip card</button>
      <div class="kv"><span>Multiplier</span><b id="hm">1.00×</b></div>
      <div class="kv"><span>Payout</span><b class="w" id="hp">—</b></div>
    </div>
    <div class="stage"><div class="hilo"><div class="bigcard" id="hc"></div><div class="hl-row" id="hr"></div></div><div id="res"></div></div>
  </div>`;
  wireBet(el);
  const opts=c=>c.i===0?[{k:'hi',l:'Higher',p:12/13,f:n=>n.i>c.i},{k:'lo',l:'Same',p:1/13,f:n=>n.i===c.i}]:c.i===12?[{k:'hi',l:'Same',p:1/13,f:n=>n.i===c.i},{k:'lo',l:'Lower',p:12/13,f:n=>n.i<c.i}]:[{k:'hi',l:'Higher or same',p:(13-c.i)/13,f:n=>n.i>=c.i},{k:'lo',l:'Lower or same',p:(c.i+1)/13,f:n=>n.i<=c.i}];
  function show(card,anim){const h=$('#hc');h.innerHTML='';const e=cardEl(card,false,!anim);h.appendChild(e)}
  function ui(){
    const on=g&&!g.over;const o=g?opts(g.card):null;
    $('#hi').disabled=$('#lo').disabled=$('#skip').disabled=!on;
    if(o){$('#hi').firstChild.textContent=o[0].l;$('#lo').firstChild.textContent=o[1].l;$('#him').textContent=(Math.floor(.99/o[0].p*100)/100).toFixed(2)+'×';$('#lom').textContent=(Math.floor(.99/o[1].p*100)/100).toFixed(2)+'×'}
    $('#hm').textContent=(g?g.m:1).toFixed(2)+'×';$('#hp').textContent=g&&!g.over?fmt(g.bet*g.m):'—';
    const s=$('#start');if(on){s.textContent=g.steps?`Cash out ${fmt(g.bet*g.m)}`:'Make a guess';s.className=g.steps?'cta gold':'cta';s.disabled=!g.steps}else{s.textContent='Start game';s.className='cta';s.disabled=false}
    lockBet(on,el);
  }
  function end(win){
    g.over=true;const p=win?r2(g.bet*g.m):0;if(win)pay(p);settle('hilo',g.bet,win?r2(g.m):0,p);
    $('#res').innerHTML=win?resultBox(g.m.toFixed(2)+'×','+'+fmt(p)+' Rodux'):'';ui();
  }
  async function guess(k){
    if(!g||g.over||g.busy)return;g.busy=true;const o=opts(g.card).find(x=>x.k===k),n=randCard();
    const prev=g.card;$('#hr').insertAdjacentHTML('beforeend',cardHTML(prev));
    g.card=n;show(n,true);await sleep(380);g.busy=false;
    if(o.f(n)){g.m=r2(g.m*Math.floor(.99/o.p*100)/100);g.steps++;ui()}else{$('#hc .pc').style.boxShadow='0 0 0 3px var(--loss)';end(false)}
  }
  $('#start').onclick=()=>{
    if(g&&!g.over){if(g.steps)end(true);return}
    const a=getBet();if(!take(a))return;$('#res').innerHTML='';$('#hr').innerHTML='';
    g={bet:a,m:1,steps:0,card:randCard(),over:false};show(g.card,true);ui();
  };
  $('#hi').onclick=()=>guess('hi');$('#lo').onclick=()=>guess('lo');
  $('#skip').onclick=async()=>{if(!g||g.over||g.busy)return;$('#hr').insertAdjacentHTML('beforeend',cardHTML(g.card,'skip'));g.card=randCard();show(g.card,true);ui()};
  show(randCard(),false);ui();
  cleanup=()=>{if(g&&!g.over){if(g.steps){const p=r2(g.bet*g.m);pay(p);settle('hilo',g.bet,g.m,p)}else pay(g.bet)}};
};

/* ---------- KENO ---------- */
const KENO_RISK={low:{th:n=>Math.max(1,Math.floor(n/3)),base:2},med:{th:n=>Math.max(1,Math.ceil(n/2)),base:3},high:{th:n=>Math.max(1,Math.ceil(n*.6)),base:4.5}};
const comb=(n,k)=>{if(k<0||k>n)return 0;let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return r};
function kenoTable(n,risk){
  const R=KENO_RISK[risk],P=[],W=[];let ev=0;
  for(let k=0;k<=n;k++){P[k]=comb(n,k)*comb(40-n,10-k)/comb(40,10);W[k]=k>=R.th(n)?Math.pow(R.base,k):0;ev+=P[k]*W[k]}
  return W.map(w=>Math.floor(w*.97/ev*100)/100);
}
PAGES.keno=el=>{
  const sel=new Set();let risk=store.get('krisk','med'),busy=false;
  el.innerHTML=head('keno','Pick up to 10 numbers. Ten balls are drawn from 40. The more of your numbers hit, the bigger the payout.','97%')+`
  <div class="game">
    <div class="side-p">${betField()}
      <div class="fld"><span>Risk</span>${seg('kr',[['low','Low'],['med','Medium'],['high','High']],risk)}</div>
      <div style="display:flex;gap:8px"><button class="cta ghost grow" id="auto">Auto pick</button><button class="cta ghost grow" id="clr">Clear</button></div>
      <button class="cta" id="act">Bet</button>
      <div class="kv"><span>Picked</span><b id="kc">0 / 10</b></div>
    </div>
    <div class="stage center"><div style="display:grid;place-items:center;width:100%"><div class="keno" id="kg">${Array.from({length:40},(_,i)=>`<button class="kn" data-n="${i+1}">${i+1}</button>`).join('')}</div><div class="paytab" id="kp"></div></div></div>
  </div>`;
  wireBet(el);
  let hits=-1;
  function pt(){
    $('#kc').textContent=sel.size+' / 10';
    if(!sel.size){$('#kp').innerHTML='<p class="note">Pick numbers to see the payout table.</p>';return}
    const t=kenoTable(sel.size,risk);$('#kp').innerHTML=t.map((m,k)=>`<div class="${k===hits?'on':''}"><b>${m?m+'×':'—'}</b><span>${k} hit${k===1?'':'s'}</span></div>`).join('');
  }
  const reset=()=>$$('.kn',el).forEach(b=>{b.className='kn'+(sel.has(+b.dataset.n)?' sel':'')});
  $('#kg').onclick=e=>{const b=e.target.closest('.kn');if(!b||busy)return;const n=+b.dataset.n;if(sel.has(n))sel.delete(n);else if(sel.size<10)sel.add(n);else return toast('Ten numbers is the maximum.');hits=-1;reset();pt()};
  $('#auto').onclick=()=>{if(busy)return;const want=sel.size||10;sel.clear();shuffle(Array.from({length:40},(_,i)=>i+1)).slice(0,want).forEach(n=>sel.add(n));hits=-1;reset();pt()};
  $('#clr').onclick=()=>{if(busy)return;sel.clear();hits=-1;reset();pt()};
  wireSeg($('#kr'),v=>{risk=v;store.set('krisk',v);pt()});
  $('#act').onclick=async()=>{
    if(busy)return;if(!sel.size){toast('Pick at least one number.');return}const a=getBet();if(!take(a))return;
    busy=true;$('#act').disabled=true;hits=0;reset();pt();
    const drawn=shuffle(Array.from({length:40},(_,i)=>i+1)).slice(0,10);
    for(const n of drawn){if(!el.isConnected)break;const b=$(`.kn[data-n="${n}"]`,el);if(sel.has(n)){hits++;b.className='kn hit'}else b.className='kn draw';pt();await sleep(REDUCED?20:150)}
    if(!el.isConnected){const h=drawn.filter(n=>sel.has(n)).length,m=kenoTable(sel.size,risk)[h];pay(r2(a*m));settle('keno',a,m,r2(a*m),{quiet:true});return}
    const m=kenoTable(sel.size,risk)[hits],p=r2(a*m);pay(p);settle('keno',a,m,p,{quiet:true});if(p>a)toast(`${hits} hits. +${fmt(p-a)} Rodux`,'win');
    busy=false;$('#act').disabled=false;
  };
  pt();
};

/* ---------- WHEEL ---------- */
const WCOL={0:'#2A3B4C',1.2:'#8C9BB0',1.5:'#1FCB6B',1.7:'#3D8BFD',2:'#A26BFA',3:'#F2B33D',4:'#F07A3D',29.4:'#F04D5E'};
function wheelSegs(risk){
  const spec={low:[[1.2,12],[1.5,10],[0,8]],med:[[0,15],[1.5,7],[1.7,3],[2,2],[3,2],[4,1]],high:[[0,29],[29.4,1]]}[risk];
  const zeros=[],rest=[];spec.forEach(([m,c])=>{for(let i=0;i<c;i++)(m===0?zeros:rest).push(m)});
  const out=[];let a=0,b=0;
  for(let i=0;i<30;i++){const wantRest=rest.length&&(b/(rest.length)<=a/Math.max(1,zeros.length));if((wantRest&&b<rest.length)||a>=zeros.length)out.push(rest[b++]);else out.push(zeros[a++])}
  return out;
}
PAGES.wheel=el=>{
  let risk=store.get('wrisk','med'),busy=false,rot=0;const last=[];
  el.innerHTML=head('wheel','Spin the wheel. Wherever the pointer stops is your multiplier. Higher risk wheels have fewer winning slices, but bigger ones.','98%')+`
  <div class="game">
    <div class="side-p">${betField()}<div class="fld"><span>Risk</span>${seg('wr',[['low','Low'],['med','Medium'],['high','High']],risk)}</div><button class="cta" id="act">Spin</button></div>
    <div class="stage center"><div style="display:grid;place-items:center;width:100%"><div class="streak" id="wl" style="justify-content:center;margin-bottom:14px"></div><div class="wg"><i class="wptr"></i><svg id="wsvg" viewBox="-110 -110 220 220"></svg><div class="wctr" id="wc">—</div></div><div class="wlegend" id="wlg"></div></div></div>
  </div>`;
  wireBet(el);
  let segs=wheelSegs(risk);
  function draw(){
    const n=segs.length,a=2*Math.PI/n;
    $('#wsvg').innerHTML=segs.map((m,i)=>{const s=i*a-Math.PI/2,e=s+a,R=100,r=64,p=(x,y)=>`${(x).toFixed(2)} ${(y).toFixed(2)}`;
      return `<path d="M${p(R*Math.cos(s),R*Math.sin(s))}A${R} ${R} 0 0 1 ${p(R*Math.cos(e),R*Math.sin(e))}L${p(r*Math.cos(e),r*Math.sin(e))}A${r} ${r} 0 0 0 ${p(r*Math.cos(s),r*Math.sin(s))}Z" fill="${WCOL[m]}" stroke="var(--bg)" stroke-width="1.2"/>`}).join('')+`<circle r="104" fill="none" stroke="var(--surface-2)" stroke-width="6"/>`;
    const u=[...new Set(segs)].sort((x,y)=>x-y);$('#wlg').innerHTML=u.map(m=>`<span><i style="background:${WCOL[m]}"></i>${m.toFixed(2)}× · ${segs.filter(x=>x===m).length}/${segs.length}</span>`).join('');
  }
  wireSeg($('#wr'),v=>{if(busy)return;risk=v;store.set('wrisk',v);segs=wheelSegs(risk);draw()});
  $('#act').onclick=async()=>{
    if(busy)return;const a=getBet();if(!take(a))return;busy=true;$('#act').disabled=true;$$('#wr button').forEach(b=>b.disabled=true);
    const k=Math.floor(rnd()*segs.length),seg=360/segs.length,m=segs[k],p=r2(a*m);
    const target=360-(k*seg+seg/2)+(rnd()-.5)*seg*.7;rot=rot-(rot%360)+360*5+target;$('#wsvg').style.transform=`rotate(${rot}deg)`;$('#wc').textContent='…';
    pend={a,m,p};await sleep(REDUCED?200:4600);if(!pend)return;pend=null;
    pay(p);settle('wheel',a,m,p,{quiet:true});
    if(!el.isConnected)return;
    $('#wc').textContent=m.toFixed(2)+'×';$('#wc').style.color=m>=1?'var(--win)':'var(--loss)';if(p>a)toast(`+${fmt(p-a)} Rodux on Wheel`,'win');
    last.unshift(m);last.length=Math.min(last.length,12);$('#wl').innerHTML=last.map(x=>`<span class="pill" style="color:${WCOL[x]==='#2A3B4C'?'var(--dim)':WCOL[x]}">${x.toFixed(2)}×</span>`).join('');
    busy=false;$('#act').disabled=false;$$('#wr button').forEach(b=>b.disabled=false);
  };
  let pend=null;draw();
  cleanup=()=>{if(pend){const{a,m,p}=pend;pend=null;pay(p);settle('wheel',a,m,p,{quiet:true})}};
};
