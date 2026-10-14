'use strict';
/* =========================================================
   Gift cards, and how money is shown.

   Gift cards ($5 / $10 / $100 / $500) are given away by the Trade Empire team and creators; they
   cannot be bought. A card pays what that many dollars buys in Rodux at the game's own Rodux prices
   (see /api/rates). Every Rodux amount on the site shows its value in US dollars on hover, and each
   player chooses what their balance shows: Rodux, US dollars, Robux, or the value of their limiteds.
   ========================================================= */
let RATE={roduxPerUsd:11461,roduxPerRobux:143.27,robuxPerUsd:80,values:[5,10,100,500].map(u=>({usd:u,rodux:u*11461})),source:'Trade Empire Rodux packs'};
(async()=>{try{const r=await fetch('/api/rates',{cache:'no-store'});if(r.ok){const j=await r.json();if(j.roduxPerUsd>0){RATE=j;renderBal()}}}catch{}})();
const toUsd=v=>v/RATE.roduxPerUsd,toRobux=v=>v/RATE.roduxPerRobux;
const usdStr=v=>{const d=toUsd(v);return'US$'+(d>=1000?d.toLocaleString('en-US',{maximumFractionDigits:0}):d.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}))};
const robuxStr=v=>'R$ '+Math.round(toRobux(v)).toLocaleString('en-US');
S.prefs.show=S.prefs.show||'rodux';

/* ---------- the balance in the top bar ---------- */
const SHOW=[['rodux','Rodux','Your Rodux balance'],['usd','US dollars','Your balance in US dollars'],['robux','Robux','Your balance in Robux'],['limiteds','Limiteds','What your limiteds are worth']];
function limVal(){return invVal()+((typeof WAPI!=='undefined'&&WAPI.me&&WAPI.me.itemValue)||0)}
function balText(v){const m=S.prefs.show;return m==='usd'?usdStr(v):m==='robux'?robuxStr(v):m==='limiteds'?fmt0(limVal()):fmt(v)}
function renderBal(){
  const el=$('#bal'),ic0=$('#chipico');if(!el)return;const m=S.prefs.show;
  el.textContent=balText(m==='limiteds'?limVal():S.bal);
  ic0.innerHTML=m==='usd'||m==='robux'?'':m==='limiteds'?HEX(18):chip(18);ic0.style.display=m==='usd'||m==='robux'?'none':'';
  $('#balbox').title=m==='limiteds'?`Limiteds worth ${fmt0(limVal())} Rodux (${usdStr(limVal())})`:`${fmt(S.bal)} Rodux, about ${usdStr(S.bal)}`;
}
// setBal animates the number; it now animates in whichever unit the player picked.
setBal=function(v){
  const prev=S.bal;S.bal=Math.max(0,r2(v));save();
  const el=$('#bal'),box=$('#balbox'),from=shown,to=S.bal,t0=performance.now();
  box.classList.remove('bump','dip');void box.offsetWidth;box.classList.add(to>=prev?'bump':'dip');
  if(S.prefs.show==='limiteds'){renderBal();shown=to;return}
  (function step(t){const p=Math.min(1,(t-t0)/550),e=1-Math.pow(1-p,3);shown=from+(to-from)*e;el.textContent=balText(shown);if(p<1)requestAnimationFrame(step);else renderBal()})(t0);
};
renderBal();setInterval(()=>{if(S.prefs.show==='limiteds')renderBal()},5000);
// The balance popover is filled on hover by core.js; these listeners run after it and add to it.
{const extra=()=>{const p=$('#balpop');if(!p||p.querySelector('.bp-usd'))return;
  const tot=S.bal+invVal();
  p.insertAdjacentHTML('beforeend',`<div class="bp-usd"><span>Worth about</span><b>${usdStr(tot)}</b><small>${robuxStr(tot)}</small></div>
    <div class="bp-show"><span>Show my balance as</span><div>${SHOW.map(([k,l])=>`<button data-show="${k}" class="${S.prefs.show===k?'on':''}">${l}</button>`).join('')}</div></div>
    <button class="bp-gift" data-go="giftcard">${ic('gem',15)}Redeem a gift card</button>`)};
  $('#wallet').addEventListener('mouseenter',extra);$('#wallet').addEventListener('focusin',extra)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-show]');if(!b)return;e.preventDefault();S.prefs.show=b.dataset.show;save();renderBal();
  $$('[data-show]').forEach(x=>x.classList.toggle('on',x.dataset.show===S.prefs.show));toast(`Your balance now shows ${SHOW.find(s=>s[0]===S.prefs.show)[1]}.`)});

