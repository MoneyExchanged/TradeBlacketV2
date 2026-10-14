'use strict';
/* =========================================================
   Profiles, laid out like a Discord profile: banner, avatar with a ring, display name, badges,
   About me, and a member card. TradePlus members (any active Trade Empire subscription tier) can
   theme theirs: banner, two accent colours, an effect and a name style. The editor shows a live
   preview next to the form, like Discord's.
   ========================================================= */
const PF_BANNERS={gold:['#3A2A0C','#E7C77F'],obsidian:['#07090D','#2A3140'],sapphire:['#0B1E4A','#3D8BFD'],emerald:['#062A1C','#2FD38A'],aurora:['#0E2A3A','#6CF2C2'],ocean:['#071A33','#2EC4E8'],sunset:['#3A0F1A','#F59E42'],ember:['#2A0A08','#F0566A'],matrix:['#04140A','#3FE08C'],royal:['#1A0B33','#A26BFA']};
const PF_EFFECTS=[['none','None'],['sparkle','Sparkle'],['glow','Glow'],['orbit','Orbit'],['rain','Gold rain']];
const PF_NAMES=[['plain','Plain'],['gold','Gold'],['gradient','Accent gradient'],['glow','Glow']];
const PF={data:null,preview:false};

function localProfile(){
  const P=S.profile;const tier=PF.preview?'TradePlus':null;
  return{username:S.user.name,robloxId:null,walletId:walletId(),tier,joined:S.stats.joined,bio:P.bio||'',pronouns:P.pronouns||'',status:P.status||'',
    banner:tier?P.pbanner||'gold':'default',accent:tier?P.accent||null:null,accent2:tier?P.accent2||null:null,effect:tier?P.effect||'none':'none',nameStyle:tier?P.nameStyle||'plain':'plain',me:true,admin:false};
}
async function loadProfile(name){
  if(WAPI.live){const r=await api('/api/profile/'+encodeURIComponent(name));return r.ok?r.j:null}
  return S.user&&name===S.user.name?localProfile():null;
}
const pfBadges=(p,lv)=>{
  const b=[];
  if(p.admin)b.push(['shield','Staff','TradeBlacket team']);
  if(p.tier)b.push(['gem',p.tier,'TradePlus member in Trade Empire']);
  b.push(['check','Verified','Roblox account verified by bio phrase']);
  if(lv!=null)b.push(['rewards',`Level ${lv}`,'Level on TradeBlacket']);
  if(S.user&&p.me&&S.stats.gotLimited)b.push(['cases','Limited pull','Pulled a limited from a case']);
  return b.map(([i,t,d])=>`<span class="pf-badge" title="${esc(d)}">${ic(i,13,2.2)}${esc(t)}</span>`).join('');
};
function pfCard(p,o={}){
  const[b1,b2]=PF_BANNERS[p.banner]||['#121821','#1C2633'];
  const a1=p.accent||b2,a2=p.accent2||b1;
  const avatarHtml=p.robloxId&&WAPI.live?`<img src="/img/avatar/${p.robloxId}" alt="">`:`<b>${esc((p.username||'?')[0].toUpperCase())}</b>`;
  return`<article class="pf${p.tier?' plus':''} fx-${p.effect||'none'}" style="--a1:${a1};--a2:${a2};--b1:${b1};--b2:${b2}">
    <div class="pf-banner">${p.effect&&p.effect!=='none'?'<i class="pf-fx"></i>':''}</div>
    <div class="pf-av"><span class="pf-avi" style="--h:${hash(p.username||'')%360}">${avatarHtml}</span><i class="pf-dot" title="Online"></i></div>
    <div class="pf-body">
      <h2 class="pf-name ns-${p.nameStyle||'plain'}">${esc(p.username)}</h2>
      <div class="pf-sub"><span>@${esc((p.username||'').toLowerCase())}</span>${p.pronouns?`<span>${esc(p.pronouns)}</span>`:''}</div>
      ${p.status?`<p class="pf-status">${esc(p.status)}</p>`:''}
      <div class="pf-badges">${pfBadges(p,o.level)}</div>
      <div class="pf-sec"><h4>About me</h4><p>${p.bio?esc(p.bio):'<span class="pf-empty">Nothing here yet.</span>'}</p></div>
      <div class="pf-sec pf-meta"><div><h4>Member since</h4><p>${new Date(p.joined||Date.now()).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}</p></div><div><h4>Wallet ID</h4><p><code>${esc(p.walletId||'')}</code></p></div></div>
      ${o.extra||''}
    </div></article>`;
}

