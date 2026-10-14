'use strict';
/* =========================================================
   Admin → Players: find anyone and see everything they have done.
   Search by name, Roblox id, wallet ID, ticket id or referral code. A player's page has the full
   account, the totals, and a log of every deposit, withdrawal, item move, sale, flip, game round,
   sign-in, waitlist step, ticket and staff action, plus their Trade Empire ledger.
   ========================================================= */
const PLX={who:null,data:null,tab:'activity',cat:'all',q:'',range:'all'};
const PLCAT=[['all','Everything'],['money','Rodux'],['items','Items'],['games','Games'],['tradeempire','In Trade Empire'],['account','Account'],['waitlist','Waitlist'],['security','Sign-ins'],['support','Support'],['staff','Staff']];
const PLCOL={money:'#E7C77F',items:'#7FB4FF',games:'#C38BFF',tradeempire:'#2FD38A',account:'#9AA6B5',waitlist:'#5FD3D3',security:'#F5A524',support:'#7FD3A8',staff:'#F27A7A'};
const plSgn=v=>v==null||v===''?'':`<b class="pv ${v>0?'up':v<0?'dn':''}">${v>0?'+':v<0?'−':''}${fmt0(Math.abs(v))}</b>`;
const plStat=s=>!s||s==='ok'?'':`<span class="pst ${esc(s)}">${esc({staged:'Pending',cancelled:'Cancelled',refused:'Refused',failed:'Failed',open:'Open',banned:'Banned',void:'No reward',pending:'Pending',paid:'Paid',expired:'Expired'}[s]||s)}</span>`;
const plItems=its=>its&&its.length?`<div class="pic">${its.slice(0,12).map(i=>`<span class="pi" title="${esc(i.name||('Item '+i.itemId))} #${i.serial??''}">${i.img?`<img src="${esc(i.img)}" alt="" loading="lazy">`:''}<b>${esc(i.name||('Item '+(i.itemId??'?')))}</b><small>#${i.serial??'?'}${i.value?` · ${fmt0(i.value)}`:''}</small></span>`).join('')}${its.length>12?`<span class="pi more">+${its.length-12} more</span>`:''}</div>`:'';
const plLink=(id,name)=>`<button class="lnk" data-plink="${id}">${esc(name||String(id))}</button>`;
const plDay=t=>new Date(t).toLocaleDateString(undefined,{weekday:'short',year:'numeric',month:'short',day:'numeric'});
const plHm=t=>new Date(t).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});

function admPlayersTab(adm,who){
  adm.innerHTML=`<div class="pl-find"><div class="pl-search">${ic('search',17)}<input class="txt" id="plq" placeholder="Search by Roblox name, Roblox id, wallet ID (TBW-…), ticket (TKT-…) or referral code" value="${esc(who||'')}" autocomplete="off" spellcheck="false"></div><div id="plres" class="pl-res"></div></div><div id="admp"></div>`;
  const q=$('#plq',adm);let tm=0;
  const run=async()=>{const v=q.value.trim();const box=$('#plres');if(!box)return;
    if(!WAPI.live){box.innerHTML='<p class="note">Preview: player search runs on the live site.</p>';return}
    const r=await api('/api/admin/search?q='+encodeURIComponent(v));if(!$('#plres'))return;
    const P=r.ok?r.j.players:[];
    box.innerHTML=P.length?`${v?'':'<h5 class="pl-h5">Recently active</h5>'}<div class="pl-grid">${P.map(p=>`<button class="pl-card${PLX.who==p.robloxId?' on':''}" data-pl="${p.robloxId}"><img src="/img/avatar/${p.robloxId}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span><b>${esc(p.username||String(p.robloxId))}</b><small>${esc(p.walletId)} · ${p.lastSeen?'seen '+ago(p.lastSeen):'joined '+dt(p.joined)}</small></span>${p.admin?'<i class="ac-pill is-gold">Admin</i>':p.banned?'<i class="ac-pill is-bad">Banned</i>':''}</button>`).join('')}</div>`:`<p class="note">${r.ok?'No players match.':esc(r.j.error||'Search failed.')}</p>`;
    $$('[data-pl]',box).forEach(b=>b.onclick=()=>admPlayer(b.dataset.pl));
  };
  q.oninput=()=>{clearTimeout(tm);tm=setTimeout(run,220)};
  q.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();const f=$('[data-pl]');if(f)admPlayer(f.dataset.pl)}};
  run();
  if(who)admPlayer(who);
}