/* ---------- hover any Rodux amount: its value in dollars ---------- */
const RXT=document.createElement('div');RXT.id='rxtip';RXT.setAttribute('role','tooltip');document.body.appendChild(RXT);
let rxOn=null;
function rxAmount(el){
  // an amount is an element whose own children include the Rodux chip (or the limiteds hexagon) and a number
  for(let n=el,i=0;n&&i<3;n=n.parentElement,i++){
    if(n.id==='rxtip'||n.closest('#balpop .bp-show'))return null;
    const ico=[...n.children].find(c=>c.matches&&c.matches('svg.chip,svg.hexi'));
    if(!ico)continue;
    const m=/(-?[\d,]+(?:\.\d+)?)/.exec(n.textContent.replace(/\s/g,''));if(!m)return null;
    const v=Math.abs(parseFloat(m[1].replace(/,/g,'')));return v>0?{el:n,v}:null;
  }
  return null;
}
document.addEventListener('mouseover',e=>{
  const a=e.target instanceof Element?rxAmount(e.target):null;
  if(!a){if(rxOn&&!(e.target instanceof Element&&rxOn.contains(e.target))){RXT.classList.remove('on');rxOn=null}return}
  if(a.el===rxOn)return;rxOn=a.el;
  RXT.innerHTML=`<b>${usdStr(a.v)}</b><span>${robuxStr(a.v)} · ${fmt0(a.v)} Rodux</span>`;
  const r=a.el.getBoundingClientRect();RXT.classList.add('on');
  const w=RXT.offsetWidth;RXT.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2))+'px';RXT.style.top=(r.top>60?r.top-RXT.offsetHeight-8:r.bottom+8)+'px';
});
addEventListener('scroll',()=>{RXT.classList.remove('on');rxOn=null},true);

/* ---------- Settings: balance display ---------- */
{const base=PAGES.prefs;PAGES.prefs=el=>{base(el);const st=$('.st2',el);if(!st)return;
  st.insertAdjacentHTML('afterbegin',`<section class="card glass st2-sec st2-show"><h3>Balance display</h3><p class="note">What the balance in the top bar shows. Hover any Rodux amount on the site to see it in US dollars.</p>
    <div class="show-opts">${SHOW.map(([k,l,d])=>`<button data-show="${k}" class="${S.prefs.show===k?'on':''}"><b>${l}</b><small>${d}</small><span>${k==='usd'?usdStr(S.bal):k==='robux'?robuxStr(S.bal):k==='limiteds'?fmt0(limVal())+' Rodux':fmt(S.bal)}</span></button>`).join('')}</div>
    <p class="note">1 US dollar is about ${fmt0(RATE.roduxPerUsd)} Rodux, worked out from what Rodux costs in Trade Empire.</p></section>`)}}

/* ---------- redeeming ---------- */
const GC_LOOK={5:['Bronze','#C98A4B','#6B3E16'],10:['Silver','#C9D3DF','#4C5866'],100:['Gold','#F3D27A','#8A5A0A'],500:['Black','#E7C77F','#0B0E13']};
const gcFace=(usd,small)=>{const [n,a,b]=GC_LOOK[usd],v=(RATE.values.find(x=>x.usd===usd)||{rodux:usd*RATE.roduxPerUsd}).rodux;
  return`<div class="gcf v${usd}${small?' sm':''}" style="--a:${a};--b:${b}"><div class="gcf-top"><span>TradeBlacket</span><i>${n}</i></div><b>$${usd}</b><div class="gcf-bot"><span>${chip(13)}${fmt0(v)} Rodux</span><small>Gift card</small></div></div>`};
