'use strict';
/* =========================================================
   Refer a friend. Every player has a link; a friend who signs up with it and is let in pays the
   referrer 450 bonus Rodux. Bonus Rodux plays on the site but cannot be withdrawn to Trade Empire.
   ========================================================= */
const REF_REWARD=()=>(WAPI.me&&WAPI.me.referral&&WAPI.me.referral.reward)||450;
function refCode(){
  if(WAPI.me&&WAPI.me.referral)return WAPI.me.referral.code;
  // preview: a stable made-up code from the player's name
  const n=(S.user&&S.user.name)||'guest',A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let h=7,c='';
  for(const ch of n)h=(h*31+ch.charCodeAt(0))>>>0;for(let i=0;i<8;i++){c+=A[h%32];h=Math.floor(h/32)+(i+1)*977}return c;
}
const refLink=()=>`${/^https?:$/.test(location.protocol)&&!/claude|localhost|127\.0\.0\.1/.test(location.hostname)?location.origin:'https://tradeblacket.com'}/?ref=${refCode()}`;
const REF_ST={pending:['Waiting to get in','wait'],paid:['Paid','paid'],void:['No reward','void']};

PAGES.refer=async el=>{
  const head=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Account</div><h2>Refer a friend</h2><p>Invite friends to TradeBlacket and get ${fmt0(REF_REWARD())} Rodux for each one who gets in.</p></div></div>`;
  if(!S.user){el.innerHTML=head+`<div class="empty"><h3>Sign in to get your invite link</h3><p>Your link is tied to your Roblox account.</p><button class="cta inline" data-open="login">Sign in</button></div>`;return}
  el.innerHTML=head+`<div id="rfb"><div class="spin"></div></div>`;
  let v;
  if(WAPI.live){const r=await api('/api/referrals');if(!r.ok){$('#rfb',el).innerHTML=`<div class="empty"><h3>Could not load your referrals</h3><p>${esc(r.j.error||'Try again in a moment.')}</p></div>`;return}v=r.j}
  else v={code:refCode(),reward:450,invited:0,paid:0,pending:0,earned:0,friends:[]};
  if(!$('#rfb',el))return;
  const link=refLink();
  $('#rfb',el).innerHTML=`
    <section class="rf-hero">
      <div class="rf-copy">
        <span class="rf-amt">${chip(26)}<b>${fmt0(v.reward)}</b><i>Rodux per friend</i></span>
        <h3>Your invite link</h3>
        <div class="rf-link"><input class="txt" readonly value="${esc(link)}" aria-label="Your invite link" id="rfl"><button class="cta inline" data-copy="${esc(link)}">Copy link</button>${navigator.share?'<button class="cta ghost inline" id="rfs">Share</button>':''}</div>
        <p class="note">Or give them your code: <b class="wl-chip">${esc(v.code)}</b></p>
      </div>
      <dl class="rf-stats">
        <div><dt>Invited</dt><dd>${fmt0(v.invited)}</dd></div>
        <div><dt>Waiting to get in</dt><dd>${fmt0(v.pending)}</dd></div>
        <div><dt>Rewarded</dt><dd>${fmt0(v.paid)}</dd></div>
        <div><dt>Rodux earned</dt><dd class="g">${fmt0(v.earned)}</dd></div>
      </dl>
    </section>
    <section class="rf-how card">
      <h3>How it works</h3>
      <ol><li><b>Share your link.</b><span>Send it to a friend who plays Trade Empire.</span></li>
      <li><b>They sign up and get in.</b><span>Your friend signs in with Roblox through your link and is let in from the waitlist.</span></li>
      <li><b>You get ${fmt0(v.reward)} Rodux.</b><span>It lands in your balance as bonus Rodux, ready to play.</span></li></ol>
      <p class="note">Bonus Rodux can be played on TradeBlacket but not withdrawn to Trade Empire. Friends on your network or device, and banned accounts, don't count. Making extra accounts to refer yourself gets those accounts banned.</p>
    </section>
    <section class="card rf-list"><h3>Your friends</h3>${v.friends.length?`<table><thead><tr><th>Friend</th><th>Joined</th><th>Status</th></tr></thead><tbody>${v.friends.map(f=>{const [l,c]=REF_ST[f.status]||[f.status,''];return`<tr><td>${esc(f.name)}</td><td>${new Date(f.at).toLocaleDateString()}</td><td><span class="rf-st ${c}">${f.status==='paid'?`+${fmt0(f.reward)} Rodux`:esc(l)}</span>${f.status==='void'&&f.reason?`<span class="note"> ${esc(f.reason)}</span>`:''}</td></tr>`}).join('')}</tbody></table>`:`<p class="note">Nobody has signed up with your link yet. Friends show up here as soon as they do.</p>`}</section>`;
  const sh=$('#rfs',el);if(sh)sh.onclick=()=>navigator.share({title:'TradeBlacket',text:'Join me on TradeBlacket, the Trade Empire site.',url:link}).catch(()=>{});
  $('#rfl',el).onfocus=e=>e.target.select();
};
