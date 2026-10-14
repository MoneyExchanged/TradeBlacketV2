'use strict';
/* =========================================================
   Site chrome: boot screen, settings, docs, support, wallet IDs and the live wins list under
   every game.
   ========================================================= */

/* ---------- boot screen ---------- */
const BOOT=(()=>{
  const el=$('#boot');if(!el)return{step(){},done(){}};
  const steps=['Starting up','Connecting to TradeBlacket','Loading your wallet','Opening the floor'];
  let n=0;const t0=performance.now();
  const bar=$('.bt-bar i',el),lab=$('.bt-step',el);
  function step(i){n=Math.max(n,i);if(bar)bar.style.width=Math.min(100,(n+1)/steps.length*100)+'%';if(lab)lab.textContent=steps[Math.min(n,steps.length-1)]}
  function done(){step(steps.length-1);const wait=Math.max(0,(REDUCED?200:1100)-(performance.now()-t0));setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),600)},wait)}
  step(0);
  return{step,done};
})();
(async()=>{
  try{await Promise.race([document.fonts?document.fonts.ready:0,sleep(1500)])}catch{}
  BOOT.step(1);
  // wallet.js checks /api/health on load; give it a moment, then the session.
  for(let i=0;i<25&&!WAPI.live&&!WAPI.me;i++)await sleep(80);
  BOOT.step(2);
  if(WAPI.live&&S.user)await Promise.race([syncMe(),sleep(2500)]);
  BOOT.step(3);BOOT.done();
})();
setTimeout(()=>BOOT.done(),5000);

/* ---------- preferences ---------- */
S.prefs=Object.assign({bg:true,sound:true,motion:true,hideBal:false,feed:true,chat:true,compact:false},S.prefs||{});
function applyPrefs(){
  const p=S.prefs;document.body.classList.toggle('hide-bal',!!p.hideBal);document.body.classList.toggle('calm',!p.motion);
  if(!p.chat&&innerWidth>1240)$('#app').classList.add('nochat');
}
applyPrefs();

/* ---------- wallet ID ---------- */
function walletId(){
  if(WAPI.me&&WAPI.me.walletId)return WAPI.me.walletId;
  if(!S.user)return null;const A='ABCDEFGHJKMNPQRSTVWXYZ23456789';let h=hash('wallet:'+S.user.name),s='';
  for(let i=0;i<8;i++){s+=A[h%A.length];h=Math.floor(h/7)+((i+3)*2654435761>>>0)%997}
  return `TBW-${s.slice(0,4)}-${s.slice(4)}`;
}
const copyBtn=(txt,label='Copy')=>`<button class="lx-copy" data-copy="${esc(txt)}">${ic('tag',13,2)}<span>${label}</span></button>`;
document.addEventListener('click',e=>{const b=e.target.closest('[data-copy]');if(!b)return;navigator.clipboard.writeText(b.dataset.copy).then(()=>toast('Copied.'),()=>toast(b.dataset.copy))});

