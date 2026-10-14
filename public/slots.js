'use strict';
/* =========================================================
   Slots — one 5×3, 243-ways engine, three original machines
   ========================================================= */
const SL={
  syms:['T','J','Q','K','A','H1','H2','H3','H4','W','S'],
  weights:[[12,12,10,10,8,4,4,3,3,0,2],[12,12,10,10,8,4,4,3,3,3,2],[12,12,10,10,8,4,4,3,3,3,2],[12,12,10,10,8,4,4,3,3,3,2],[12,12,10,10,8,4,4,3,3,0,2]],
  lines:[[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[1,0,1,2,1]],
  pay:{T:[5,10,50],J:[5,10,50],Q:[5,15,75],K:[10,20,100],A:[10,25,125],H1:[15,40,200],H2:[20,50,250],H3:[25,75,400],H4:[30,100,750],W:[50,200,1000]},
  scatter:{3:[2,8],4:[10,12],5:[50,15]},
  scale:.95
};
SL.build=()=>{let seed=20261014;const r=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;SL.strips=SL.weights.map(w=>{const s=[];w.forEach((n,i)=>{for(let k=0;k<n;k++)s.push(SL.syms[i])});for(let i=s.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[s[i],s[j]]=[s[j],s[i]]}return s})};
SL.build();
function slSpin(){return SL.strips.map(st=>{const p=Math.floor(rnd()*st.length);return[0,1,2].map(r=>st[(p+r)%st.length])})}
function slEval(grid,bet){
  const wins=[],coin=bet/25;let total=0;
  ['H4','H3','H2','H1','A','K','Q','J','T'].forEach(sym=>{
    let n=0,ways=1;const cells=[];
    for(let c=0;c<5;c++){const hit=[];grid[c].forEach((x,r)=>{if(x===sym||x==='W')hit.push([c,r])});if(!hit.length)break;ways*=hit.length;n++;cells.push(...hit)}
    if(n>=3){const w=SL.pay[sym][n-3]*ways*coin*SL.scale;total+=w;wins.push({sym,n,ways,cells,w})}
  });
  const sc=[];grid.forEach((col,c)=>col.forEach((x,r)=>{if(x==='S')sc.push([c,r])}));
  let fs=0;if(sc.length>=3){const k=Math.min(5,sc.length),[m,f]=SL.scatter[k];const w=m*bet;total+=w;fs=f;wins.push({scatter:1,cells:sc,w})}
  return{total,wins,fs};
}
/* symbol art per machine */
const rankSym=(ch,c1,c2)=>`<svg viewBox="0 0 64 64" aria-hidden="true"><text x="32" y="46" text-anchor="middle" font-family="Rubik,Arial Black,sans-serif" font-size="${ch.length>1?30:38}" font-weight="800" fill="${c1}" stroke="${c2}" stroke-width="3" paint-order="stroke">${ch}</text></svg>`;
const wildTag=(inner,c)=>`<svg viewBox="0 0 64 64" aria-hidden="true">${inner}<rect x="8" y="44" width="48" height="14" rx="4" fill="${c}"/><text x="32" y="55" text-anchor="middle" font-family="Rubik,Arial,sans-serif" font-size="11" font-weight="800" fill="#fff">WILD</text></svg>`;
const MACHINES={
  vault:{n:'Vault Breaker',d:'Gold bars, Rodux stacks and a safe that pays big.',bg:'linear-gradient(160deg,#1F3A5A,#0E1B2B)',tag:'High volatility',
    low:['#9DB4CC','#2A4766'],
    sym:{
      H1:`<svg viewBox="0 0 64 64"><path d="M10 44l6-14h32l6 14z" fill="#F2B33D"/><path d="M16 30l5-10h22l5 10z" fill="#FFD27A"/><path d="M10 44h44v6H10z" fill="#B47B12"/></svg>`,
      H2:`<svg viewBox="0 0 64 64"><ellipse cx="32" cy="46" rx="20" ry="7" fill="#9E1B32"/><rect x="12" y="34" width="40" height="12" fill="#D63A4F"/><ellipse cx="32" cy="34" rx="20" ry="7" fill="#F04D5E"/><rect x="12" y="24" width="40" height="10" fill="#2A6FD6"/><ellipse cx="32" cy="24" rx="20" ry="7" fill="#3D8BFD"/><ellipse cx="32" cy="24" rx="10" ry="3.5" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="3 3"/></svg>`,
      H3:`<svg viewBox="0 0 64 64"><circle cx="22" cy="24" r="12" fill="none" stroke="#F2B33D" stroke-width="6"/><path d="M31 31l22 22M44 44l5-5M49 49l5-5" stroke="#F2B33D" stroke-width="6" stroke-linecap="round"/></svg>`,
      H4:`<svg viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="48" rx="6" fill="#3B4F66"/><rect x="12" y="12" width="40" height="40" rx="4" fill="#556E8A"/><circle cx="32" cy="32" r="12" fill="#1B2A3A"/><circle cx="32" cy="32" r="8" fill="none" stroke="#F2B33D" stroke-width="3"/><path d="M32 22v6M32 36v6M22 32h6M36 32h6" stroke="#F2B33D" stroke-width="2.5"/></svg>`,
      W:wildTag(`<circle cx="32" cy="26" r="20" fill="#1FCB6B"/><circle cx="32" cy="26" r="12" fill="#03200E"/><path d="M32 14v6M32 32v6M20 26h6M38 26h6" stroke="#1FCB6B" stroke-width="3"/>`,'#0E7A3E'),
      S:`<svg viewBox="0 0 64 64"><path d="M20 22c0-6 24-6 24 0l8 26a6 6 0 0 1-6 8H18a6 6 0 0 1-6-8z" fill="#7A4FD8"/><path d="M22 18h20l-4-8H26z" fill="#A26BFA"/><path d="M32 30l7 7-7 9-7-9z" fill="#E7EEF5"/></svg>`
    }},
  neon:{n:'Neon Fruits',d:'Classic fruit reels with a free spins bell.',bg:'linear-gradient(160deg,#3A1650,#140A24)',tag:'Medium volatility',
    low:['#F09AE0','#5A1C6E'],
    sym:{
      H1:`<svg viewBox="0 0 64 64"><path d="M30 12c4 8 10 14 18 16M30 12c-2 8-6 14-12 18" stroke="#3FBF6A" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="20" cy="40" r="12" fill="#F04D5E"/><circle cx="44" cy="40" r="12" fill="#D63A4F"/><circle cx="16" cy="36" r="3" fill="#fff" opacity=".6"/></svg>`,
      H2:`<svg viewBox="0 0 64 64"><ellipse cx="32" cy="34" rx="22" ry="16" fill="#F2D23D"/><ellipse cx="32" cy="34" rx="22" ry="16" fill="none" stroke="#C9A812" stroke-width="2"/><path d="M50 30l6-4M14 38l-6 4" stroke="#F2D23D" stroke-width="4" stroke-linecap="round"/><ellipse cx="24" cy="28" rx="6" ry="3" fill="#fff" opacity=".5"/></svg>`,
      H3:`<svg viewBox="0 0 64 64"><path d="M32 8v8" stroke="#3FBF6A" stroke-width="3"/>${[[24,22],[40,22],[32,22],[20,32],[32,32],[44,32],[26,42],[38,42],[32,52]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="7" fill="#8B4FD8" stroke="#5B2BA0" stroke-width="1.5"/>`).join('')}</svg>`,
      H4:rankSym('7','#F04D5E','#FFD27A'),
      W:wildTag(`<path d="M32 4l7 15 16 2-12 11 3 16-14-8-14 8 3-16L9 21l16-2z" fill="#F2B33D"/>`,'#B42F8C'),
      S:`<svg viewBox="0 0 64 64"><path d="M32 8a4 4 0 0 1 4 4v2c10 2 14 10 14 20v8l6 6H8l6-6v-8c0-10 4-18 14-20v-2a4 4 0 0 1 4-4z" fill="#F2B33D"/><circle cx="32" cy="54" r="5" fill="#B47B12"/><path d="M22 26c2-5 6-7 10-7" stroke="#fff" stroke-width="3" opacity=".5" fill="none" stroke-linecap="round"/></svg>`
    }},
  empire:{n:'Empire Crown',d:'TradeBlacket collectibles on the reels. Crowns pay the most.',bg:'linear-gradient(160deg,#5A1424,#1E0810)',tag:'Medium volatility',
    low:['#F2C9A0','#5A2414'],
    sym:{H1:null,H2:null,H3:null,H4:null,W:null,S:null}}
};
function machineSym(mid,s){
  const M=MACHINES[mid];
  if(['T','J','Q','K','A'].includes(s))return rankSym(s==='T'?'10':s,M.low[0],M.low[1]);
  if(mid==='empire'){const map={H1:'eblade',H2:'shalo',H3:'gwings',H4:'mcrown',S:'ehelm'};if(s==='W')return wildTag(itemSvg('dtrophy').replace('<svg class="art"','<g').replace('</svg>','</g>').replace(/viewBox="0 0 64 64"/,''),'#B4283F');return itemSvg(map[s])}
  return M.sym[s];
}
PAGES.slots=el=>{
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Casino</button> / Slots</div><h2>Slots</h2><p>Three original machines on the same 5-reel, 243-ways engine. Wilds land on the middle reels, and three or more scatters anywhere start free spins with doubled wins.</p></div><span class="rtp">${ic('shield',14,2)} RTP 96%</span></div>
  <div class="slot-lobby">${Object.entries(MACHINES).map(([k,M])=>`<button class="slot-card" data-go="slot" data-p="${k}" style="background:${M.bg}"><span class="sym">${['H4','W','S'].map(s=>machineSym(k,s)).join('')}</span><b>${M.n}</b><span>${M.d}</span><span style="margin-top:8px"><span class="tag" style="background:#0005;color:#fff">${M.tag}</span></span></button>`).join('')}</div>
  <div class="sec-h"><h3 class="sec">How the reels pay</h3></div>
  <div class="card"><p class="muted" style="margin:0">Wins pay left to right on adjacent reels, starting from the first reel. A symbol can sit in any row, so there are 243 ways to win on every spin. Two matching symbols in one column double that way's count. Wilds appear on reels 2 to 4 and stand in for every symbol except the scatter. Three, four or five scatters pay 2×, 10× or 50× your total bet and start 8, 12 or 15 free spins. Free spin wins are doubled and free spins can retrigger.</p></div>`;
};
PAGES.slot=(el,mid)=>{
  if(!MACHINES[mid])mid='vault';const M=MACHINES[mid];
  let pendS=null,grid=slSpin(),busy=false,auto=0,fs=0,fsWin=0,turbo=store.get('turbo',false),stopReq=false,alive=true;
  el.innerHTML=`<button class="back" data-go="slots">${ic('back',16)} Slots</button>
  <div class="ghead"><div><h2>${M.n}</h2><p>${M.d}</p></div><span class="rtp">${ic('shield',14,2)} RTP 96% · ${M.tag}</span></div>
  <section class="machine" style="background:${M.bg}">
    <div class="reels5" id="reels">${[0,1,2,3,4].map(c=>`<div class="rcol5" id="rc${c}"><div class="strip"></div></div>`).join('')}</div>
    <div id="wm"></div>
    <div class="slot-bar">
      ${miniAmt('amt')}
      <div class="slot-info"><div><span>Ways</span><b>243</b></div><div><span>Last win</span><b id="lw">0.00</b></div><div id="fsbox" hidden><span>Free spins</span><b id="fsn">0</b></div></div>
      <button class="sbtn${turbo?' on':''}" id="turbo">Turbo</button>
      <select class="sbtn" id="autos" aria-label="Autoplay"><option value="0">Auto off</option><option value="10">Auto 10</option><option value="25">Auto 25</option><option value="50">Auto 50</option></select>
      <button class="spinbtn" id="spin" aria-label="Spin"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/></svg></button>
    </div>
  </section>
  <div class="sec-h"><h3 class="sec">Paytable</h3><span class="note">Pays per way, as a multiple of your total bet</span></div>
  <div class="paytable">${['H4','H3','H2','H1','A','K','Q','J','T'].map(s=>`<div class="pt">${machineSym(mid,s)}<div>${[5,4,3].map((n,i)=>`<b>${n} in a row</b> ${(SL.pay[s][2-i]*SL.scale/25).toFixed(2)}×`).join('<br>')}</div></div>`).join('')}
  <div class="pt">${machineSym(mid,'W')}<div><b>Wild</b><br>Reels 2, 3 and 4<br>Stands in for all but scatter</div></div>
  <div class="pt">${machineSym(mid,'S')}<div><b>Scatter</b><br>3, 4, 5 pay 2×, 10×, 50×<br>8, 12, 15 free spins</div></div></div>`;
  wireBet(el);
  const cols=[0,1,2,3,4].map(c=>$('#rc'+c));
  const cell=s=>`<div class="cell">${machineSym(mid,s)}</div>`;
  const paint=()=>cols.forEach((c,i)=>{const st=c.querySelector('.strip');st.style.transition='none';st.style.transform='none';st.innerHTML=grid[i].map(cell).join('')});
  paint();
  
  $('#turbo').onclick=()=>{turbo=!turbo;store.set('turbo',turbo);$('#turbo').classList.toggle('on',turbo)};
  $('#autos').onchange=e=>{auto=+e.target.value;if(auto&&!busy)spin()};
  function spinReels(next){
    return Promise.all(cols.map((c,i)=>new Promise(res=>{
      const st=c.querySelector('.strip'),k=turbo?6:14+i*3,mid_=Array.from({length:k},()=>SL.strips[i][Math.floor(rnd()*SL.strips[i].length)]);
      const syms=[...next[i],...mid_,...grid[i]],len=syms.length;
      st.style.transition='none';st.innerHTML=syms.map(cell).join('');st.style.transform=`translateY(${-(len-3)/len*100}%)`;void st.offsetWidth;
      const d=REDUCED?120:(turbo?380+i*90:850+i*230);c.classList.add('spin');
      st.style.transition=`transform ${d}ms cubic-bezier(.25,.7,.3,1.06)`;st.style.transform='translateY(0)';
      setTimeout(()=>{c.classList.remove('spin');st.style.transition='none';st.innerHTML=next[i].map(cell).join('');st.style.transform='none';res()},d+30);
    })));
  }
  function showWin(res,bet){
    const cells=new Set();res.wins.forEach(w=>w.cells.forEach(([c,r])=>cells.add(c+'-'+r)));
    cols.forEach((c,ci)=>$$('.cell',c).forEach((e,ri)=>{e.classList.toggle('win',cells.has(ci+'-'+ri));e.classList.toggle('dim',cells.size>0&&!cells.has(ci+'-'+ri))}));
    const wm=$('#wm');
    if(res.total>0){const big=res.total>=bet*10;wm.innerHTML=`<div class="winmsg"><b>${fmt(res.total)}</b><span>${big?'Big win':res.wins.length>1?res.wins.length+' winning lines':'Win'}</span></div>`;if(big){const b=$('#reels').getBoundingClientRect();confetti(b.left+b.width/2,b.top+b.height/2,140)}setTimeout(()=>{if(wm.isConnected)wm.innerHTML=''},turbo?900:1600)}
  }
  async function spin(){
    if(busy||!alive)return;
    const bet=Math.floor(+$('#amt').value||0),free=fs>0;
    if(!free&&!take(bet)){auto=0;$('#autos').value='0';return}
    S.lastBet=bet;busy=true;$('#spin').disabled=!auto;$('#spin').classList.toggle('stop',!!auto);
    $$('.cell',$('#reels')).forEach(e=>e.classList.remove('win','dim'));
    const next=slSpin();pendS={next,bet,free};await spinReels(next);if(!alive)return;pendS=null;grid=next;
    let res=slEval(grid,bet);let win=res.total*(free?2:1);
    if(free){fs--;fsWin+=win}
    if(res.fs){fs+=res.fs;$('#fsbox').hidden=false;$('#reels').insertAdjacentHTML('beforeend',`<div class="fs-banner" id="fsb"><div><b>${res.fs} free spins</b><span style="color:#fff">Wins are doubled</span></div></div>`);setTimeout(()=>{const b=$('#fsb');if(b)b.remove()},1600)}
    if(win>0)pay(r2(win));
    settle('slots',free?0:bet,free?0:r2(win/bet),r2(win),{quiet:true});
    $('#lw').textContent=fmt(win);$('#fsn').textContent=fs;$('#fsbox').hidden=!fs;
    showWin({...res,total:win},bet);
    if(win>=bet*3)toast(`+${fmt(win)} Rodux on ${M.n}`,'win');
    if(!free&&fs===0&&fsWin){fsWin=0}
    busy=false;$('#spin').disabled=false;
    if(fs>0||auto>0){if(!fs&&auto>0){auto--;if(!auto){$('#autos').value='0'}}await sleep(res.fs?1800:turbo?250:650);if(alive&&(fs>0||auto>0))spin();else $('#spin').classList.remove('stop')}
    else $('#spin').classList.remove('stop');
  }
  $('#spin').onclick=()=>{if(auto&&busy){auto=0;$('#autos').value='0';$('#spin').classList.remove('stop');return}if(auto&&!busy){auto=0;$('#autos').value='0';return}spin()};
  const key=e=>{if(e.code==='Space'&&e.target.tagName!=='INPUT'&&e.target.tagName!=='SELECT'&&!$('#modal').innerHTML){e.preventDefault();spin()}};document.addEventListener('keydown',key);
  cleanup=()=>{alive=false;document.removeEventListener('keydown',key);
    if(pendS){const r=slEval(pendS.next,pendS.bet),w=r2(r.total*(pendS.free?2:1));if(pendS.free)fs--;fs+=r.fs;if(w>0)pay(w);settle('slots',pendS.free?0:pendS.bet,pendS.free?0:r2(w/pendS.bet),w,{quiet:true});pendS=null}
    while(fs>0){const r=slEval(slSpin(),S.lastBet);const w=r2(r.total*2);fs--;fs+=r.fs;if(w>0){pay(w);settle('slots',0,0,w,{quiet:true})}}};
};