async function admPlayer(who){
  const box=$('#admp');if(!box||!who)return;
  PLX.who=String(who);box.innerHTML='<div class="spin"></div>';
  $$('.pl-card').forEach(c=>c.classList.toggle('on',c.dataset.pl===PLX.who));
  if(!WAPI.live){box.innerHTML='<p class="note">Preview: the player log runs on the live site.</p>';return}
  const r=await api('/api/admin/player?id='+encodeURIComponent(who));if(!$('#admp'))return;
  if(!r.ok){box.innerHTML=`<p class="note">${esc(r.j.error)}</p>`;return}
  PLX.data=r.j;PLX.who=String(r.j.robloxId);drawPlayer();
  box.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'start'});
}

function drawPlayer(){
  const box=$('#admp'),L=PLX.data;if(!box||!L)return;
  const A=L.snapshot||{},R=A.roblox||{},B=A.tradeBlacket||{},T=A.tradeEmpire||{},X=L.totals;
  const kpi=(l,v,s='')=>`<div class="pk"><span>${l}</span><b>${v}</b>${s?`<small>${s}</small>`:''}</div>`;
  box.innerHTML=`<section class="pl">
    <header class="pl-head">
      <img class="pl-av" src="/img/avatar/${L.robloxId}" alt="" onerror="this.style.visibility='hidden'">
      <div class="pl-id"><h3>${esc(R.displayName||L.username)}</h3><span>@${esc(L.username||'')} · Roblox ${L.robloxId} · <code data-copy="${esc(L.walletId)}" title="Copy">${esc(L.walletId)}</code></span>
        <div class="te-tags">${B.admin?'<span class="ac-pill is-gold">Admin</span>':''}${B.banned?`<span class="ac-pill is-bad">${B.banned.kind==='suspend'?'Suspended':B.banned.kind==='terminate'?'Terminated':'Banned'}</span>`:B.access?'<span class="ac-pill is-ok">Has access</span>':'<span class="ac-pill">Waitlist</span>'}${T.tradePlus?`<span class="ac-pill is-gold">TradePlus ${esc(T.tradePlus.tier)}</span>`:''}${T.standing?`<span class="ac-pill l-${esc(T.standing.level)}">Trade Empire: ${esc(T.standing.label)}</span>`:''}${B.standing?`<span class="ac-pill l-${esc(B.standing.level)}">TradeBlacket: ${esc(B.standing.label)}</span>`:''}${R.isBanned?'<span class="ac-pill is-bad">Banned on Roblox</span>':''}</div>
        <small class="pl-sub">Joined ${dt(L.joined)} · ${L.lastSeen?`last seen ${ago(L.lastSeen)}`:'not seen since sign-in tracking began'}${R.created?` · Roblox account ${ageOf(R.created)} old`:''}</small></div>
      <div class="pl-acts">${staffBar(A,null)}<div class="pl-tools"><button class="cta ghost inline" id="plcsv">${ic('chev',14)}Export log</button><button class="cta ghost inline" id="plref">Refresh</button></div></div>
    </header>
    <div class="pl-kpis">
      ${kpi('Balance',fmt0(B.balance),B.bonusLock?`${fmt0(B.bonusLock)} bonus`:'')}
      ${kpi('Rodux in',fmt0(X.roduxIn),`${fmt0(X.roduxInWeb)} website · ${fmt0(X.roduxInGame)} in game`)}
      ${kpi('Rodux out',fmt0(X.roduxOut),`${X.withdrawals} withdrawal${X.withdrawals===1?'':'s'}`)}
      ${kpi('Net',`<span class="${X.roduxIn-X.roduxOut>=0?'up':'dn'}">${fmt0(X.roduxIn-X.roduxOut)}</span>`,X.refused?`${X.refused} refused or cancelled`:'')}
      ${kpi('Items in / out',`${fmt0(X.itemsIn)} / ${fmt0(X.itemsOut)}`,`${fmt0(X.itemsInValue)} in value`)}
      ${kpi('Bought',fmt0(X.bought),`${fmt0(X.soldPlayers+X.soldHouse)} Rodux from sales`)}
      ${kpi('Limited Flip',`${X.flipsWon}W ${X.flipsLost}L`,`<span class="${X.flipNet>=0?'up':'dn'}">${X.flipNet>=0?'+':''}${fmt0(X.flipNet)}</span> value`)}
      ${kpi('Sign-ins',fmt0(X.signIns),`${X.networks} network${X.networks===1?'':'s'} · ${X.devices} device${X.devices===1?'':'s'}`)}
      ${kpi('Support',fmt0(X.tickets),`${X.staffActions} staff action${X.staffActions===1?'':'s'}`)}
    </div>
    <nav class="pl-tabs" role="tablist">${[['activity','Activity log'],['money','Rodux'],['items','Items'],['games','Games'],['security','Sign-ins & devices'],['te','Trade Empire'],['account','Account']].map(([k,l])=>`<button role="tab" aria-selected="${PLX.tab===k}" data-ptab="${k}" class="${PLX.tab===k?'on':''}">${l}</button>`).join('')}</nav>
    <div id="plbody"></div>
  </section>`;
  $$('[data-ptab]',box).forEach(b=>b.onclick=()=>{PLX.tab=b.dataset.ptab;drawPlayer()});
  $('#plref',box).onclick=()=>admPlayer(PLX.who);
  $('#plcsv',box).onclick=exportLog;
  $$('[data-mod]',box).forEach(b=>b.dataset.tk='');
  drawPlTab();
}

