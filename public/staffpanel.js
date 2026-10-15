'use strict';
/* =========================================================
   Staff panel (tradeblacket.com/admin). Ranks: Trial Moderator, Moderator, Senior Moderator, Admin,
   Head Admin, HR, Owner, plus side roles. Every section checks the signed-in person's permissions;
   the server checks them again on every call and writes every action to the audit log.
   ========================================================= */
const SP={view:'dash',me:null,team:null};
const can=p=>!!(WAPI.me&&WAPI.me.staff&&WAPI.me.staff.perms.includes(p));
const SP_NAV=[
  ['dash','Dashboard','home',()=>can('dash.view')],
  ['tickets','Tickets','chat',()=>can('tickets.view')],
  ['players','Players','profile',()=>can('players.view')],
  ['bans','Bans','shield',()=>can('bans.view')],
  ['business','Business','tag',()=>['biz.review','biz.tepp','biz.pay','biz.wage','biz.requests','biz.youtube'].some(can)],
  ['gifts','Gift cards','gift',()=>can('gifts.manage')],
  ['access','Site access','lock',()=>can('site.waitlist')],
  ['team','Staff team','users',()=>can('dash.view')],
  ['perms','Permissions','key',()=>can('dash.view')],
  ['audit','Audit log','list',()=>can('audit.view')],
  ['legal','Agreements','edit',()=>can('legal.view')],
];
const SP_ICON={users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5M16 5.5a3 3 0 0 1 0 5.6M18 14c1.7.6 2.8 2.2 3 5"/>',key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>',list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'};
const spIc=(k,s=18)=>SP_ICON[k]?`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SP_ICON[k]}</svg>`:ic(k,s);
const rankPill=(r,lvl)=>`<i class="sp-rank r${Math.min(7,Math.ceil((lvl||5)/10))}">${esc(r)}</i>`;

function spOpen(view,push=true){
  if(!WAPI.me||!WAPI.me.staff){toast('The staff panel is for the TradeBlacket team.','loss');return}
  if(view)SP.view=view;
  if(push&&location.pathname!=='/admin')try{history.pushState(null,'','/admin')}catch{}
  let el=$('#sp');if(!el){el=document.createElement('div');el.id='sp';el.setAttribute('role','region');el.setAttribute('aria-label','Staff panel');document.body.appendChild(el)}
  document.body.classList.add('sp-on');
  const S2=WAPI.me.staff;
  el.innerHTML=`<header class="sp-top"><div class="sp-brand">${ic('shield',20)}<b>TradeBlacket</b><span>Staff</span></div><div class="sp-me">${avatar(me(),26)}<b>${esc(S.user.name)}</b>${rankPill(S2.rankName||S2.roleNames[0]||'Staff',S2.level)}${S2.roleNames.filter(n=>n!==S2.rankName).map(n=>`<i class="sp-role">${esc(n)}</i>`).join('')}<button class="sp-back" id="spx">${ic('chev',16)}Back to the site</button></div></header>
    <div class="sp-shell"><nav class="sp-nav">${SP_NAV.filter(n=>n[3]()).map(([k,l,i])=>`<button data-spv="${k}" class="${SP.view===k?'on':''}">${spIc(i)}<span>${l}</span><i class="sp-badge" data-spb="${k}"></i></button>`).join('')}</nav><main class="sp-main" id="spm"></main></div>`;
  $('#spx',el).onclick=spClose;
  $$('[data-spv]',el).forEach(b=>b.onclick=()=>{SP.view=b.dataset.spv;$$('[data-spv]',el).forEach(x=>x.classList.toggle('on',x===b));spDraw()});
  if(!SP_NAV.some(n=>n[0]===SP.view&&n[3]()))SP.view='dash';
  spDraw();
}
function spClose(){const el=$('#sp');if(el)el.remove();document.body.classList.remove('sp-on');try{if(location.pathname==='/admin')history.pushState(null,'','/')}catch{}}
addEventListener('popstate',()=>{if(location.pathname==='/admin'&&!$('#sp'))spOpen(null,false);else if(location.pathname!=='/admin'&&$('#sp'))spClose()});
const spHead=(t,s,extra='')=>`<div class="sp-h"><div><h1>${t}</h1>${s?`<p>${s}</p>`:''}</div>${extra}</div>`;

async function spDraw(){
  const m=$('#spm');if(!m)return;const v=SP.view;m.innerHTML='<div class="spin"></div>';
  if(v==='dash')return spDash(m);
  if(v==='tickets')return spTickets(m);
  if(v==='players'){m.innerHTML=spHead('Players','Search any account: activity, deposits and how they were made, items, standing and staff notes.')+'<section class="wl-admin" id="spa"></section>';return admPlayersTab($('#spa',m),'')}
  if(v==='bans'){m.innerHTML=spHead('Bans','Active bans, suspensions and terminations, including automatic ones for shared networks or devices.')+'<section class="wl-admin" id="spa"></section>';return drawBans($('#spa',m))}
  if(v==='business'){m.innerHTML=spHead('Business','Applications, partners, card payouts, monthly wages, giveaway codes and feature requests.')+'<section class="wl-admin" id="spa"></section>';return admBusiness($('#spa',m))}
  if(v==='gifts'){m.innerHTML=spHead('Gift cards','Make codes for giveaways and void ones that should not be used.')+'<section class="wl-admin" id="spa"></section>';return admGifts($('#spa',m))}
  if(v==='access'){m.innerHTML=spHead('Site access','Let players in from the waitlist and make access codes.')+`<div class="lx-seg mk-tabs sp-seg" style="--n:2;--i:0"><button class="on" data-spw="site">Site waitlist</button><button data-spw="slots">Slots waitlist</button></div><section class="wl-admin" id="spa"></section>`;
    const run=sc=>{$$('[data-spw]',m).forEach(b=>b.classList.toggle('on',b.dataset.spw===sc));$('.sp-seg',m).style.setProperty('--i',sc==='site'?0:1);drawAdmin($('#spa',m),sc)};$$('[data-spw]',m).forEach(b=>b.onclick=()=>run(b.dataset.spw));return run('site')}
  if(v==='team')return spTeam(m);
  if(v==='perms')return spPerms(m);
  if(v==='audit')return spAudit(m);
  if(v==='legal')return spLegal(m);
}

/* ---------- dashboard ---------- */
async function spDash(m){
  const [r,t]=await Promise.all([api('/api/admin/dashboard'),SP_PN?null:api('/api/admin/staff')]);if(t&&t.ok){SP.team=t.j;SP_PN=t.j.perms}if(!r.ok){m.innerHTML=`<p class="note">${esc(r.j.error)}</p>`;return}const D=r.j,me2=D.me;
  const tiles=[['Players',D.players,`${fmt0(D.newToday)} new today`],['Open tickets',D.openTickets,`${D.unassigned} unassigned · ${D.mine} yours`,'tickets'],['Active bans',D.bans,'bans and suspensions','bans'],['Business',D.bizPending+D.teppPending,`${D.bizPending} members · ${D.teppPending} partners waiting`,'business'],['Waitlist',D.waiting,'waiting for access','access'],['Staff',D.staffCount,'on the team','team']];
  m.innerHTML=spHead(`Hello, ${esc(S.user.name)}`,`You're ${me2.rankName?'a'+(/^[AEIOU]/.test(me2.rankName)?'n':'')+' '+esc(me2.rankName):'on staff'}${me2.roleNames.length?` with ${me2.roleNames.map(esc).join(', ')}`:''}. You can use ${me2.perms.length} of ${Object.keys(SP_PERM_NAMES()).length||me2.perms.length} permissions.`)+
    `<div class="sp-tiles">${tiles.map(([t,n,s,go2])=>`<button class="sp-tile" ${go2&&SP_NAV.find(x=>x[0]===go2)[3]()?`data-spgo="${go2}"`:'disabled'}><span>${t}</span><b>${fmt0(n)}</b><small>${s}</small></button>`).join('')}</div>
    <div class="sp-two"><section class="card glass"><h3>What you can do</h3><ul class="sp-perms">${me2.perms.map(p=>`<li>${ic('check',14,2.4)}${esc(SP_PERM_NAMES()[p]||p)}</li>`).join('')}</ul></section>
      <section class="card glass"><h3>Recent staff activity</h3>${D.recent.length?spAuditRows(D.recent.slice(0,10)):`<p class="note">${can('audit.view')?'Nothing logged yet.':'Your rank cannot see the audit log.'}</p>`}</section></div>`;
  $$('[data-spgo]',m).forEach(b=>b.onclick=()=>{SP.view=b.dataset.spgo;spOpen()});
  const tb=$('[data-spb="tickets"]');if(tb)tb.textContent=D.unassigned||'';
}
let SP_PN=null;const SP_PERM_NAMES=()=>SP_PN||(SP.team&&SP.team.perms)||{};

/* ---------- tickets ---------- */
async function spTickets(m,filter=SP.tf||'open'){
  SP.tf=filter;const r=await api('/api/admin/tickets');if(!r.ok){m.innerHTML=`<p class="note">${esc(r.j.error)}</p>`;return}
  const D=r.j,A=D.assigned,mine=String(WAPI.me.robloxId);
  const F={open:t=>t.status!=='closed',unassigned:t=>t.status!=='closed'&&!A[t.id],mine:t=>t.status!=='closed'&&A[t.id]&&String(A[t.id].staffId)===mine,closed:t=>t.status==='closed',all:()=>true};
  const list=D.tickets.filter(F[filter]).sort((a,b)=>(b.updated||0)-(a.updated||0));
  m.innerHTML=spHead('Tickets',D.canReply?'Take a ticket, answer it in Support, and close it when it is done.':'Your rank can read tickets. Admins and Support Agents answer them.')+
    `<div class="sp-filters">${Object.keys(F).map(k=>`<button data-tf="${k}" class="${k===filter?'on':''}">${{open:'Open',unassigned:'Unassigned',mine:'Mine',closed:'Closed',all:'All'}[k]} <small>${D.tickets.filter(F[k]).length}</small></button>`).join('')}</div>
    ${list.length?`<div class="sp-tk">${list.map(t=>{const a=A[t.id];return`<div class="sp-tkr"><span class="dot ${t.status}"></span><div class="sp-tkm"><b>${esc(t.subject)}</b><small>${esc(t.player||'')} · ${esc(SUP_CAT[t.category]||t.category)} · ${esc(t.id)} · ${ago(t.updated)}</small></div>
      <div class="sp-tka">${a?`<span class="sp-asg">${esc(a.name||'Staff')}</span>`:'<span class="sp-asg none">Unassigned</span>'}
      ${D.canAssign?`<select class="txt" data-tka="${esc(t.id)}"><option value="">Assign…</option>${D.staff.map(s=>`<option value="${s.robloxId}" ${a&&a.staffId==s.robloxId?'selected':''}>${esc(s.username)}${s.rankName?' ('+esc(s.rankName)+')':''}</option>`).join('')}<option value="0">Nobody</option></select>`:D.canReply&&!a?`<button class="cta ghost inline" data-tkt="${esc(t.id)}">Take</button>`:''}
      <button class="cta inline" data-tko="${esc(t.id)}">Open</button></div></div>`}).join('')}</div>`:'<div class="empty"><h3>Nothing here</h3><p>No tickets match this filter.</p></div>'}`;
  $$('[data-tf]',m).forEach(b=>b.onclick=()=>spTickets(m,b.dataset.tf));
  $$('[data-tka]',m).forEach(s=>s.onchange=async()=>{if(s.value==='')return;const x=await api('/api/admin/tickets/assign',{ticketId:s.dataset.tka,staffId:Number(s.value)});if(!x.ok)return toast(x.j.error,'loss');toast('Assigned.','win');spTickets(m)});
  $$('[data-tkt]',m).forEach(b=>b.onclick=async()=>{const x=await api('/api/admin/tickets/assign',{ticketId:b.dataset.tkt});if(!x.ok)return toast(x.j.error,'loss');toast('It\'s yours.','win');spTickets(m)});
  $$('[data-tko]',m).forEach(b=>b.onclick=()=>{spClose();go('support',b.dataset.tko)});
}

/* ---------- team ---------- */
async function spTeam(m){
  const r=await api('/api/admin/staff');if(!r.ok){m.innerHTML=`<p class="note">${esc(r.j.error)}</p>`;return}
  const D=SP.team=r.j;SP_PN=D.perms;const mgr=can('staff.manage'),myLvl=D.me.level;
  const ranksBelow=D.ranks.filter(x=>x.level<myLvl&&x.key!=='owner');
  const roleLvl=s=>s.level;
  m.innerHTML=spHead('Staff team',`${D.staff.length} people. ${mgr?'You can hire, promote, demote and remove anyone below your own rank.':'Only HR changes the team.'}`)+
    `${mgr?`<form class="card glass sp-hire" id="sph"><h3>Add or change someone</h3><div class="sp-hgrid"><label class="fld"><span>Roblox name or id</span><input class="txt" id="sphw" placeholder="They must have signed in once"></label>
      <label class="fld"><span>Rank</span><select class="txt" id="sphr"><option value="">No rank (side roles only)</option>${ranksBelow.map(x=>`<option value="${x.key}">${esc(x.name)}</option>`).join('')}</select></label>
      <label class="fld"><span>Title (optional)</span><input class="txt" id="spht" maxlength="40" placeholder="e.g. Night shift lead"></label></div>
      <div class="sp-roles">${D.roles.map(x=>`<label class="check"><input type="checkbox" value="${x.key}" data-sphrole> ${esc(x.name)}</label>`).join('')}</div>
      <label class="fld"><span>Private note (HR only)</span><input class="txt" id="sphn" maxlength="500"></label><div class="err" id="sphe"></div><button class="cta inline">Save</button></form>`:''}
    <div class="sp-team">${D.staff.slice().sort((a,b)=>b.level-a.level).map(s=>`<div class="sp-mem"><img src="/img/avatar/${s.robloxId}" alt="" loading="lazy"><div><b>${plLink(s.robloxId,s.username)}</b><span>${rankPill(s.rankName||(s.roles[0]&&D.roles.find(x=>x.key===s.roles[0]).name)||'Staff',roleLvl(s))}${s.roles.filter(x=>x).map(x=>`<i class="sp-role">${esc(D.roles.find(y=>y.key===x).name)}</i>`).join('')}${s.title?`<small>${esc(s.title)}</small>`:''}</span>${s.note?`<small class="sp-note">${esc(s.note)}</small>`:''}<small>${s.owner?'Owner (set on the server)':`Since ${dt(s.hiredAt)}`}</small></div>
      ${mgr&&!s.owner&&s.level<myLvl&&s.robloxId!==WAPI.me.robloxId?`<div class="sp-mact"><button class="cta ghost inline" data-spe="${s.robloxId}">Edit</button><button class="lnk bad" data-spr="${s.robloxId}">Remove</button></div>`:''}</div>`).join('')}</div>`;
  const f=$('#sph',m);
  if(f){f.onsubmit=async e=>{e.preventDefault();const body={who:$('#sphw',f).value.trim(),rank:$('#sphr',f).value||null,roles:$$('[data-sphrole]',f).filter(x=>x.checked).map(x=>x.value),title:$('#spht',f).value,note:$('#sphn',f).value};
      if(!body.rank&&!body.roles.length){$('#sphe',f).textContent='Pick a rank or at least one role. To remove someone, use Remove.';return}
      const x=await api('/api/admin/staff',body);if(!x.ok){$('#sphe',f).textContent=x.j.error;return}toast('Team updated.','win');spTeam(m)};
    $$('[data-spe]',m).forEach(b=>b.onclick=()=>{const s=D.staff.find(x=>String(x.robloxId)===b.dataset.spe);$('#sphw',f).value=s.username;$('#sphr',f).value=s.rank||'';$('#spht',f).value=s.title||'';$('#sphn',f).value=s.note||'';$$('[data-sphrole]',f).forEach(c=>c.checked=s.roles.includes(c.value));f.scrollIntoView({behavior:'smooth',block:'start'});$('#sphr',f).focus()});
    $$('[data-spr]',m).forEach(b=>b.onclick=async()=>{const s=D.staff.find(x=>String(x.robloxId)===b.dataset.spr);if(b.dataset.sure!=='1'){b.dataset.sure='1';b.textContent=`Remove ${s.username}?`;return}const x=await api('/api/admin/staff',{who:s.robloxId,rank:null,roles:[]});if(!x.ok)return toast(x.j.error,'loss');toast(`${s.username} is no longer on staff.`,'win');spTeam(m)})}
}

/* ---------- permissions matrix ---------- */
async function spPerms(m){
  const r=await api('/api/admin/staff');if(!r.ok){m.innerHTML=`<p class="note">${esc(r.j.error)}</p>`;return}
  const D=SP.team=r.j;SP_PN=D.perms;const edit=can('staff.perms'),myLvl=D.me.level;
  const cols=[...D.ranks.map(x=>({key:x.key,name:x.name,level:x.level})),...D.roles.map(x=>({key:x.key,name:x.name,level:5,side:1}))];
  m.innerHTML=spHead('Permissions',edit?'Switch single permissions on or off for a rank or role. A dot means it differs from the default. HR and Owner always have everything.':'What each rank and role may do. Only HR can change it.')+
    `<div class="sp-mx-wrap"><table class="sp-mx"><thead><tr><th>Permission</th>${cols.map(c=>`<th class="${c.side?'sd':''}"><span>${esc(c.name)}</span></th>`).join('')}</tr></thead><tbody>
    ${Object.entries(D.perms).map(([p,label])=>`<tr><th><b>${esc(label)}</b><small>${esc(p)}</small></th>${cols.map(c=>{const on=D.matrix[c.key].includes(p),def=(D.defaults[c.key]||[]).includes(p),locked=D.locked.includes(c.key)||!edit||(!c.side&&c.level>=myLvl);
      return`<td><button class="sp-cell${on?' on':''}${on!==def?' changed':''}" ${locked?'disabled':''} data-mxr="${c.key}" data-mxp="${p}" aria-pressed="${on}" aria-label="${esc(label)} for ${esc(c.name)}">${on?ic('check',14,2.6):''}</button></td>`}).join('')}</tr>`).join('')}</tbody></table></div>`;
  $$('[data-mxr]',m).forEach(b=>b.onclick=async()=>{const on=b.classList.contains('on'),role=b.dataset.mxr,perm=b.dataset.mxp,def=(D.defaults[role]||[]).includes(perm);
    const x=await api('/api/admin/staff/perm',!on===def?{role,perm,reset:true}:{role,perm,allowed:!on});if(!x.ok)return toast(x.j.error,'loss');spPerms(m)});
}

/* ---------- audit log ---------- */
const AUD={'staff.hire':'Hired','staff.change':'Changed rank','staff.remove':'Removed from staff','staff.perm':'Changed a permission','ticket.assign':'Assigned a ticket','ticket.reply':'Replied to a ticket','ticket.reply.note':'Added a staff note','ticket.close':'Closed a ticket','ticket.reopen':'Reopened a ticket','ticket.account':'Pushed account to a ticket'};
const audLabel=a=>AUD[a]||a.replace(/^mod\./,'').replace(/^business\//,'Business: ').replace(/^site\//,'Site: ').replace(/[./]/g,' ').replace(/^\w/,c=>c.toUpperCase());
const spAuditRows=L=>`<div class="sp-aud">${L.map(a=>`<div><time>${dtt(a.at)}</time><span><b>${esc(a.actorName||String(a.actor))}</b> ${esc(audLabel(a.action))}${a.target?` · ${plLink(a.target,a.targetName)}`:''}${a.detail&&(a.detail.reason||a.detail.ticket||a.detail.to||a.detail.perm)?` <small>${esc(a.detail.reason||a.detail.ticket||(a.detail.to?'to '+a.detail.to:'')||(a.detail.perm?a.detail.role+': '+a.detail.perm+' '+a.detail.allowed:''))}</small>`:''}</span></div>`).join('')}</div>`;
async function spAudit(m,who=''){
  const r=await api('/api/admin/audit?limit=300'+(who?'&who='+encodeURIComponent(who):''));if(!r.ok){m.innerHTML=`<p class="note">${esc(r.j.error)}</p>`;return}
  m.innerHTML=spHead('Audit log','Every staff action that worked: who did it, to whom and when.',`<form class="sp-q" id="spaq"><input class="txt" placeholder="Filter by staff or player" value="${esc(who)}"><button class="cta ghost inline">Filter</button></form>`)+`<section class="card glass">${r.j.log.length?spAuditRows(r.j.log):'<p class="note">Nothing logged yet.</p>'}</section>`;
  $('#spaq',m).onsubmit=e=>{e.preventDefault();spAudit(m,$('input',e.target).value.trim())};
}

/* ---------- signed agreements ---------- */
async function spLegal(m,who=''){
  const r=await api('/api/admin/signatures'+(who?'?who='+encodeURIComponent(who):''));if(!r.ok){m.innerHTML=`<p class="note">${esc(r.j.error)}</p>`;return}
  m.innerHTML=spHead('Agreements','Signed documents: who signed what, which version, and the drawn signature.',`<form class="sp-q" id="splq"><input class="txt" placeholder="Player, id or SIG- reference" value="${esc(who)}"><button class="cta ghost inline">Search</button></form>`)+
    `<section class="card glass">${r.j.signatures.length?plTable(['Signed','Player','Document','Version','Name','Network / device',''],r.j.signatures.map(s=>[dtt(s.signedAt),plLink(s.robloxId,s.username),esc(s.title),`<small>${esc(s.version)}</small>`,esc(s.name),`<small>${esc(s.net||'–')} ${esc(s.dev||'')}</small>`,`<button class="lnk" data-sig="${esc(s.id)}">View</button>`])):'<p class="note">No signatures found.</p>'}</section>`;
  $('#splq',m).onsubmit=e=>{e.preventDefault();spLegal(m,$('input',e.target).value.trim())};
  $$('[data-sig]',m).forEach(b=>b.onclick=()=>sigRecord(b.dataset.sig));
}

/* ---------- entry points ---------- */
PAGES.admin=()=>{go('home');spOpen()};
{const base=swAdminNav;swAdminNav=function(){base();const b=$('#nav [data-go="admin"]');if(b){b.removeAttribute('data-go');b.dataset.staff='1';b.onclick=()=>spOpen()}}}
function spNav(){if(WAPI.me&&WAPI.me.staff&&!$('#nav [data-staff]')){swAdminNav();const b=$('#nav [data-staff]');if(b){const r=WAPI.me.staff;b.querySelector('span').textContent='Staff';b.title=`Staff panel (${r.rankName||r.roleNames[0]||'Staff'})`}}}
WAPI.ready.then(()=>{spNav();if(location.pathname.replace(/\/+$/,'').toLowerCase()==='/admin'){if(WAPI.me&&WAPI.me.staff)spOpen(null,false);else{try{history.replaceState(null,'','/')}catch{};if(WAPI.live&&S.user)toast('The staff panel is for the TradeBlacket team.','loss')}}});
setInterval(spNav,5000);
// Staff ranks next to names on profiles
const spTag=s=>s?`<i class="sp-tag r${Math.min(7,Math.ceil((s.level||5)/10))}" title="TradeBlacket ${esc(s.rank)}${s.title?' · '+esc(s.title):''}">${ic('shield',11,2.4)}${esc(s.rank)}</i>`:'';
{const base=pfCard;pfCard=function(p,o){return base(p,o).replace('<div class="pf-badges">','<div class="pf-badges">'+spTag(p.staff))}}
