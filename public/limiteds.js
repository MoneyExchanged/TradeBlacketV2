'use strict';
/* =========================================================
   Trade Empire limiteds: the inventory wallet and item coinflips.

   Live: items are read from the player's Trade Empire save and moved by the server
   (items.js), only while the player is out of the game. Coinflips are player against player;
   the site never creates or destroys an item.
   Preview: a small simulated inventory and two simulated opponents.
   ========================================================= */
const LTD={view:'site',sort:'hi',q:'',sel:new Set(),data:{site:null,game:null},busy:false};
const HEX=(s=16)=>`<svg class="hexi" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2l8.5 4.9v9.8L12 21.8l-8.5-4.9V7.1z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><rect x="8.6" y="8.6" width="6.8" height="6.8" rx="1.2" fill="currentColor"/></svg>`;
const ltdPic=x=>x.img?`<img src="${esc(x.img)}" alt="" loading="lazy">`:itemSvg(x.art||'mcrown');
const fmtV=n=>Math.round(n).toLocaleString('en-US');

/* ---------- preview data ---------- */
function ltdDemo(){
  if(!S.ltd){
    const pick=[['ecrown',7],['dtrophy',33],['rwings',79],['ihalo',197],['ehelm',3147],['mcrown',1734],['gwings',2531],['shalo',20984]];
    S.ltd={game:pick.map(([id,s],i)=>({token:`${id}:${s}`,itemId:id,art:id,serial:s,name:ITEM[id].n,value:ITEM[id].v*100,heldUntil:i===6?Date.now()+2*864e5:0,listed:i===7})),site:[]};save();
  }
  return S.ltd;
}
async function ltdLoad(view,force){
  if(!WAPI.live){const d=ltdDemo();LTD.data.game={available:true,hasSave:true,inGame:false,mail:0,items:d.game};LTD.data.site={items:d.site};return}
  if(view==='game'||force){const r=await api('/api/items/save');LTD.data.game=r.ok?r.j:{error:r.j.error||'Could not read your Trade Empire inventory.'}}
  if(view==='site'||force){const r=await api('/api/items/site');LTD.data.site=r.ok?r.j:{error:r.j.error||'Could not load your items.',items:[]}}
}
async function ltdSiteItems(){if(!WAPI.live)return ltdDemo().site;const r=await api('/api/items/site');return r.ok?r.j.items:[]}