PAGES.giftcard=el=>{
  const mine=WAPI.live&&WAPI.me?WAPI.me.transfers.filter(t=>/gift card/.test(t.reason||'')):(S.gifts||[]);
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Account</div><h2>Gift cards</h2><p>Got a code from a creator or the Trade Empire team? Redeem it here and the Rodux goes straight to your balance.</p></div></div>
  <section class="gc-hero">
    <div class="gc-faces">${[5,10,100,500].map(u=>gcFace(u)).join('')}</div>
    <form class="gc-redeem" id="gcf"><label for="gci">Gift card code</label><div><input id="gci" class="txt" placeholder="TBG-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" maxlength="22"><button class="cta inline" id="gcb">Redeem</button></div><div class="err" id="gce"></div>
      <p class="note">Gift cards can't be bought. The Trade Empire team and creators give them away, so only use codes from their official channels. A card is worth its dollar value in Rodux, worked out from Trade Empire's Rodux prices when you redeem it.</p></form>
  </section>
  <div id="gcwin"></div>
  <section class="card"><h3 class="sec" style="margin:0 0 10px">Your gift cards</h3>${mine.length?`<ul class="al">${mine.map(t=>`<li><span class="vk grant">${esc((t.reason||'').replace(' gift card',''))}</span><div><b>${chip(13)}${fmt0(t.amount)} Rodux</b><small>${new Date(t.created_at||t.t).toLocaleString()} · ${t.kind==='bonus'?'bonus Rodux, plays on TradeBlacket':'can be withdrawn to Trade Empire'}</small></div></li>`).join('')}</ul>`:'<p class="note">No gift cards redeemed yet.</p>'}</section>`;
  if(!S.user){$('#gcf',el).innerHTML=`<p>Sign in to redeem a gift card.</p><button class="cta inline" data-open="login">Sign in</button>`;return}
  $('#gcf',el).onsubmit=async e=>{e.preventDefault();const code=$('#gci',el).value.trim();if(!code)return;$('#gce',el).textContent='';$('#gcb',el).disabled=true;
    let r;
    if(WAPI.live){const x=await api('/api/giftcards/redeem',{code});$('#gcb',el).disabled=false;if(!x.ok){$('#gce',el).textContent=x.j.error;return}r=x.j;syncMe()}
    else{$('#gcb',el).disabled=false;if(!/^(TBG)?[A-Z2-9]{12}$/i.test(code.replace(/[^a-z0-9]/gi,''))){$('#gce',el).textContent='Enter the whole gift card code, like TBG-ABCD-EFGH-JKLM.';return}
      r={usd:10,rodux:10*RATE.roduxPerUsd,withdrawable:false,code:'TBG-••••'};bonus(r.rodux);S.gifts=[{reason:'$10 gift card',amount:r.rodux,kind:'bonus',t:Date.now()},...(S.gifts||[])];save()}
    $('#gci',el).value='';
    $('#gcwin',el).innerHTML=`<section class="gc-win">${gcFace(r.usd,true)}<div><h3>+${fmt0(r.rodux)} Rodux</h3><p>Your $${r.usd} gift card was added to your balance${r.withdrawable?'. You can withdraw it to Trade Empire.':' as bonus Rodux to play with on TradeBlacket.'}</p></div></section>`;
    confetti(innerWidth/2,innerHeight/3,140);toast(`$${r.usd} gift card redeemed: +${fmt0(r.rodux)} Rodux`,'win');
  };
};

/* ---------- Admin → Gift cards ---------- */
async function admGifts(box){
  if(!WAPI.live){box.innerHTML='<p class="note">Preview: gift cards are made on the live site.</p>';return}
  const r=await api('/api/admin/giftcards');if(!box.isConnected)return;if(!r.ok){box.innerHTML=`<p class="note">${esc(r.j.error)}</p>`;return}
  const {rate,cards,totals}=r.j;
  box.innerHTML=`<div class="gca">
    <section class="card"><h4>Make gift cards</h4>
      <div class="gca-vals">${[5,10,100,500].map(u=>`<label><input type="radio" name="gcu" value="${u}" ${u===10?'checked':''}>${gcFace(u,true)}</label>`).join('')}</div>
      <div class="wl-row"><label class="fld"><span>How many</span><input class="txt" id="gcn" type="number" min="1" max="100" value="1"></label><label class="fld"><span>For (creator or giveaway)</span><input class="txt" id="gcno" maxlength="80" placeholder="e.g. Builderman stream giveaway"></label><label class="fld"><span>Expires</span><select class="txt" id="gcd"><option value="0">Never</option><option value="7">In 7 days</option><option value="30">In 30 days</option><option value="90">In 90 days</option></select></label></div>
      <label class="set-tog"><span><b>Can be withdrawn to Trade Empire</b><small>Off: the Rodux plays on TradeBlacket only, so a giveaway never adds Rodux to the game. On: it can be withdrawn like deposited Rodux.</small></span><input type="checkbox" id="gcw"><i></i></label>
      <button class="cta inline" id="gcmk">Make gift cards</button><div id="gcout"></div></section>
    <section class="card"><h4>What a dollar is worth</h4>
      <p class="ac-msg">${fmt0(rate.roduxPerUsd)} Rodux per US dollar = ${rate.roduxPerRobux} Rodux per Robux (median of the packs below) × ${rate.robuxPerUsd} Robux per dollar. ${esc(rate.source)}.</p>
      ${plTable(['Pack','Robux','Rodux per Robux'],rate.packs.slice().sort((a,b)=>a.perRobux-b.perRobux).map(p=>[esc(p.name),fmt0(p.robux),(Math.round(p.perRobux*100)/100).toFixed(2)]))}
      <dl class="ac-kv">${rate.values.map(v=>`<div><dt>$${v.usd} card</dt><dd>${fmt0(v.rodux)}</dd></div>`).join('')}</dl></section>
  </div>
  <div class="sec-h"><h3 class="sec">All gift cards</h3><span class="note">${totals.made} made · ${totals.redeemed} redeemed · $${fmt0(totals.usdRedeemed)} = ${fmt0(totals.roduxRedeemed)} Rodux given</span></div>
  ${plTable(['Code','Value','For','Status','Redeemed by','Made',''],cards.map(c=>[`<code data-copy="${esc(c.code)}">${esc(c.code)}</code>`,`$${c.usd}${c.withdrawable?' <span class="ac-pill is-gold">withdrawable</span>':''}`,esc(c.note||''),plStat(c.status==='active'?'open':c.status==='redeemed'?'paid':c.status)||esc(c.status),c.redeemedBy?`${plLink(c.redeemedId,c.redeemedBy)}<br><small>${fmt0(c.rodux)} Rodux · ${dtt(c.redeemedAt)}</small>`:'',`${dt(c.at)}${c.expires?`<br><small>expires ${dt(c.expires)}</small>`:''}`,c.status==='active'?`<button class="lnk" data-gcv="${esc(c.code)}">Cancel</button>`:'']),'No gift cards yet.')}`;
  $('#gcmk',box).onclick=async()=>{const usd=Number($('[name=gcu]:checked',box).value);
    const x=await api('/api/admin/giftcards',{usd,count:$('#gcn',box).value,note:$('#gcno',box).value,days:$('#gcd',box).value,withdrawable:$('#gcw',box).checked});
    if(!x.ok)return toast(x.j.error,'loss');
    toast(`${x.j.codes.length} gift card${x.j.codes.length===1?'':'s'} made.`,'win');await admGifts(box);
    $('#gcout',box).innerHTML=`<p class="note">New $${x.j.usd} codes, worth ${fmt0(x.j.rodux)} Rodux each right now. Copy them now:</p><textarea class="txt gc-codes" readonly rows="${Math.min(8,x.j.codes.length)}">${x.j.codes.join('\n')}</textarea><button class="cta ghost inline" data-copy="${esc(x.j.codes.join('\n'))}">Copy all</button>`};
  $$('[data-gcv]',box).forEach(b=>b.onclick=async()=>{const x=await api('/api/admin/giftcards/void',{code:b.dataset.gcv});if(!x.ok)return toast(x.j.error,'loss');toast('Gift card cancelled.');admGifts(box)});
}