/* ---------- settings ---------- */
PAGES.prefs=el=>{
  if(!S.user){el.innerHTML=`<div class="empty"><h3>Settings</h3><p>Sign in to manage your account.</p><button class="cta inline" data-open="login">Sign in</button></div>`;return}
  const M=WAPI.me,tier=M&&M.tier,p=S.prefs;
  const tog=(k,l,d)=>`<label class="set-tog"><span><b>${l}</b><small>${d}</small></span><input type="checkbox" data-pref="${k}" ${p[k]?'checked':''}><i></i></label>`;
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Account</div><h2>Settings</h2><p>Your account, how the site looks, and what other players see.</p></div></div>
  <div class="st2">
    <section class="card glass st2-acc">
      <div class="st2-id">${avatar(me(),56)}<div><b>${esc(S.user.name)}</b><span>${tier?`<i class="tp-badge">${esc(tier)}</i>`:'Member'} since ${new Date(S.stats.joined).toLocaleDateString(undefined,{month:'long',year:'numeric'})}</span></div><button class="cta ghost inline" data-go="profile">${ic('profile',16)}Edit profile</button></div>
      <dl class="st2-kv">
        <div><dt>Wallet ID</dt><dd><code>${esc(walletId()||'')}</code>${copyBtn(walletId()||'')}</dd></div>
        ${M?`<div><dt>Roblox user ID</dt><dd><code>${M.robloxId}</code></dd></div>`:''}
        <div><dt>TradePlus</dt><dd>${tier?`Active (${esc(tier)}). Profile themes are unlocked.`:'Not active. Subscribe in Trade Empire to unlock profile themes.'}</dd></div>
      </dl>
      <p class="note">Give support your wallet ID when you contact them. It's safe to share; it can't be used to sign in.</p>
    </section>
    <section class="card st2-sec"><h3>Display</h3>
      ${tog('bg','Live chart background','The moving market chart behind the site.')}
      ${tog('motion','Animations','Turn off to keep motion to a minimum.')}
      ${tog('hideBal','Hide balance','Blur your balance in the header, for streaming.')}
      ${tog('chat','Show chat','Open the chat panel when the site loads.')}
    </section>
    <section class="card st2-sec"><h3>Sound and privacy</h3>
      ${tog('sound','Sound effects','Spins, wins and drops.')}
      ${tog('feed','Show my bets in live feeds','Other players see your wins under each game.')}
    </section>
    <section class="card st2-sec"><h3>Account</h3>
      <div class="st2-links"><button data-go="settings">${ic('shield',16)}Responsible play</button><button data-go="support">${ic('chat',16)}Support</button><button data-go="docs">${ic('news',16)}Docs</button><button data-legal="tos">${ic('lock',16)}Terms of Service</button></div>
    </section>
  </div>`;
  $$('[data-pref]',el).forEach(i=>i.onchange=()=>{S.prefs[i.dataset.pref]=i.checked;save();applyPrefs();if(i.dataset.pref==='chat')$('#app').classList.toggle('nochat',!i.checked);toast('Saved.')});
};

/* ---------- docs ---------- */
const DOCS2=[
['start','Getting started',[['Signing in','TradeBlacket has no passwords. Enter your Roblox username, paste the phrase we give you into your Roblox About section, and press Verify. You can remove the phrase afterwards.'],['Your balance','Everything is played with Rodux from Trade Empire. Your balance sits in the header; hover it to see Rodux, items and stocks together.'],['Age','TradeBlacket is for players aged 18 and over.']]],
['wallet','Deposits and withdrawals',[['Rodux','Open Wallet, pick Trade Empire Rodux, and choose an amount. Transfers run while you are out of the game, because the game keeps your save open while you play.'],['Limiteds','Open Wallet and pick Limiteds to see your Trade Empire inventory. Tick items and press Deposit. Items in their 3-day holding period, listed on the in-game market, or waiting in game mail stay in the game.'],['Withdrawing','You can withdraw Rodux up to what you deposited, plus anything you were paid for items. Items you hold on TradeBlacket go back to your save with a fresh holding period.'],['Wallet ID','Your wallet ID (TBW-XXXX-XXXX) is under Settings. Support uses it to find your account.']]],
['items','Limiteds, selling and the market',[['Sell to TradeBlacket','Any limited you hold on the site can be sold to TradeBlacket for 90% of its Trade Empire value. The Rodux can be withdrawn.'],['Limiteds market','Players list real Trade Empire items for Rodux. Buying moves that exact copy to your Limiteds, and you can withdraw it to your save. Items sold to TradeBlacket are listed at their full value.'],['Limited Flip','Put items up against another player within 10% of the same value. The winner takes every item.']]],
['fair','Fairness',[['How results are made','Results come from a cryptographic random number generator. Limited Flip commits a seed before anyone joins and reveals it afterwards, so you can check the result yourself.'],['Checking a flip','Take the revealed seed, compute sha256(seed:joinerId:flipId), and look at the first byte. Even is Crown, odd is Tower.'],['Return to player','Each game shows its RTP. It is the share of Rodux paid back over many rounds, not a promise for one session.']]],
['play','Responsible play',[['Limits','Set screen time, deposit caps, a largest bet and a daily loss limit under Responsible play. Stricter limits start now; looser ones wait 24 hours.'],['Breaks','Take a break or exclude yourself. Neither can be ended early. You can always withdraw.']]],
['plus','TradePlus',[['What it unlocks','If your Trade Empire account has an active TradePlus subscription (any tier), you can theme your TradeBlacket profile: banner, accent colours, a profile effect and a name style.'],['How it is checked','We read your subscription from your Trade Empire save. Changes can take up to 10 minutes to show.']]],
['help','Getting help',[['Support','Open a ticket under Support. Pick a category, describe what happened, and include times if a transfer is involved. Replies appear in the same ticket.'],['Slots','Slots are invite-only for now. Join the waitlist on the Slots page or enter an access code.']]],
];
PAGES.docs=(el,sec)=>{
  const k=DOCS2.some(d=>d[0]===sec)?sec:'start',d=DOCS2.find(x=>x[0]===k);
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Docs</div><h2>${esc(d[1])}</h2><p>How TradeBlacket works, in plain words.</p></div></div>
  <div class="legal-wrap"><nav class="legal-nav">${DOCS2.map(x=>`<button data-go="docs" data-p="${x[0]}" class="${x[0]===k?'on':''}">${esc(x[1])}</button>`).join('')}</nav>
  <article class="card glass docs">${d[2].map(([h,t])=>`<h4>${esc(h)}</h4><p>${esc(t)}</p>`).join('')}<div class="docs-next">${(()=>{const i=DOCS2.indexOf(d),n=DOCS2[i+1];return n?`<button class="cta ghost inline" data-go="docs" data-p="${n[0]}">Next: ${esc(n[1])}</button>`:`<button class="cta inline" data-go="support">Still stuck? Contact support</button>`})()}</div></article></div>`;
};

