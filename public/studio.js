'use strict';
/* =========================================================
   Studio games: slots and casino games from LuckyStreak's studios, played with Rodux.

   The server holds the Rodux for these games (a seamless wallet, see provider.js). The page lists
   the games, starts one in a full-screen player, and mirrors each bet, win and refund into the
   balance shown in the header. When studio games are not switched on, the Slots page shows
   TradeBlacket's own slots as before.
   ========================================================= */
const STUDIO={list:null,at:0,studio:'all',q:''};
async function studioLoad(force){
  if(!WAPI.live)return null;
  if(STUDIO.list&&!force&&Date.now()-STUDIO.at<5*60e3)return STUDIO.list;
  const r=await api('/api/games');STUDIO.list=r.ok?r.j:{enabled:false,games:[]};STUDIO.at=Date.now();return STUDIO.list;
}
// Mirror studio-game bets, wins and refunds into the play balance, once each.
function studioSync(me,fresh){
  if(!me||!me.studio)return;
  S.seenRefs=S.seenRefs||[];const seen=new Set(S.seenRefs);
  for(const t of me.studio.slice().reverse()){
    const ref='ls:'+t.tx_id;if(seen.has(ref))continue;seen.add(ref);S.seenRefs.push(ref);
    if(fresh)continue;
    if(t.kind==='debit')setBal(S.bal-t.amount);else if(t.amount>0)pay(t.amount);
  }
  S.seenRefs=S.seenRefs.slice(-400);save();
}
{const base=syncMe;syncMe=async function(){const before=S.seenFor,me=await base();if(me)studioSync(me,before!==me.robloxId);return me}}

const studioTile=g=>`<button class="st-tile" data-sg="${esc(g.id)}" title="${esc(g.name)}"><span class="st-art">${g.img?`<img src="${esc(g.img)}" alt="" loading="lazy" decoding="async">`:`<b>${esc(g.name.slice(0,1))}</b>`}<i class="st-play">${ic('play',22,2.2)}</i></span><span class="st-meta"><b>${esc(g.name)}</b><small>${esc(g.studio)}</small></span></button>`;

{const own=PAGES.slots;PAGES.slots=(el,p)=>{
  el.innerHTML='<div class="inv-load"><div class="spin"></div></div>';
  studioLoad().then(L=>{
    if(!el.isConnected)return;
    if(!L||!L.enabled||!L.games.length){own(el,p);return}
    const studios=[...new Set(L.games.map(g=>g.studio))].sort();
    el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Casino</button> / Slots</div><h2>Slots</h2><p>${fmt0(L.games.length)} games from ${studios.length} studio${studios.length>1?'s':''}, played with your Rodux balance.</p></div>
      <label class="inv-search st-search">${ic('search',16)}<input id="sq" placeholder="Search games" autocomplete="off" value="${esc(STUDIO.q)}"></label></div>
      <div class="st-chips" id="sch"><button data-st="all">All studios</button>${studios.map(s=>`<button data-st="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <div class="st-grid" id="sgr"></div>`;
    const draw=()=>{
      $$('[data-st]',el).forEach(b=>b.classList.toggle('on',b.dataset.st===STUDIO.studio));
      const q=STUDIO.q.toLowerCase(),G=L.games.filter(g=>(STUDIO.studio==='all'||g.studio===STUDIO.studio)&&(!q||g.name.toLowerCase().includes(q)||g.studio.toLowerCase().includes(q)));
      $('#sgr',el).innerHTML=G.length?G.map(studioTile).join(''):'<div class="empty" style="grid-column:1/-1"><h3>No games found</h3><p>Try another search or studio.</p></div>';
    };
    $('#sq',el).oninput=e=>{STUDIO.q=e.target.value.trim();draw()};
    $('#sch',el).onclick=e=>{const b=e.target.closest('[data-st]');if(b){STUDIO.studio=b.dataset.st;draw()}};
    draw();
  });
}}
document.addEventListener('click',e=>{const t=e.target.closest('[data-sg]');if(t)playStudio(t.dataset.sg)});

async function playStudio(id){
  if(!S.user){openLogin();return}
  if(typeof lockReason==='function'){const why=lockReason();if(why){toast(why,'loss');return}}
  if(typeof accepted==='function'&&!accepted('tos')){needTos();return}
  const g=(STUDIO.list&&STUDIO.list.games||[]).find(x=>x.id===id)||{name:'Game',studio:''};
  const host=document.createElement('div');host.className='st-player';host.setAttribute('role','dialog');host.setAttribute('aria-label',g.name);
  host.innerHTML=`<div class="st-bar"><button class="ib" id="spx" aria-label="Close game">${WI.back}</button><div class="st-t"><b>${esc(g.name)}</b><small>${esc(g.studio)}</small></div><div class="st-bal">${chip(16)}<span id="spb">${fmt(S.bal)}</span></div></div><div class="st-frame"><div class="inv-load"><div class="spin"></div></div></div>`;
  document.body.appendChild(host);document.body.classList.add('st-open');
  let poll=0;const close=()=>{clearInterval(poll);host.remove();document.body.classList.remove('st-open');syncMe();document.removeEventListener('keydown',esc_)};
  const esc_=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',esc_);
  $('#spx',host).onclick=close;
  const r=await api('/api/games/launch',{gameId:id,mobile:innerWidth<760});
  if(!host.isConnected)return;
  if(!r.ok){close();toast(r.j.error||'The game could not be started.','loss');return}
  const f=$('.st-frame',host);f.innerHTML=`<iframe src="${esc(r.j.url)}" title="${esc(g.name)}" allow="autoplay; fullscreen" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
  poll=setInterval(async()=>{await syncMe();const b=$('#spb',host);if(b)b.textContent=fmt(S.bal)},4000);
}