PAGES.profile=(el,name)=>{
  if(!S.user&&!name){el.innerHTML=`<div class="empty"><h3>Sign in to set up your profile</h3><p>Write an About me, pick your badges and, with TradePlus, theme it.</p><button class="cta inline" data-open="login">Sign in</button></div>`;return}
  const who=name||S.user.name,mine=S.user&&who===S.user.name;
  el.innerHTML='<div class="inv-load"><div class="spin"></div></div>';
  loadProfile(who).then(p=>{
    if(!el.isConnected)return;
    if(!p){el.innerHTML=`<div class="empty"><h3>No profile found</h3><p>That player hasn't signed in to TradeBlacket yet.</p></div>`;return}
    PF.data=p;
    const st=S.stats,lv=mine?lvl():null;
    const showcase=mine?(S.profile.showcase||[]).map(u=>S.inv.find(x=>x.u===u)).filter(Boolean):[];
    const stats=mine?`<div class="pf-sec"><h4>On TradeBlacket</h4><div class="pf-stats">${[['Wagered',fmt0(st.wagered)],['Bets',fmt0(st.bets)],['Best multi',st.bestMult?st.bestMult.toFixed(2)+'×':'—'],['Cases',fmt0(st.cases)]].map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('')}</div></div>`:'';
    const sc=showcase.length?`<div class="pf-sec"><h4>Showcase</h4><div class="pf-show">${showcase.map(x=>`<span title="${esc(ITEM[x.id].n)}">${itemSvg(x.id)}</span>`).join('')}</div></div>`:'';
    el.innerHTML=`<div class="pf-page">
      <div class="pf-left">${pfCard(p,{level:lv,extra:stats+sc})}</div>
      ${mine?`<div class="pf-edit card glass" id="pfe"></div>`:''}
    </div>`;
    if(mine)drawEditor($('#pfe',el),p);
  });
};
function drawEditor(box,p){
  const plus=!!p.tier,live=WAPI.live,P=S.profile;
  const lock=plus?'':`<span class="pf-lock">${ic('lock',12,2.4)}TradePlus</span>`;
  box.innerHTML=`<h3>Edit profile</h3>
    <label class="fld"><span>About me</span><textarea class="txt" id="pfb" maxlength="190" rows="3" placeholder="What do you collect? What's your go-to game?">${esc(p.bio)}</textarea></label>
    <div class="pf-row"><label class="fld"><span>Pronouns</span><input class="txt" id="pfp" maxlength="24" value="${esc(p.pronouns)}" placeholder="e.g. he/him"></label><label class="fld"><span>Status</span><input class="txt" id="pfs" maxlength="60" value="${esc(p.status)}" placeholder="e.g. Saving for a Valkyrie"></label></div>
    <div class="pf-perks${plus?'':' locked'}">
      <div class="pf-ph"><b>Profile theme</b>${lock}</div>
      ${plus?'':`<p class="note">Themes are a TradePlus perk. Any active TradePlus tier in Trade Empire unlocks them here within 10 minutes.${live?'':' <button class="lnk" id="pftry">Try the look in this preview</button>'}</p>`}
      <span class="pf-l">Banner</span><div class="pf-sw">${Object.entries(PF_BANNERS).map(([k,[a,b]])=>`<button type="button" data-bn="${k}" class="${p.banner===k?'on':''}" style="background:linear-gradient(135deg,${a},${b})" title="${k}"${plus?'':' disabled'}></button>`).join('')}</div>
      <div class="pf-row"><label class="fld"><span>Accent</span><input type="color" id="pfa1" value="${p.accent||'#e7c77f'}"${plus?'':' disabled'}></label><label class="fld"><span>Second accent</span><input type="color" id="pfa2" value="${p.accent2||'#3d8bfd'}"${plus?'':' disabled'}></label></div>
      <span class="pf-l">Effect</span><div class="seg pf-seg" id="pfx">${PF_EFFECTS.map(([v,l])=>`<button type="button" data-v="${v}" class="${p.effect===v?'on':''}"${plus?'':' disabled'}>${l}</button>`).join('')}</div>
      <span class="pf-l">Name style</span><div class="seg pf-seg" id="pfn">${PF_NAMES.map(([v,l])=>`<button type="button" data-v="${v}" class="${p.nameStyle===v?'on':''}"${plus?'':' disabled'}>${l}</button>`).join('')}</div>
    </div>
    <div class="err" id="pfer"></div><button class="cta" id="pfsave">Save profile</button>`;
  const patch={};
  const preview=()=>{const q={...p,...patch};const card=$('.pf-left .pf');if(!card)return;const tmp=document.createElement('div');tmp.innerHTML=pfCard(q,{level:lvl(),extra:[...card.querySelectorAll('.pf-sec')].slice(2).map(x=>x.outerHTML).join('')});card.replaceWith(tmp.firstElementChild)};
  $('#pfb',box).oninput=e=>{patch.bio=e.target.value;preview()};
  $('#pfp',box).oninput=e=>{patch.pronouns=e.target.value;preview()};
  $('#pfs',box).oninput=e=>{patch.status=e.target.value;preview()};
  $$('[data-bn]',box).forEach(b=>b.onclick=()=>{patch.banner=b.dataset.bn;$$('[data-bn]',box).forEach(x=>x.classList.toggle('on',x===b));preview()});
  $('#pfa1',box).oninput=e=>{patch.accent=e.target.value;preview()};
  $('#pfa2',box).oninput=e=>{patch.accent2=e.target.value;preview()};
  wireSeg($('#pfx',box),v=>{patch.effect=v;preview()});wireSeg($('#pfn',box),v=>{patch.nameStyle=v;preview()});
  const tr=$('#pftry',box);if(tr)tr.onclick=()=>{PF.preview=true;go('profile')};
  $('#pfsave',box).onclick=async()=>{
    const btn=$('#pfsave',box);btn.disabled=true;
    if(live){const body={...patch};if(!plus)['banner','accent','accent2','effect','nameStyle'].forEach(k=>delete body[k]);
      const r=await api('/api/profile',body);btn.disabled=false;if(!r.ok){$('#pfer',box).textContent=r.j.error;return}PF.data=r.j}
    else{if('bio' in patch)P.bio=patch.bio;if('pronouns' in patch)P.pronouns=patch.pronouns;if('status' in patch)P.status=patch.status;
      if(plus){if(patch.banner)P.pbanner=patch.banner;if(patch.accent)P.accent=patch.accent;if(patch.accent2)P.accent2=patch.accent2;if(patch.effect)P.effect=patch.effect;if(patch.nameStyle)P.nameStyle=patch.nameStyle}save();btn.disabled=false}
    toast('Profile saved.','win');
  };
}
// Clicking a player's name opens their profile card.
openUser=function(name){
  if(S.user&&name===S.user.name){go('profile');return}
  if(name==='TradeBlacket')return;
  if(WAPI.live){loadProfile(name).then(p=>{if(p)modal(pfCard(p),{cls:'pf-modal'});else legacyUser(name)});return}
  legacyUser(name);
};
function legacyUser(name){
  const u=bot(name),h=hash(name);
  const p={username:name,walletId:'TBW-'+(h.toString(32).toUpperCase()+'XXXXXXXX').slice(0,4)+'-'+((h>>3).toString(32).toUpperCase()+'XXXXXXXX').slice(0,4),tier:h%3===0?['TradePlus','Essential','Silver','Platinum'][h%4]:null,joined:Date.now()-(h%400)*864e5,bio:u.bio,pronouns:'',status:'',
    banner:['gold','sapphire','emerald','royal','sunset','ocean'][h%6],effect:['none','sparkle','glow','orbit'][h%4],nameStyle:['plain','gold','gradient','glow'][h%4],me:false};
  if(!p.tier){p.banner='default';p.effect='none';p.nameStyle='plain'}
  modal(pfCard(p,{level:u.lvl}),{cls:'pf-modal'});
}
if(cur==='profile')go('profile');