/* ---------- support ---------- */
const SUP_CATS=[['deposit','Deposit'],['withdraw','Withdrawal'],['limiteds','Limiteds'],['game','A game'],['account','Account'],['other','Something else']];
async function supLoad(){
  if(WAPI.live){const r=await api('/api/support');return r.ok?r.j:{tickets:[]}}
  return{admin:false,tickets:S.tickets||[]};
}
PAGES.support=el=>{
  const draw=async()=>{
    const D=S.user?await supLoad():{tickets:[]};if(!el.isConnected)return;
    el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Support</div><h2>Support</h2><p>Questions about a transfer, an item or your account. We reply in the ticket, usually within a day.</p></div></div>
    <div class="sup">
      <div class="mstack">
        <section class="card glass"><h3>Quick answers</h3>
          <details><summary>My deposit says I'm in the game</summary><p>Leave Trade Empire completely, wait a few seconds, then try again. The game keeps your save open while you play.</p></details>
          <details><summary>An item won't deposit</summary><p>Items in their 3-day holding period, listed on the in-game market, or waiting in game mail have to stay in the game until they're free.</p></details>
          <details><summary>How much can I withdraw?</summary><p>Up to the Rodux you deposited, plus Rodux you were paid for items. Bonus Rodux has to be wagered once first.</p></details>
          <details><summary>Where do bought items go?</summary><p>To your Limiteds on TradeBlacket. Open Wallet, pick Limiteds, switch to On TradeBlacket, and withdraw them to your save.</p></details>
          <button class="cta ghost inline" data-go="docs">Read the docs</button>
        </section>
        ${S.user?`<form class="card glass sup-new" id="snew"><h3>Open a ticket</h3>
          <label class="fld"><span>Topic</span><select class="txt" id="scat">${SUP_CATS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>
          <label class="fld"><span>Subject</span><input class="txt" id="ssub" maxlength="90" placeholder="e.g. Withdrawal didn't arrive"></label>
          <label class="fld"><span>What happened?</span><textarea class="txt" id="sbody" rows="5" maxlength="4000" placeholder="Include times and amounts if a transfer is involved."></textarea></label>
          <p class="note">Your wallet ID <code>${esc(walletId()||'')}</code> is attached automatically.</p>
          <div class="err" id="serr"></div><button class="cta">Send ticket</button></form>`:`<div class="card"><p>Sign in to open a ticket.</p><button class="cta inline" data-open="login">Sign in</button></div>`}
      </div>
      <section class="sup-list"><div class="sec-h"><h3 class="sec">${D.admin?'All tickets':'Your tickets'}</h3></div>
        ${D.tickets.length?D.tickets.map(t=>`<details class="card sup-t ${t.status}"><summary><span class="sup-s ${t.status}">${t.status==='answered'?'Answered':t.status==='closed'?'Closed':'Open'}</span><b>${esc(t.subject)}</b><small>${esc(t.id)}${D.admin?`, ${esc(t.player||'')}, ${esc(t.walletId)}`:''}</small></summary>
          <div class="sup-msgs">${t.messages.map(m=>`<div class="sup-m${m.staff?' staff':''}"><b>${m.staff?'TradeBlacket Support':D.admin?esc(t.player||'Player'):'You'}</b><p>${esc(m.body)}</p><time>${new Date(m.at).toLocaleString()}</time></div>`).join('')}</div>
          ${t.status!=='closed'?`<form class="sup-reply" data-t="${esc(t.id)}"><textarea class="txt" rows="2" placeholder="Write a reply"></textarea><div><button class="cta inline">Reply</button><button type="button" class="cta ghost inline" data-close="${esc(t.id)}">Close ticket</button></div></form>`:''}
        </details>`).join(''):`<div class="empty"><h3>No tickets yet</h3><p>Anything you send shows up here with our replies.</p></div>`}
      </section>
    </div>`;
    const f=$('#snew',el);if(f)f.onsubmit=async e=>{e.preventDefault();const b={category:$('#scat',el).value,subject:$('#ssub',el).value,body:$('#sbody',el).value};
      if(WAPI.live){const r=await api('/api/support',b);if(!r.ok){$('#serr',el).textContent=r.j.error;return}}
      else{if(b.subject.trim().length<4||b.body.trim().length<10){$('#serr',el).textContent='Add a subject and a little more detail.';return}S.tickets=[{id:'TKT-'+uid().slice(0,8).toUpperCase(),subject:b.subject,category:b.category,status:'open',messages:[{staff:0,body:b.body,at:Date.now()}]},...(S.tickets||[])];save()}
      toast('Ticket sent. We’ll reply here.','win');draw()};
    $$('.sup-reply',el).forEach(fm=>fm.onsubmit=async e=>{e.preventDefault();const body=$('textarea',fm).value.trim();if(!body)return;
      if(WAPI.live){const r=await api(`/api/support/${fm.dataset.t}/reply`,{body});if(!r.ok)return toast(r.j.error,'loss')}
      else{const t=S.tickets.find(x=>x.id===fm.dataset.t);t.messages.push({staff:0,body,at:Date.now()});save()}draw()});
    $$('[data-close]',el).forEach(b=>b.onclick=async()=>{if(WAPI.live)await api(`/api/support/${b.dataset.close}/close`,{});else{S.tickets.find(x=>x.id===b.dataset.close).status='closed';save()}draw()});
  };
  draw();
};

/* ---------- live wins under every game ---------- */
const FEED_PAGES=new Set([...ORIG,'cases','case','battles','battle','upgrader','predictions','stocks','flip']);
const FEED_KEY={case:'cases',battle:'battles',flip:'coinflip'};
function gameFeedHtml(key){
  const rows=FEED.filter(f=>f.game===key&&(!f.me||S.prefs.feed!==false)).slice(0,12);
  return rows.length?rows.map(f=>`<div class="gw-row${f.me?' me':''}"><span class="u" data-user="${esc(f.u.name)}">${avatar(f.u,22)}${esc(f.u.name)}</span><span class="b">${chip(12)}${fmt(f.bet)}</span><span class="m">${f.mult.toFixed(2)}×</span><span class="p ${f.payout>f.bet?'w':'l'}">${f.payout>f.bet?'+':''}${chip(12)}${fmt(f.payout-f.bet)}</span><time>${f.t}</time></div>`).join(''):'<p class="note" style="padding:12px 4px">No rounds yet. Wins show up here as they happen.</p>';
}
{const base=go;go=function(v,p){base(v,p);const key=FEED_KEY[v]||v;if(!FEED_PAGES.has(v)||!GAMES[key])return;
  const page=$('#view>.page');if(!page||page.querySelector('.gw'))return;
  for(let i=FEED.filter(f=>f.game===key).length;i<7;i++){const b=botBet();b.game=key;FEED.push(b)}
  page.insertAdjacentHTML('beforeend',`<section class="gw card glass"><div class="sec-h" style="margin-top:0"><h3 class="sec">${ic('users',17)}Everyone's ${GAMES[key].n} results</h3><span class="note"><i class="live-dot"></i>Live</span></div><div class="gw-head"><span>Player</span><span>Bet</span><span>Multi</span><span>Won</span><span>Time</span></div><div class="gw-list" data-gw="${key}">${gameFeedHtml(key)}</div></section>`)}}
{const base=addFeed;addFeed=function(f){base(f);const l=document.querySelector(`[data-gw="${f.game}"]`);if(l)l.innerHTML=gameFeedHtml(f.game)}}
// make bots play every game, so each list fills up
setInterval(()=>{const k=document.querySelector('[data-gw]');if(!k)return;const g=k.dataset.gw,b=botBet();b.game=g;addFeed(b)},3200);