function plRow(e){
  return`<li class="pe" style="--c:${PLCOL[e.cat]||'#9AA6B5'}"><time>${plHm(e.at)}</time><i class="pdot"></i>
    <div class="pe-b"><div class="pe-t"><span>${esc(e.title)}</span>${e.amount!=null?plSgn(e.amount):''}${e.value!=null&&e.amount==null?`<span class="pval">${e.value<0?'−':''}${fmt0(Math.abs(e.value))} value</span>`:''}${plStat(e.status)}</div>
      ${e.method||e.ref||e.note||e.link?`<div class="pe-m">${e.method?`<span>${esc(e.method)}</span>`:''}${e.note?`<span>${esc(e.note)}</span>`:''}${e.link?`<span>${plLink(e.link,'Open linked player')}</span>`:''}${e.until?`<span>until ${dtt(e.until)}</span>`:''}${e.ref?`<code data-copy="${esc(e.ref)}" title="Copy reference">${esc(e.ref)}</code>`:''}</div>`:''}
      ${plItems(e.items)}</div></li>`;
}
function plFiltered(){
  const L=PLX.data,lim=PLX.range==='7'?Date.now()-7*864e5:PLX.range==='30'?Date.now()-30*864e5:0,q=PLX.q.toLowerCase();
  return L.events.filter(e=>(PLX.cat==='all'||e.cat===PLX.cat)&&e.at>=lim&&(!q||[e.title,e.method,e.note,e.ref,...(e.items||[]).map(i=>i.name)].join(' ').toLowerCase().includes(q)));
}
function plTimeline(list){
  if(!list.length)return'<p class="note pl-empty">Nothing here.</p>';
  let out='',day='';
  for(const e of list.slice(0,600)){const d=plDay(e.at);if(d!==day){if(day)out+='</ol>';out+=`<h5 class="pday">${d}</h5><ol class="ptl">`;day=d}out+=plRow(e)}
  return out+'</ol>'+(list.length>600?`<p class="note">Showing the newest 600 of ${fmt0(list.length)}. Narrow it down with the filters, or export the full log.</p>`:'');
}
function plTable(cols,rows,empty='Nothing yet.'){
  return rows.length?`<div class="ptbl"><table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:`<p class="note">${empty}</p>`;
}
function plBars(usage){
  if(!usage.length)return'<p class="note">No play time recorded.</p>';
  const max=Math.max(...usage.map(u=>u.seconds),1);
  return`<div class="pbars" role="img" aria-label="Minutes played per day">${usage.map(u=>`<span title="${u.day}: ${Math.round(u.seconds/60)} min, net ${u.net>=0?'+':''}${fmt0(u.net)}"><i style="height:${Math.max(2,u.seconds/max*100)}%" class="${u.net<0?'dn':'up'}"></i></span>`).join('')}</div><div class="pbars-l"><span>${usage[0].day}</span><span>${usage.at(-1).day}</span></div>`;
}
function drawPlTab(){
  const el=$('#plbody'),L=PLX.data;if(!el)return;
  const ev=L.events,A=L.snapshot||{};
  const when=e=>`${dt(e.at)} ${plHm(e.at)}`;
  if(PLX.tab==='activity'){
    el.innerHTML=`<div class="pf"><div class="pf-cats">${PLCAT.map(([k,l])=>`<button data-pcat="${k}" class="${PLX.cat===k?'on':''}" style="--c:${PLCOL[k]||'#E7C77F'}">${l}<i>${k==='all'?ev.length:ev.filter(e=>e.cat===k).length}</i></button>`).join('')}</div>
      <div class="pf-row"><input class="txt" id="pfq" placeholder="Filter: item name, reference, reason…" value="${esc(PLX.q)}"><select class="txt" id="pfr"><option value="all">All time</option><option value="30" ${PLX.range==='30'?'selected':''}>Last 30 days</option><option value="7" ${PLX.range==='7'?'selected':''}>Last 7 days</option></select></div></div>
      <div id="ptl">${plTimeline(plFiltered())}</div>`;
    $$('[data-pcat]',el).forEach(b=>b.onclick=()=>{PLX.cat=b.dataset.pcat;drawPlTab()});
    const q=$('#pfq',el);q.oninput=()=>{PLX.q=q.value;$('#ptl').innerHTML=plTimeline(plFiltered())};
    $('#pfr',el).onchange=e=>{PLX.range=e.target.value;$('#ptl').innerHTML=plTimeline(plFiltered())};
  }
  if(PLX.tab==='money'){
    const m=ev.filter(e=>e.cat==='money');
    el.innerHTML=`<p class="note">Every Rodux transfer, with how it was made: the website wallet moves Rodux straight in and out of the Trade Empire save while the player is out of the game; the old in-game bridge sent it from inside the game.</p>
      ${plTable(['When','What','Amount','How','Status','Reference','Note'],m.map(e=>[when(e),esc(e.title),plSgn(e.amount),esc(e.method||''),plStat(e.status)||'<span class="pst ok">Done</span>',e.ref?`<code data-copy="${esc(e.ref)}">${esc(e.ref)}</code>`:'',esc(e.note||'')]),'No Rodux transfers.')}`;
  }
  if(PLX.tab==='items'){
    const mv=ev.filter(e=>e.cat==='items');
    el.innerHTML=`<h4 class="te-h4">Holding now (${L.holdings.length})</h4>${L.holdings.length?`<div class="pic big">${L.holdings.map(h=>`<span class="pi"><img src="${esc(h.img||'')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><b>${esc(h.name||('Item '+h.itemId))}</b><small>#${h.serial} · ${fmt0(h.value||0)}${h.status!=='held'?` · ${esc(h.status==='market'?`listed ${fmt0(h.listed||0)}`:h.status)}`:''}</small></span>`).join('')}</div>`:'<p class="note">No limiteds on TradeBlacket.</p>'}
      <h4 class="te-h4">Moves, listings and sales</h4><ol class="ptl flat">${mv.map(plRow).join('')||'<p class="note">None.</p>'}</ol>`;
  }
  if(PLX.tab==='games'){
    const fl=ev.filter(e=>e.kind.startsWith('flip')),st=ev.filter(e=>e.kind.startsWith('studio'));
    el.innerHTML=`<h4 class="te-h4">Play time, last 60 days</h4>${plBars(L.usage)}
      <h4 class="te-h4">Limited Flips (${fl.length})</h4><ol class="ptl flat">${fl.map(plRow).join('')||'<p class="note">None.</p>'}</ol>
      <h4 class="te-h4">Studio games (${st.length})</h4>${plTable(['When','Round','Amount','Status','Round id'],st.map(e=>[when(e),esc(e.title),plSgn(e.amount),plStat(e.status)||'Done',`<code>${esc(e.ref||'')}</code>`]),'No studio game rounds.')}
      <p class="note">Casino originals, cases and battles run in the player's browser on their play balance, so they are not logged per round.</p>`;
  }
  if(PLX.tab==='security'){
    const si=ev.filter(e=>e.cat==='security');
    el.innerHTML=`<p class="note">Labels are made from one-way hashes. The same label on two accounts means the same network, device or hardware. Addresses are never stored.</p>
      ${plTable(['Label','Type','First seen','Last seen','Also used by'],L.seen.map(s=>[`<code>${esc(s.label)}</code>`,esc(s.name),dtt(s.first),dtt(s.last),s.others.length?s.others.map(o=>`${plLink(o.robloxId,o.username)}${o.banned?' <span class="ac-pill is-bad">Banned</span>':''}`).join(', '):'<span class="note">Nobody else</span>']),'No sign-ins recorded since tracking began.')}
      <h4 class="te-h4">Sign-in history</h4><ol class="ptl flat">${si.map(plRow).join('')||'<p class="note">None recorded.</p>'}</ol>`;
  }
  if(PLX.tab==='te'){
    const te=L.tradeEmpire||{},T=A.tradeEmpire||{};
    el.innerHTML=`${!T.available?`<p class="note">${esc(T.error||te.error||'The save cannot be read right now.')}</p>`:!T.hasSave?'<p class="note">No Trade Empire save.</p>':`
      <div class="te-tiles">${[['Rodux',T.rodux],['Total value',T.totalValue],['RAP',T.totalRAP],['Limiteds',T.items],['Trades',T.trades],['Earned',te.totals?te.totals.earned:0]].map(([l,v])=>`<div class="te-t"><span>${l}</span><b>${fmt0(v||0)}</b></div>`).join('')}</div>
      <div class="te-grid" style="margin-top:14px"><section class="card"><h4 class="te-h4" style="margin-top:0">Standing in Trade Empire</h4>${standBar(T.standing)}<p class="ac-msg">${esc(T.standing.message)}</p>${standCounts(T.standing)}${violList(T.standing.violations,{empty:'No violations.'})}</section>
      <section class="card"><h4 class="te-h4" style="margin-top:0">Lifetime totals in the save</h4><dl class="ac-kv">${te.totals?Object.entries({Earned:te.totals.earned,'Spent on items':te.totals.purchases,'Limiteds sold':te.totals.soldLimiteds,'Total in':te.totals.totalIncoming,'Total out':te.totals.totalOutgoing,'Rodux sent':te.totals.transferredRodux,'Codes redeemed':te.redeemedCodes,'Players blocked':te.blocked}).map(([k,v])=>`<div><dt>${k}</dt><dd>${fmt0(v||0)}</dd></div>`).join(''):''}</dl>
        ${te.pending&&te.pending.length?`<h4 class="te-h4">Site wallet requests waiting in the save</h4>${plTable(['Kind','Amount','Since','Id'],te.pending.map(p=>[esc(p.kind),fmt0(p.amount),dtt(p.at),`<code>${esc(p.id)}</code>`]))}`:''}
        ${T.previousNames&&T.previousNames.length?`<p class="note">Previous names: ${T.previousNames.map(esc).join(', ')}</p>`:''}</section></div>
      <h4 class="te-h4">Trade Empire ledger (${te.transactions?te.transactions.length:0})</h4>${plTable(['When','What','Amount'],(te.transactions||[]).map(t=>[`${dt(t.at)} ${plHm(t.at)}`,esc(t.label),plSgn(t.amount)]),'No ledger entries in the save.')}`}`;
  }
  if(PLX.tab==='account'){
    el.innerHTML=`<div class="te-grid"><div>${acctCard(A,{staff:true})}</div><div class="mstack">
      <section class="card"><h4 class="te-h4" style="margin-top:0">Tickets (${L.tickets.length})</h4>${L.tickets.length?`<ul class="al">${L.tickets.map(t=>`<li><span class="vk">${esc(t.status)}</span><div><b>${esc(t.subject)}</b><small>${esc(t.id)} · ${esc(SUP_CAT[t.category]||t.category)} · ${t.messages} messages${t.files?`, ${t.files} screenshot${t.files===1?'':'s'}`:''} · ${dt(t.created)}</small><button class="lnk" data-optk="${esc(t.id)}">Open in Support</button></div></li>`).join('')}</ul>`:'<p class="note">No tickets.</p>'}</section>
      <section class="card"><h4 class="te-h4" style="margin-top:0">Agreements</h4><dl class="ac-kv"><div><dt>Terms accepted</dt><dd>${esc(L.legal.tos||'Not yet')}</dd></div><div><dt>Deduction Service</dt><dd>${esc(L.legal.cds||'Not yet')}</dd></div></dl></section></div></div>`;
    $$('[data-optk]',el).forEach(b=>b.onclick=()=>{SUP.sel=b.dataset.optk;SUP.tab='all';go('support')});
  }
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-plink]');if(!b)return;if(cur==='admin'&&$('#admp')){const q=$('#plq');if(q)q.value='';admPlayer(b.dataset.plink)}else go('admin','players:'+b.dataset.plink)});

function exportLog(){
  const L=PLX.data;if(!L)return;
  const cell=v=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};
  const rows=[['When (UTC)','Category','What','Amount','Value','How','Status','Reference','Note','Items'],...L.events.map(e=>[new Date(e.at).toISOString(),e.cat,e.title,e.amount??'',e.value??'',e.method||'',e.status||'',e.ref||'',e.note||'',(e.items||[]).map(i=>`${i.name||i.itemId} #${i.serial}`).join('; ')])];
  const blob=new Blob([rows.map(r=>r.map(cell).join(',')).join('\n')],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tradeblacket-${L.username||L.robloxId}-log.csv`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