/* ---------- the inventory modal ---------- */
async function openInventory(view='site',o={}){
  if(!S.user){openLogin();return}
  LTD.view=view;LTD.sel=new Set(o.pre||[]);LTD.q='';
  const m=modal(`<div class="inv-h"><h3>Inventory</h3></div>
    <div class="inv-tools"><label class="inv-search">${ic('search',16)}<input id="iq" placeholder="Search for an item or #serial..." autocomplete="off"></label>
      <label class="inv-sort"><select id="isort"><option value="hi">Highest to Lowest</option><option value="lo">Lowest to Highest</option><option value="az">Name A to Z</option><option value="new">Serial number</option></select></label></div>
    <div class="inv-total"><span class="inv-ti">${HEX(26)}</span><div><span>TOTAL VALUE</span><b id="itv">0</b></div><button class="inv-switch" id="isw"></button></div>
    <div class="inv-note" id="inote" hidden></div>
    <div class="inv-grid" id="igrid"><div class="inv-load"><div class="spin"></div></div></div>
    <div class="inv-foot"><button class="inv-all" id="iall">Select all</button><div class="spacer"></div><button class="inv-go" id="igo"><span id="igl">Withdraw</span><i></i>${HEX(15)}<b id="igv">0</b></button></div>`,{cls:'invm'});
  const R=m.root;
  const items=()=>{const d=LTD.data[LTD.view];return d&&d.items?d.items:[]};
  const idOf=x=>LTD.view==='site'?x.uid:x.token;
  const blocked=x=>LTD.view==='game'?(x.heldUntil>Date.now()?`Held · ${holdLeft(x.heldUntil)}`:x.listed?'Listed on the market':null):(x.status&&x.status!=='held'?({flip:'In a coinflip',in:'Arriving',out:'Leaving'}[x.status]||x.status):null);
  function list(){
    let L=items().filter(x=>{const q=LTD.q;return!q||(q.startsWith('#')?String(x.serial).startsWith(q.slice(1)):x.name.toLowerCase().includes(q))});
    L=[...L].sort(LTD.sort==='lo'?(a,b)=>a.value-b.value:LTD.sort==='az'?(a,b)=>a.name.localeCompare(b.name):LTD.sort==='new'?(a,b)=>a.serial-b.serial:(a,b)=>b.value-a.value);
    return L;
  }
  function draw(){
    const d=LTD.data[LTD.view],site=LTD.view==='site',L=list();
    $('#isw',R).innerHTML=`${ic('plus',15,2.4)}${site?'Deposit':'Withdraw'}`;
    $('#itv',R).textContent=fmtV(items().reduce((a,x)=>a+x.value,0));
    $('#igl',R).textContent=site?'Withdraw':'Deposit';
    const note=$('#inote',R),notes=[];
    if(d&&d.error)notes.push(['err',d.error]);
    if(!site&&d){
      if(d.available===false)notes.push(['warn','Moving items is not switched on yet.']);
      if(d.inGame)notes.push(['warn',`You're in ${TE.name} right now. The game keeps your save open while you play, so leave the game, wait a few seconds, then refresh.`]);
      if(d.mail)notes.push(['warn',`You have game mail waiting, such as a market sale. Join ${TE.name} once to receive it, then come back.`]);
      if(d.checks)notes.push(['warn',d.checks]);
      if(d.catalogError)notes.push(['warn',d.catalogError]);
    }
    note.hidden=!notes.length;note.innerHTML=notes.map(([k,t])=>`<p class="${k}">${esc(t)}</p>`).join('');
    const g=$('#igrid',R);
    if(!d){g.innerHTML='<div class="inv-load"><div class="spin"></div></div>';return foot()}
    if(!L.length){g.innerHTML=`<div class="inv-empty"><span>${ic('search',26,2)}</span><b>No items!</b><p>${LTD.q?'No items match that search.':site?'No items were found...':`No limiteds found in your ${TE.name} save.`}</p><div>${site?'<button class="inv-btn blue" data-isw>Deposit</button>':''}<button class="inv-btn green" data-go="market">${ic('market',16)}Purchase</button></div></div>`;return foot()}
    g.innerHTML=L.map(x=>{const b=blocked(x),id=idOf(x),on=LTD.sel.has(id);return`<button class="inv-card${on?' on':''}${b?' off':''}" data-i="${esc(id)}" ${b?`title="${esc(b)}"`:''}>
      <span class="inv-ck">${on?ic('check',12,3.2):''}</span><div class="inv-pic">${ltdPic(x)}${x.limitedType==='LimitedU'||x.limitedType==='Limited U'?'<i class="inv-u">U</i>':''}</div>
      ${b?`<span class="inv-flag">${ic(x.listed?'tag':'lock',11,2.4)}${esc(b)}</span>`:''}
      <span class="inv-ser">#${x.serial||'N/A'}</span><b class="inv-n">${esc(x.name)}</b><span class="inv-v">${HEX(13)}${fmtV(x.value)}</span></button>`}).join('');
    foot();
  }
  function foot(){
    const sel=items().filter(x=>LTD.sel.has(idOf(x))),v=sel.reduce((a,x)=>a+x.value,0);
    $('#igv',R).textContent=fmtV(v);$('#igo',R).disabled=!sel.length||LTD.busy;
    $('#iall',R).textContent=sel.length?'Clear':'Select all';
  }
  async function load(force){LTD.data[LTD.view]=null;draw();await ltdLoad(LTD.view,force);if(R.isConnected)draw()}
  $('#iq',R).oninput=e=>{LTD.q=e.target.value.trim().toLowerCase();draw()};
  $('#isort',R).onchange=e=>{LTD.sort=e.target.value;draw()};
  const swap=()=>{LTD.view=LTD.view==='site'?'game':'site';LTD.sel=new Set();load()};
  $('#isw',R).onclick=swap;
  R.addEventListener('click',e=>{
    if(e.target.closest('[data-isw]')){if(LTD.view==='site')swap();return}
    const c=e.target.closest('[data-i]');if(!c||c.classList.contains('off'))return;
    const id=c.dataset.i;LTD.sel.has(id)?LTD.sel.delete(id):LTD.sel.size<20?LTD.sel.add(id):toast('Move up to 20 items at a time.');draw();
  });
  $('#iall',R).onclick=()=>{const L=list().filter(x=>!blocked(x));if(LTD.sel.size)LTD.sel.clear();else L.slice(0,20).forEach(x=>LTD.sel.add(idOf(x)));draw()};
  $('#igo',R).onclick=async()=>{
    if(LTD.busy||!LTD.sel.size)return;const site=LTD.view==='site',ids=[...LTD.sel];
    // The Deduction Service modal replaces this one, so reopen with the same selection afterwards.
    if(!site&&!accepted('cds')){if(await needCds())openInventory('game',{pre:ids,auto:true});return}
    LTD.busy=true;const btn=$('#igo',R),lab=$('#igl',R);lab.textContent=site?'Sending to Trade Empire…':'Moving to TradeBlacket…';btn.disabled=true;
    let ok=false,msg='';
    if(WAPI.live){const r=await api(site?'/api/items/withdraw':'/api/items/deposit',site?{uids:ids}:{tokens:ids});ok=r.ok;msg=r.j.error||'';if(r.j.inGame)await ltdLoad('game',true)}
    else{await sleep(900);const d=ltdDemo();if(site){const out=d.site.filter(x=>ids.includes(x.uid));d.site=d.site.filter(x=>!ids.includes(x.uid));out.forEach(x=>d.game.push({token:`${x.itemId}:${x.serial}`,itemId:x.itemId,art:x.art,serial:x.serial,name:x.name,value:x.value,heldUntil:Date.now()+3*864e5}))}
      else{const inn=d.game.filter(x=>ids.includes(x.token));d.game=d.game.filter(x=>!ids.includes(x.token));inn.forEach(x=>d.site.unshift({uid:uid(),itemId:x.itemId,art:x.art,serial:x.serial,name:x.name,value:x.value,status:'held'}))}save();ok=true}
    LTD.busy=false;if(!R.isConnected)return;
    if(ok){toast(site?`${ids.length} item${ids.length>1?'s':''} sent to your ${TE.name} inventory`:`${ids.length} item${ids.length>1?'s':''} added to your TradeBlacket inventory`,'win');LTD.sel.clear();await ltdLoad('site',true);await ltdLoad('game',true);drawInvCount&&drawInvCount()}
    else toast(msg||'Nothing was moved.','loss');
    if(R.isConnected)draw();
  };
  load(true).then(()=>{if(o.auto&&R.isConnected)$('#igo',R).click()});
}
function holdLeft(t){const s=Math.max(0,(t-Date.now())/1e3);return s>86400?`${Math.ceil(s/86400)}d`:s>3600?`${Math.ceil(s/3600)}h`:`${Math.ceil(s/60)}m`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-inv]');if(b)openInventory(b.dataset.inv||'site')});

