'use strict';
/* =========================================================
   Docs centre (tradeblacket.com/docs): how TradeBlacket works, the provably fair system with your own
   seeds and a verifier, and every legal document. Readable without signing in.
   ========================================================= */
const DOCS_TREE=[
  ['Getting started',[['welcome','Welcome to TradeBlacket'],['account','Signing in and your account'],['access','Waitlist and access codes']]],
  ['Rodux and items',[['wallet','Deposits and withdrawals'],['limiteds','Limiteds, flips and the market'],['bonus','Bonus Rodux, referrals and gift cards']]],
  ['Games',[['fair','Provably fair: your seeds'],['verify','Verify a result'],['games','Games and return to player'],['play','Playing responsibly']]],
  ['Help and safety',[['tradeplus','TradePlus profile themes'],['standing','Account standing and moderation'],['support','Support tickets'],['staff','Staff ranks'],['business','TradeBlacket Business']]],
  ['Legal',[['legal','Agreements and e-signatures']]],
];
const DOC_TITLE=Object.fromEntries(DOCS_TREE.flatMap(([,a])=>a));
const RTP=[['Crash','99%'],['Mines','99%'],['Dice','99%'],['Plinko','99%'],['Limbo','99%'],['Blackjack','99.4%'],['Towers','98%'],['Coinflip','98%'],['Cups','96%'],['Upgrader','95%'],['Roulette','93.3%'],['Cases','92%'],['Battles','92%']];
const dP=(...a)=>a.map(x=>`<p>${x}</p>`).join('');
const DOC_BODY={
  welcome:()=>dP('TradeBlacket is the casino, cases and coinflip site for <b>Trade Empire</b> on Roblox. You play with the Rodux and limiteds from your Trade Empire save, and bring them back whenever you like.','Everything runs on Trade Empire items: nothing on TradeBlacket can be bought with real money, and nothing can be cashed out. You must be 18 or older.')+`<div class="dc-cards">${[['wallet','Move Rodux in and out'],['fair','Check every result yourself'],['play','Set your limits'],['support','Get help']].map(([k,t])=>`<button class="dc-card" data-doc="${k}"><b>${t}</b><span>${DOC_TITLE[k]}</span></button>`).join('')}</div>`,
  account:()=>dP('You sign in with your Roblox account: type your username, put the phrase we show you in your Roblox About section, and press Verify. We never ask for your password.','One account per player. To keep it that way the site stores one-way hashes of your network, a device id and device traits each time you sign in. A second account on the same network, device or hardware is rate limited or banned automatically; you can appeal through Support if you share a home network.','Before you play you sign the TradeBlacket agreements once, with your name and a drawn signature. When a document changes you are asked to sign the new version.'),
  access:()=>dP('TradeBlacket is invite-only for now. After signing in you join the waitlist and keep your place (#1 is first in). Staff let people in in waitlist order, or you can enter an access code from the team or a creator.','Slots have their own waitlist: join it on the Slots page or enter a slots access code.','While you wait you can still use Support, see your Trade Empire account at <button class="lnk" data-go="tradeempire">tradeblacket.com/tradeempire</button> and read these docs.'),
  wallet:()=>dP('Open the Wallet and choose Deposit or Withdraw. Transfers go through Roblox Open Cloud straight to your Trade Empire save, so you need to be <b>out of the game</b> while one runs. It takes a few seconds.','Before your first deposit you sign the Currency Deduction Service, which says exactly what we may and may not change in your save.','You can withdraw up to what you deposited, plus Rodux you were paid for items you sold, minus what you already withdrew. Your wallet ID (TBW-…) is in Settings; Support uses it to find your account. Bonus Rodux plays on the site but cannot be withdrawn. Withdrawals always stay open, even during a break.')+`<button class="cta ghost inline" data-legal="cds">Read the Currency Deduction Service</button>`,
  limiteds:()=>dP('Deposit limiteds from your save to use them on the site: flip them against other players, list them on the marketplace or sell them to TradeBlacket for 90% of their value. Anything you win or buy lands in your Limiteds, ready to withdraw.','<b>Limited Flip</b>: put items up against another player within 10% of the same value; the winner takes every item. Each flip commits to a seed before anyone joins and reveals it afterwards. To check one, compute sha256(seed:joinerId:flipId) and look at the first byte: even is Crown, odd is Tower.','Items in Trade Empire\'s holding period, on the in-game market or in an open trade stay in the game until they are free. The site never creates or destroys items: every limited on TradeBlacket came from a Trade Empire save.'),
  tradeplus:()=>dP('If your Trade Empire account has an active TradePlus subscription (any tier), you can theme your TradeBlacket profile: banner, accent colours, a profile effect and a name style.','We read your subscription from your Trade Empire save. Changes can take up to 10 minutes to show.'),
  bonus:()=>dP('<b>Bonus Rodux</b> comes from daily rewards, missions, codes, level-ups, referrals and most gift cards. It plays like normal Rodux but cannot be withdrawn to Trade Empire.','<b>Refer a friend</b>: share your link. When your friend is let in and signs the agreements you get 450 bonus Rodux. Friends on your network or device do not count.','<b>Gift cards</b> (TBG-…) are given away by the Trade Empire team and creators. They are worth USD $5, $10, $100 or $500 in Rodux at the moment you redeem them, worked out from what Rodux costs in Trade Empire. They cannot be bought.'),
  fair:()=>dP('Every number a game uses comes from your own <b>seed pair</b>. The server picks a secret <b>server seed</b> and shows you only its SHA-256 hash, so it cannot change it later. You control the <b>client seed</b>. A counter, the <b>nonce</b>, goes up by one for every 64 numbers.','Each number is made like this:')+`<pre class="dc-code">digest = HMAC_SHA256(key: serverSeed, message: clientSeed + ":" + nonce + ":" + cursor)   // cursor 0 to 7
number = byte0/256 + byte1/256² + byte2/256³ + byte3/256⁴                                  // 8 numbers per digest</pre>`+dP('Games take numbers in order. When you rotate, the server seed is revealed: hash it and you get the hash you were shown before, and every number can be recomputed. The hash of the <b>next</b> server seed is shown too, before it is used.','<b>Client seed automation</b>: by default your seeds rotate after 1,000 nonces and a fresh random client seed is picked each time. You can rotate daily instead, keep your own client seed, or switch automation off.')+`<div id="fairpanel"></div>`,
  verify:()=>dP('Paste a revealed server seed, the client seed and a nonce. Your browser recomputes the numbers itself (nothing is sent to us) and shows what they mean in each game.')+`<div id="fairverify"></div>`,
  games:()=>dP('Each game shows its return to player (RTP): the share of Rodux paid back over many rounds. Results never depend on your bet size or history.')+`<ul class="rtp-list">${RTP.map(([a,b])=>`<li><span>${a}</span><b>${b}</b></li>`).join('')}</ul><h3>How numbers become results</h3><div class="dc-tbl">${FAIR_GAMES.map(([g,how])=>`<div><b>${g}</b><span>${how}</span></div>`).join('')}</div>`+dP('Crash and Roulette rounds run for everyone in the room, so each round takes a number even when you do not bet. Animations and the made-up players in live feeds use separate randomness and never touch your stream.'),
  play:()=>dP('Under <button class="lnk" data-go="settings">Responsible play</button> you can set screen-time, deposit, bet and loss limits, take a break or exclude yourself. Stricter limits start straight away; looser ones wait 24 hours. Breaks and exclusions cannot be ended early.','If playing stops being fun, stop. Help: AGOG and Loket Kansspel in the Netherlands, GamCare in the UK, 1-800-GAMBLER in the US, Gambling Therapy anywhere.')+`<button class="cta ghost inline" data-legal="play">Responsible Play Policy</button>`,
  standing:()=>dP('Your account standing works like Trade Empire\'s: warnings count for 90 days. One active warning puts you on <b>warning</b>, two on <b>restricted</b>. Staff can also suspend an account for a set time, ban it or terminate it.','You always see the reason. If an account is banned or terminated you can still bring your Rodux and limiteds back to Trade Empire, and you can appeal through Support. See yours at <button class="lnk" data-go="tradeempire">Trade Empire account</button>.'),
  support:()=>dP('Open a ticket from <button class="lnk" data-go="support">Support</button>: pick a topic, describe what happened and attach screenshots (up to 5 MB each). Your account details go into the ticket for staff, so you do not need to explain your balance or items.','Staff will never ask for your password, Robux or a trade. Report anyone who does.'),
  staff:()=>dP('TradeBlacket staff have ranks. Each rank can do a little more than the one below, and nobody can act on an account at or above their own rank. Every staff action is written to an audit log.')+`<div class="dc-tbl">${[['Trial Moderator','reads tickets, looks up players, warns and adds notes'],['Moderator','also kicks and suspends, reviews Business members and requests'],['Senior Moderator','also bans, runs the waitlists and gives site access'],['Admin','also answers and assigns tickets, lifts bans, makes gift cards, decides Partner applications, reads the audit log'],['Head Admin','also terminates accounts, pays Business Cards, sets wages, changes site settings, sees signed agreements'],['HR','everything, including hiring, promotions and what each rank may do'],['Owner','everything; set on the server'],['Support Agent','side role: answers tickets'],['Partner Manager','side role: Business members, partners, payouts and wages'],['Finance','side role: gift cards, payouts and wages'],['Developer','side role: site settings and waitlists'],['Trust & Safety','side role: warnings, suspensions, bans and signed agreements']].map(([r,d])=>`<div><b>${r}</b><span>${d}</span></div>`).join('')}</div>`,
  business:()=>dP('<button class="lnk" data-biz>TradeBlacket Business</button> is for creators who make Trade Empire content. Members get a Business role, direct support and the feature board. Members accepted into the Trade Empire Partner Program (TEPP) get a Business Card and a <b>Monthly Wage of TradeBlacket</b>, set by an official moderator.','The wage is payment for your videos and everything else you make for TradeBlacket, so partners promise not to give away the whole wage. Card money and wages are virtual value: never cash and never Robux.')+`<button class="cta ghost inline" data-legal="business">Business and Partner Program Agreement</button>`,
  legal:()=>dP('You sign TradeBlacket\'s agreements electronically: you read each document, type your name and draw your signature with a mouse, trackpad, pen or finger. We keep the version and a SHA-256 fingerprint of the exact text you signed, with your signature, the time and hashed network and device identifiers. You can see and download every signed copy in Settings.')+`<div class="dc-cards">${LEGAL_DOCS.order.map(k=>`<button class="dc-card" data-go="legal" data-p="${k}"><b>${esc(LEGAL_DOCS[k].t)}</b><span>${esc(LEGAL_DOCS[k].s)}</span></button>`).join('')}</div>`,
};
PAGES.docs=(el,slug)=>{
  slug=({start:'welcome',items:'limiteds',help:'support',plus:'tradeplus'})[slug]||slug;const k=DOC_BODY[slug]?slug:'welcome';
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Docs</div><h2>Docs</h2><p>How TradeBlacket works, how to check your results, and the rules.</p></div></div>
    <div class="dc"><nav class="dc-nav" aria-label="Docs"><label class="dc-search">${ic('search',16)}<input id="dcq" placeholder="Search the docs" aria-label="Search the docs"></label><div id="dcnav">${DOCS_TREE.map(([g,a])=>`<h6>${g}</h6>${a.map(([s,t])=>`<button data-doc="${s}" class="${s===k?'on':''}">${t}</button>`).join('')}`).join('')}</div></nav>
      <article class="card dc-art"><h1>${DOC_TITLE[k]}</h1>${DOC_BODY[k]()}</article></div>`;
  try{const want='/docs'+(k==='welcome'?'':'/'+k);if(location.pathname!==want)history.replaceState(null,'',want)}catch{}
  $('#dcq',el).oninput=e=>{const v=e.target.value.trim().toLowerCase();$('#dcnav',el).innerHTML=v?DOCS_TREE.flatMap(([,a])=>a).filter(([s,t])=>(t+' '+DOC_BODY[s]().replace(/<[^>]+>/g,' ')).toLowerCase().includes(v)).map(([s,t])=>`<button data-doc="${s}">${t}</button>`).join('')||'<p class="note">Nothing found.</p>':DOCS_TREE.map(([g,a])=>`<h6>${g}</h6>${a.map(([s,t])=>`<button data-doc="${s}" class="${s===k?'on':''}">${t}</button>`).join('')}`).join('')};
  if(k==='fair')fairPanel($('#fairpanel',el));
  if(k==='verify')fairVerifier($('#fairverify',el));
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-doc]');if(b){e.preventDefault();go('docs',b.dataset.doc)}});
// The old "How results are made" box now opens the fairness docs.
openFair=()=>go('docs','fair');

/* ---------- your seeds ---------- */
async function fairPanel(box){
  if(!box)return;await WAPI.ready;if(!box.isConnected)return;
  if(!WAPI.live||!WAPI.me){box.innerHTML=`<div class="fp card glass"><p class="note">${WAPI.live?'Sign in to see and change your seeds.':'Preview: seeds run on the live site. You can still try the verifier.'}</p>${WAPI.live?'<button class="cta inline" data-open="login">Sign in</button>':''}</div>`;return}
  box.innerHTML='<div class="fp card glass"><div class="spin"></div></div>';
  const s=await fairState();if(!box.isConnected)return;if(!s){box.innerHTML='<p class="note">Could not load your seeds. Try again.</p>';return}
  const used=FAIR.log.filter(l=>l.h===s.serverSeedHash);
  box.innerHTML=`<div class="fp card glass">
    <div class="fp-h"><h3>Your seeds</h3><span class="ac-pill is-ok">Live</span></div>
    <dl class="fp-kv"><div><dt>Server seed (hashed)</dt><dd><code>${esc(s.serverSeedHash)}</code><button class="lnk" data-copy="${esc(s.serverSeedHash)}">Copy</button></dd></div>
      <div><dt>Next server seed (hashed)</dt><dd><code>${esc(s.nextServerSeedHash)}</code></dd></div>
      <div><dt>Nonce</dt><dd><b>${fmt0(s.nonce)}</b> <small>${fmt0(s.nonce*s.perNonce)} numbers made with this pair since ${new Date(s.since).toLocaleString()}</small></dd></div></dl>
    <div class="fp-row"><label class="fld"><span>Client seed</span><input class="txt" id="fpc" maxlength="64" value="${esc(s.clientSeed)}" spellcheck="false"></label><button class="cta ghost inline" id="fprand">Random</button><button class="cta inline" id="fpsave">Use this seed</button></div>
    <p class="note">Changing the client seed starts a new pair and reveals the current server seed.</p>
    <h4>Automation</h4>
    <div class="fp-auto">${[['nonces','Rotate after'],['daily','Rotate every day'],['off','Off']].map(([v,l])=>`<label class="fp-opt"><input type="radio" name="fpm" value="${v}" ${s.auto.mode===v?'checked':''}><span>${l}${v==='nonces'?` <input class="txt fp-n" id="fpn" type="number" min="10" max="1000000" value="${s.auto.every}"> nonces`:''}</span></label>`).join('')}</div>
    <label class="check"><input type="checkbox" id="fpac" ${s.auto.autoClient?'checked':''}> Pick a new random client seed at every rotation</label>
    <div class="fp-row"><button class="cta ghost inline" id="fpauto">Save automation</button><button class="cta inline" id="fprot">Rotate now</button></div>
    <div id="fpres"></div>
    <h4>Rounds this browser used with this pair</h4>
    ${used.length?`<div class="fp-log">${used.slice(-12).reverse().map(l=>`<div><b>#${l.n}</b><span>${esc(DOC_TITLE[l.g]||l.g||'site')}</span><span>${l.used} number${l.used===1?'':'s'}</span><code>${l.first.toFixed(8)}</code></div>`).join('')}</div>`:'<p class="note">None yet. Play a game and come back.</p>'}
    <h4>Revealed seeds</h4>
    ${s.history.length?`<div class="fp-hist">${s.history.map((h,i)=>`<div><span><b>${new Date(h.revealedAt).toLocaleString()}</b><small>${fmt0(h.nonces)} nonces · ${esc(h.reason||'')} · client seed <code>${esc(h.clientSeed)}</code></small><code class="fp-seed">${esc(h.serverSeed)}</code></span><button class="cta ghost inline" data-fpchk="${i}">Check</button></div>`).join('')}</div>`:'<p class="note">Nothing revealed yet. Rotate to reveal your current server seed.</p>'}
  </div>`;
  const R=box;
  $('#fprand',R).onclick=()=>{const a=new Uint8Array(12);crypto.getRandomValues(a);$('#fpc',R).value=btoa(String.fromCharCode(...a)).replace(/[+/=]/g,'').slice(0,16)};
  $('#fpsave',R).onclick=async()=>{const r=await api('/api/fair/client-seed',{clientSeed:$('#fpc',R).value});if(!r.ok)return toast(r.j.error,'loss');FAIR.q=[];FAIR.state=r.j;toast('New client seed in use. The old server seed is revealed below.','win');await fairShowCheck(r.j.revealed);fairPanel(box)};
  $('#fpauto',R).onclick=async()=>{const r=await api('/api/fair/settings',{mode:($('[name=fpm]:checked',R)||{}).value,every:$('#fpn',R).value,autoClient:$('#fpac',R).checked});if(!r.ok)return toast(r.j.error,'loss');FAIR.state=r.j;toast('Automation saved.','win');fairPanel(box)};
  $('#fprot',R).onclick=async()=>{const r=await api('/api/fair/rotate',{});if(!r.ok)return toast(r.j.error,'loss');FAIR.q=[];FAIR.state=r.j;await fairShowCheck(r.j.revealed);fairPanel(box)};
  $$('[data-fpchk]',R).forEach(b=>b.onclick=()=>fairShowCheck(s.history[+b.dataset.fpchk],b));
  $$('[data-copy]',R).forEach(b=>b.onclick=()=>navigator.clipboard.writeText(b.dataset.copy).then(()=>toast('Copied.'),()=>{}));
}
async function fairShowCheck(rev,btn){
  if(!rev)return;const c=await fairCheck(rev);
  const msg=!c.hashOk?'The revealed seed does not match its hash.':c.checked?(c.matched===c.checked?`Hash matches. All ${fmt0(c.checked)} rounds (${fmt0(c.numbers)} numbers) this browser used check out.`:`${c.checked-c.matched} of ${c.checked} rounds do not match.`):'Hash matches. This browser has no rounds from that pair to compare.';
  toast(msg,c.hashOk&&c.matched===c.checked?'win':'loss');
  const box=$('#fpres');if(box)box.innerHTML=`<div class="fp-res ${c.hashOk&&c.matched===c.checked?'ok':'bad'}">${ic(c.hashOk&&c.matched===c.checked?'check':'x',16,2.4)}<span>${msg}</span><button class="lnk" data-doc="verify">Open the verifier</button></div>`;
  if(btn)btn.textContent=c.hashOk&&c.matched===c.checked?'Checked ✓':'Mismatch';
  try{sessionStorage.setItem('tb_fv',JSON.stringify({s:rev.serverSeed,c:rev.clientSeed,n:0}))}catch{}
}
function fairVerifier(box){
  if(!box)return;let pre={};try{pre=JSON.parse(sessionStorage.getItem('tb_fv')||'{}')}catch{}
  box.innerHTML=`<div class="fp card glass"><label class="fld"><span>Server seed (revealed)</span><input class="txt" id="fvs" spellcheck="false" placeholder="64 hex characters" value="${esc(pre.s||'')}"></label>
    <div class="fp-row"><label class="fld"><span>Client seed</span><input class="txt" id="fvc" spellcheck="false" value="${esc(pre.c||'')}"></label><label class="fld fp-nn"><span>Nonce</span><input class="txt" id="fvn" type="number" min="0" value="${pre.n||0}"></label><button class="cta inline" id="fvgo">Verify</button></div><div id="fvout"></div></div>`;
  const run=async()=>{const s=$('#fvs',box).value.trim(),c=$('#fvc',box).value.trim(),n=Math.max(0,Math.floor(+$('#fvn',box).value||0)),out=$('#fvout',box);
    if(!/^[0-9a-f]{64}$/.test(s)){out.innerHTML='<p class="err">A server seed is 64 hex characters.</p>';return}if(!c){out.innerHTML='<p class="err">Enter the client seed.</p>';return}
    const [h,f]=await Promise.all([sha256hex(s),fairFloats(s,c,n,64)]);
    out.innerHTML=`<dl class="fp-kv"><div><dt>SHA-256 of the server seed</dt><dd><code>${h}</code><small>Compare it with the hash you were shown before.</small></dd></div></dl>
      <h4>First numbers of nonce ${n}</h4><div class="fp-nums">${f.slice(0,16).map((x,i)=>`<span><small>${i}</small>${x.toFixed(10)}</span>`).join('')}</div>
      <h4>The first number in each game</h4><div class="dc-tbl">${FAIR_GAMES.map(([g,,fn])=>`<div><b>${g}</b><span>${esc(String(fn(f[0])))}</span></div>`).join('')}</div>`};
  $('#fvgo',box).onclick=run;if(pre.s)run();
}

/* ---------- routes: /docs, /docs/<page>, /terms, /privacy, /cookies, /fair ---------- */
const DOC_PATHS={'/terms':['legal','tos'],'/privacy':['legal','privacy'],'/cookies':['legal','cookies'],'/fair':['docs','fair'],'/legal':['legal','tos']};
{const base=go;go=function(v,p){window.TB_PUBLIC=v==='docs'||v==='legal';return base(v,p)}}
{const base=go;go=function(v,p){base(v,p);if(cur!=='docs'&&location.pathname.startsWith('/docs'))try{history.replaceState(null,'','/')}catch{}}}
SW_FREE.push('docs','legal');
{const base=swNeedSignIn;swNeedSignIn=function(){return !window.TB_PUBLIC&&base()}}
(function(){const path=location.pathname.toLowerCase().replace(/\/+$/,'');let hit=null;
  if(path==='/docs'||path.startsWith('/docs/'))hit=['docs',path.slice(6)||'welcome'];else if(DOC_PATHS[path])hit=DOC_PATHS[path];
  if(hit){window.TB_PUBLIC=true;const g=$('#gate');if(g&&!S.user)g.innerHTML='';go(hit[0],hit[1])}})();
// Docs in the menu
{const acc=[...$$('#nav h6')].find(h=>h.textContent==='Account');if(acc&&!$('#nav [data-go="docs"]'))acc.insertAdjacentHTML('beforebegin',`<button data-go="docs" title="Docs">${ic('book',19)}<span>Docs</span></button>`)}

/* ---------- Settings: signed agreements and fairness ---------- */
{const base=PAGES.prefs;PAGES.prefs=(el,...a)=>{base(el,...a);sigSection(el);const st=$('.st2',el);if(st&&S.user)st.insertAdjacentHTML('beforeend',`<section class="card glass st2-sec"><h3>Provably fair seeds</h3><p class="note">See your server seed hash, change your client seed, set automatic rotation and verify past results.</p><button class="cta ghost inline" data-doc="fair">Open your seeds</button></section>`)}}
// tickets can be opened straight from the staff panel
{const base=PAGES.support;PAGES.support=(el,p)=>{if(typeof p==='string'&&/^TKT-/.test(p))SUP.sel=p;return base(el,p)}}