/* ---------- item coinflip ---------- */
const FL={list:null,timer:0,demo:null};
function flDemo(){
  if(!FL.demo){const mk=(name,ids,side)=>({id:uid(),side,creator:name,own:false,mine:false,cItems:ids.map(([a,s])=>({itemId:a,art:a,serial:s,name:ITEM[a].n,value:ITEM[a].v*100})),status:'open',seedHash:Array.from({length:64},()=>'0123456789abcdef'[ri(0,15)]).join('')});
    FL.demo={open:[mk('VaultVibes',[['gwings',812],['shalo',90]],'h'),mk('LunaTrades',[['ehelm',4410]],'t'),mk('PixelMarlin',[['mcrown',2290],['eblade',611],['apup',5]],'h')],recent:[]};
    FL.demo.open.forEach(f=>{f.cValue=f.cItems.reduce((a,x)=>a+x.value,0);f.range=[Math.ceil(f.cValue*.9),Math.floor(f.cValue*1.1)]})}
  return FL.demo;
}
async function flLoad(){
  if(!WAPI.live){FL.list=flDemo();return}
  const r=await api('/api/flips');if(!r.ok)return;
  // Tell a creator when someone joined one of their flips while they watched.
  const before=new Set(((FL.list&&FL.list.open)||[]).filter(f=>f.own).map(f=>f.id));
  FL.list=r.j;
  for(const f of r.j.recent||[])if(before.has(f.id)&&f.status==='done')toast(f.won?`You won your flip against ${f.joiner}: ${fmtV(f.cValue+f.jValue)} in items`:`${f.joiner} won your flip`,f.won?'win':'loss');
}
const SIDE={h:{n:'Crown',svg:typeof CROWN!=='undefined'?CROWN:''},t:{n:'Tower',svg:typeof TOWER!=='undefined'?TOWER:''}};
const thumbs=(L,max=5)=>`<span class="fl-th">${L.slice(0,max).map(x=>`<i title="${esc(x.name)} #${x.serial}">${ltdPic(x)}</i>`).join('')}${L.length>max?`<em>+${L.length-max}</em>`:''}</span>`;
PAGES.flip=el=>{
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Limited Flip</div><h2>Limited Flip</h2><p>Coinflip your ${TE.name} limiteds against other players. Put up items, pick Crown or Tower, and whoever wins takes every item. Opponents match your value within 10%.</p></div><div class="tools"><button class="cta ghost inline" data-inv="site">${ic('inventory',17)}My items</button><button class="cta inline" id="flnew">${ic('plus',17,2.2)} Create flip</button></div></div>
  ${WAPI.live?'':'<div class="card" style="margin-bottom:12px;padding:10px 14px"><p class="note" style="color:var(--muted)">Preview: opponents and items here are simulated. On the live site every flip is between two real players.</p></div>'}
  <div class="fl-stats" id="flst"></div>
  <div class="sec-h"><h3 class="sec">Open flips</h3><span class="note">Value shown is what the items are worth in ${TE.name}</span></div>
  <div class="fl-list" id="flo"><div class="inv-load"><div class="spin"></div></div></div>
  <div class="sec-h"><h3 class="sec">Recent flips</h3></div>
  <div class="fl-list" id="flr"></div>
  <details class="card fl-fair"><summary>${ic('shield',16,2)} How every result is decided</summary><p>When a flip opens, the server picks a secret seed and shows you its SHA-256 fingerprint. When someone joins, the result is the first byte of <code>sha256(seed:joinerId:flipId)</code>: even is Crown, odd is Tower. After the flip the seed is revealed, so you can check the fingerprint matches and recompute the result yourself. Nobody, including the creator, can see the seed in advance.</p></details>`;
  const row=f=>{
    const st=f.status==='open';
    return`<div class="fl-row${f.mine?' mine':''}"><div class="fl-who">${avatar(bot(f.creator),34)}<div><b>${esc(f.creator)}</b><span class="fl-side">${SIDE[f.side].svg}${SIDE[f.side].n}</span></div></div>
      ${thumbs(f.cItems)}<div class="fl-val"><b>${HEX(14)}${fmtV(f.cValue)}</b>${st?`<span>${fmtV(f.range[0])} – ${fmtV(f.range[1])}</span>`:''}</div>
      ${st?(f.own?`<button class="cta ghost sm" data-flc="${f.id}">Cancel</button>`:`<button class="cta sm" data-flj="${f.id}">Join</button>`)
        :`<div class="fl-res"><span class="fl-side">${SIDE[f.result].svg}${SIDE[f.result].n}</span><b class="${f.won?'w':f.won===false?'l':''}">${f.won?'You won':f.won===false?'You lost':esc(f.winnerName)+' won'}</b></div>`}</div>`;
  };
  function draw(){
    const L=FL.list;if(!L||!el.isConnected)return;
    const open=L.open||[],tot=open.reduce((a,f)=>a+f.cValue,0);
    $('#flst').innerHTML=`<div class="stat"><span>Open flips</span><b>${open.length}</b></div><div class="stat"><span>Value waiting</span><b>${HEX(15)}${fmtV(tot)}</b></div><div class="stat"><span>Your open flips</span><b>${open.filter(f=>f.own).length}</b></div>`;
    $('#flo').innerHTML=open.length?open.map(row).join(''):`<div class="empty" style="padding:28px"><h3>No open flips</h3><p>Create one and wait for someone to match it.</p></div>`;
    $('#flr').innerHTML=(L.recent||[]).length?L.recent.map(row).join(''):'<p class="note">Finished flips show up here.</p>';
  }
  el.addEventListener('click',e=>{
    const j=e.target.closest('[data-flj]');if(j){const f=FL.list.open.find(x=>x.id===j.dataset.flj);if(f)openFlipPicker(f,()=>flLoad().then(draw));return}
    const c=e.target.closest('[data-flc]');if(c){(async()=>{if(WAPI.live){const r=await api('/api/flips/cancel',{id:c.dataset.flc});if(!r.ok)return toast(r.j.error,'loss')}else{const d=flDemo(),f=d.open.find(x=>x.id===c.dataset.flc);d.open=d.open.filter(x=>x!==f);ltdDemo().site.push(...f.cItems.map(x=>({...x,uid:x.uid||uid(),status:'held'})));save()}toast('Flip cancelled. Your items are back.');await flLoad();draw()})()}
  });
  $('#flnew').onclick=()=>openFlipPicker(null,()=>flLoad().then(draw));
  flLoad().then(draw);
  FL.timer=setInterval(()=>flLoad().then(draw),WAPI.live?3000:8000);
  cleanup=()=>clearInterval(FL.timer);
};
// One picker for creating a flip (f = null) or joining one.
async function openFlipPicker(f,done){
  if(!S.user){openLogin();return}
  let side='h';const sel=new Set();
  const m=modal(`<h3>${f?`Join ${esc(f.creator)}'s flip`:'Create a flip'}</h3>
    ${f?`<div class="fl-target"><div>${thumbs(f.cItems,8)}</div><div class="kv"><span>Their items</span><b>${HEX(14)}${fmtV(f.cValue)}</b></div><div class="kv"><span>You need</span><b>${HEX(14)}${fmtV(f.range[0])} – ${fmtV(f.range[1])}</b></div><div class="kv"><span>You get</span><b class="fl-side">${SIDE[f.side==='h'?'t':'h'].svg}${SIDE[f.side==='h'?'t':'h'].n}</b></div></div>`
      :`<div class="fld"><span>Your side</span>${seg('fls',[['h','Crown'],['t','Tower']],'h')}</div>`}
    <span class="eyebrow" style="margin-top:8px">Your items</span><div class="inv-grid sm" id="flg"><div class="inv-load"><div class="spin"></div></div></div>
    <div class="kv" style="margin-top:10px"><span>Selected</span><b id="flv">0</b></div><div class="err" id="fle"></div>
    <button class="cta" id="flgo" disabled>${f?'Join flip':'Create flip'}</button>`,{cls:'wide'});
  const R=m.root;if(!f)wireSeg($('#fls',R),v=>side=v);
  const mine=(await ltdSiteItems()).filter(x=>x.status==='held');if(!R.isConnected)return;
  const g=$('#flg',R);
  g.innerHTML=mine.length?mine.sort((a,b)=>b.value-a.value).map(x=>`<button class="inv-card" data-u="${x.uid}"><span class="inv-ck"></span><div class="inv-pic">${ltdPic(x)}</div><span class="inv-ser">#${x.serial}</span><b class="inv-n">${esc(x.name)}</b><span class="inv-v">${HEX(13)}${fmtV(x.value)}</span></button>`).join('')
    :`<div class="inv-empty"><b>No items on TradeBlacket</b><p>Deposit limiteds from ${TE.name} first.</p><div><button class="inv-btn blue" data-inv="game">Deposit items</button></div></div>`;
  const upd=()=>{const v=mine.filter(x=>sel.has(x.uid)).reduce((a,x)=>a+x.value,0),inR=!f||(v>=f.range[0]&&v<=f.range[1]);
    $('#flv',R).innerHTML=`${HEX(14)}${fmtV(v)}${f?(inR?' <span style="color:var(--win)">in range</span>':` <span style="color:var(--loss)">needs ${fmtV(f.range[0])} – ${fmtV(f.range[1])}</span>`):''}`;$('#flgo',R).disabled=!sel.size||!inR||v<1};
  g.onclick=e=>{const c=e.target.closest('[data-u]');if(!c)return;const u=c.dataset.u;sel.has(u)?sel.delete(u):sel.size<10?sel.add(u):toast('Up to 10 items per flip.');c.classList.toggle('on',sel.has(u));c.querySelector('.inv-ck').innerHTML=sel.has(u)?ic('check',12,3.2):'';upd()};
  upd();
  $('#flgo',R).onclick=async()=>{
    const uids=[...sel],btn=$('#flgo',R);btn.disabled=true;btn.innerHTML='<div class="spin sm"></div>';
    let r;
    if(WAPI.live)r=await api(f?'/api/flips/join':'/api/flips/create',f?{id:f.id,uids}:{uids,side});
    else{await sleep(500);const d=ltdDemo(),items=d.site.filter(x=>uids.includes(x.uid)),v=items.reduce((a,x)=>a+x.value,0);d.site=d.site.filter(x=>!uids.includes(x.uid));
      if(f){const result=rnd()<.5?'h':'t',won=result!==f.side,all=[...f.cItems,...items].map(x=>({...x,uid:x.uid||uid(),status:'held'}));if(won)d.site.push(...all);const fd=flDemo();fd.open=fd.open.filter(x=>x!==f);fd.recent.unshift({...f,status:'done',result,won,winnerName:won?S.user.name:f.creator,jItems:items,jValue:v});r={ok:true,j:{result,won,pot:f.cValue+v}}}
      else{const fd=flDemo(),nf={id:uid(),side,creator:S.user.name,own:true,mine:true,cItems:items,cValue:v,range:[Math.ceil(v*.9),Math.floor(v*1.1)],status:'open'};fd.open.unshift(nf);r={ok:true,j:{id:nf.id}}}save()}
    if(!R.isConnected)return;
    if(!r.ok){$('#fle',R).textContent=r.j.error||'Something went wrong. Nothing was moved.';btn.disabled=false;btn.textContent=f?'Join flip':'Create flip';return}
    m.close();
    if(f)showFlip(f,r.j);else toast('Flip created. It waits here until someone matches it.','gold');
    done&&done();
  };
}
async function showFlip(f,res){
  const m=modal(`<div class="center"><div class="coin-scene"><div class="toss" id="ft"><div class="coin" id="fc"><div class="face h">${SIDE.h.svg}</div><div class="face t">${SIDE.t.svg}</div></div></div></div><h3 id="fh">Flipping…</h3><p class="muted" id="fp">Pot ${fmtV(res.pot||0)}</p></div>`);
  const R=m.root;await sleep(60);
  const t=$('#ft',R),c=$('#fc',R);t.classList.add('go');c.style.transform=`rotateY(${1800+(res.result==='t'?180:0)}deg)`;
  await sleep(REDUCED?200:1700);if(!R.isConnected)return;
  $('#fh',R).innerHTML=`${SIDE[res.result].n}. ${res.won?'<span style="color:var(--win)">You won the pot</span>':'You lost this one'}`;
  $('#fp',R).textContent=res.won?`All ${fmtV(res.pot)} in items are now in your TradeBlacket inventory.`:'Better luck on the next flip.';
  if(res.won)confetti(innerWidth/2,innerHeight/2,140);
}
