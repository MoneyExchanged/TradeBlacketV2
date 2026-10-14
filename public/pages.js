'use strict';
/* =========================================================
   Sign-up · Home · Profile · Rewards · boot
   ========================================================= */
const GART={
  crash:'<svg width="104" height="104" viewBox="0 0 120 120"><path d="M8 108C40 100 66 78 84 40" stroke="#FFD27A" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/><g transform="rotate(35 82 40)"><path d="M82 8c12 8 18 22 18 36l-8 12H72l-8-12c0-14 6-28 18-36z" fill="#fff"/><circle cx="82" cy="32" r="7" fill="#3D8BFD" stroke="#0B1E4A" stroke-width="3"/><path d="M64 44l-8 16 12-4zM100 44l8 16-12-4z" fill="#F04D5E"/><path d="M74 56h16l-8 18z" fill="#F2B33D"/></g></svg>',
  roulette:'<svg width="106" height="106" viewBox="0 0 120 120"><circle cx="60" cy="62" r="50" fill="#0B131C"/><circle cx="60" cy="62" r="38" fill="none" stroke="#D63A4F" stroke-width="18" stroke-dasharray="19.9 19.9"/><circle cx="60" cy="62" r="38" fill="none" stroke="#26364A" stroke-width="18" stroke-dasharray="19.9 19.9" stroke-dashoffset="19.9"/><path d="M60 24a38 38 0 0 1 19 5" stroke="#1FAE60" stroke-width="18" fill="none"/><circle cx="60" cy="62" r="20" fill="#F2B33D"/><circle cx="60" cy="62" r="7" fill="#6B4304"/><path d="M60 6l7 12H53z" fill="#fff"/></svg>',
  blackjack:'<svg width="112" height="108" viewBox="0 0 122 118"><g transform="rotate(-14 40 70)"><rect x="12" y="20" width="56" height="80" rx="8" fill="#fff"/><text x="22" y="44" font-family="Rubik,Arial" font-weight="700" font-size="20" fill="#141A24">A</text><text x="30" y="80" font-family="Arial" font-size="30" fill="#141A24">♠</text></g><g transform="rotate(12 80 66)"><rect x="54" y="18" width="56" height="80" rx="8" fill="#fff"/><text x="62" y="42" font-family="Rubik,Arial" font-weight="700" font-size="20" fill="#C9283C">K</text><text x="70" y="78" font-family="Arial" font-size="30" fill="#C9283C">♥</text></g></svg>',
  baccarat:'<svg width="112" height="100" viewBox="0 0 122 110"><rect x="8" y="20" width="50" height="72" rx="7" fill="#fff"/><text x="18" y="44" font-family="Rubik,Arial" font-weight="700" font-size="18" fill="#141A24">9</text><text x="24" y="76" font-family="Arial" font-size="26" fill="#141A24">♣</text><rect x="64" y="20" width="50" height="72" rx="7" fill="#fff"/><text x="74" y="44" font-family="Rubik,Arial" font-weight="700" font-size="18" fill="#C9283C">8</text><text x="80" y="76" font-family="Arial" font-size="26" fill="#C9283C">♦</text><rect x="20" y="96" width="82" height="10" rx="5" fill="#F2B33D"/></svg>',
  mines:'<svg width="104" height="104" viewBox="0 0 116 116"><circle cx="50" cy="66" r="34" fill="#0B131C"/><circle cx="40" cy="54" r="9" fill="#ffffff33"/><path d="M72 40l12-12" stroke="#0B131C" stroke-width="9" stroke-linecap="round"/><path d="M88 22l8-4M88 22l4 8M88 22l-2-9" stroke="#FFD27A" stroke-width="4" stroke-linecap="round"/><path d="M84 70l14-16 14 16-14 22z" fill="#5FF2C0" stroke="#0B5C4A" stroke-width="3"/></svg>',
  towers:'<svg width="98" height="104" viewBox="0 0 112 120"><rect x="14" y="80" width="84" height="30" rx="6" fill="#fff"/><rect x="26" y="46" width="60" height="30" rx="6" fill="#FFE0B8"/><rect x="38" y="12" width="36" height="30" rx="6" fill="#FFD27A"/></svg>',
  plinko:'<svg width="108" height="100" viewBox="0 0 124 116"><g fill="#ffffffcc"><circle cx="62" cy="18" r="5"/><circle cx="46" cy="40" r="5"/><circle cx="78" cy="40" r="5"/><circle cx="30" cy="62" r="5"/><circle cx="62" cy="62" r="5"/><circle cx="94" cy="62" r="5"/><circle cx="14" cy="84" r="5"/><circle cx="46" cy="84" r="5"/><circle cx="78" cy="84" r="5"/><circle cx="110" cy="84" r="5"/></g><circle cx="58" cy="50" r="9" fill="#F2B33D"/><rect x="4" y="98" width="116" height="12" rx="4" fill="#F04D5E"/></svg>',
  dice:'<svg width="100" height="100" viewBox="0 0 120 120"><rect x="16" y="22" width="76" height="76" rx="18" fill="#fff" transform="rotate(-12 54 60)"/><g fill="#24806A"><circle cx="38" cy="46" r="7"/><circle cx="68" cy="40" r="7"/><circle cx="54" cy="62" r="7"/><circle cx="40" cy="82" r="7"/><circle cx="72" cy="76" r="7"/></g></svg>',
  limbo:'<svg width="108" height="100" viewBox="0 0 120 110"><path d="M10 96h100" stroke="#ffffff55" stroke-width="3"/><path d="M14 92C44 88 70 70 96 22" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="96" cy="22" r="8" fill="#F2B33D"/><rect x="18" y="30" width="54" height="26" rx="6" fill="#0006"/><text x="45" y="49" text-anchor="middle" font-family="Rubik,Arial" font-weight="700" font-size="16" fill="#fff">2.00×</text></svg>',
  hilo:'<svg width="104" height="106" viewBox="0 0 116 118"><rect x="30" y="14" width="58" height="84" rx="8" fill="#fff"/><text x="40" y="38" font-family="Rubik,Arial" font-weight="700" font-size="20" fill="#141A24">7</text><text x="50" y="74" font-family="Arial" font-size="30" fill="#141A24">♠</text><path d="M8 52l10-14 10 14z" fill="#1FCB6B"/><path d="M90 66l10 14 10-14z" fill="#F04D5E"/></svg>',
  keno:'<svg width="104" height="104" viewBox="0 0 116 116">'+[0,1,2,3].map(r=>[0,1,2,3].map(c=>`<rect x="${10+c*25}" y="${10+r*25}" width="21" height="21" rx="5" fill="${(r*4+c)%5===1?'#F2B33D':(r*4+c)%3===0?'#1FCB6B':'#ffffff33'}"/>`).join('')).join('')+'</svg>',
  wheel:'<svg width="104" height="104" viewBox="-60 -60 120 120">'+Array.from({length:12},(_,i)=>{const a=i/12*6.283-1.571,b=(i+1)/12*6.283-1.571;return `<path d="M0 0L${(50*Math.cos(a)).toFixed(1)} ${(50*Math.sin(a)).toFixed(1)}A50 50 0 0 1 ${(50*Math.cos(b)).toFixed(1)} ${(50*Math.sin(b)).toFixed(1)}Z" fill="${['#2A3B4C','#1FCB6B','#2A3B4C','#3D8BFD','#2A3B4C','#F2B33D'][i%6]}"/>`}).join('')+'<circle r="18" fill="#0B131C"/><path d="M-7 -60h14l-7 12z" fill="#fff"/></svg>',
  cups:'<svg width="110" height="94" viewBox="0 0 128 110"><path d="M10 100h44l-8-70H18z" fill="#fff"/><path d="M74 100h44l-8-70H82z" fill="#D8E6FF"/><circle cx="64" cy="14" r="10" fill="#F2B33D"/></svg>',
  coinflip:'<svg width="100" height="100" viewBox="0 0 120 120"><ellipse cx="60" cy="64" rx="46" ry="46" fill="#6B4304"/><circle cx="60" cy="58" r="46" fill="#F2B33D"/><circle cx="60" cy="58" r="34" fill="none" stroke="#6B4304" stroke-width="4" stroke-dasharray="8 6"/><path d="M44 66h32l3-20-10 8-9-13-9 13-10-8z" fill="#6B4304"/></svg>'
};
function drawBoard(){
  const el=$('#board');if(!el)return;
  const top=FEED.filter(f=>f.payout>f.bet).sort((a,b)=>b.mult-a.mult).slice(0,7);
  el.innerHTML=top.map((f,i)=>`<li data-user="${esc(f.u.name)}"><span class="rk">${i+1}</span>${avatar(f.u,24)}<div style="min-width:0;display:flex;flex-direction:column"><span class="who">${esc(f.u.name)}</span><span class="gm">${GAMES[f.game].n} · ${fmt(f.payout)}</span></div><span class="x">${f.mult.toFixed(2)}×</span></li>`).join('');
}
for(const k of ORIG)GART[k]=gameArt(k);
const gameCard=gameCardLx;

/* ---------- sign-up gate ---------- */
const WORDS2=['amber','harbor','otter','quiet','copper','lantern','maple','orbit','velvet','cobalt','meadow','tundra','pixel','summit','ember','willow','fable','granite'];
const stepper=n=>`<ol class="gsteps" aria-label="Step ${n} of 3">${['Username','Profile phrase','Verify'].map((t,i)=>`<li class="${i+1<n?'done':i+1===n?'on':''}"><i>${i+1<n?ic('check',11,3):i+1}</i>${t}</li>`).join('')}</ol>`;
function showGate(mode='up'){
  const g=$('#gate');let name='',raf=0;
  const logo=`<div class="logo"><svg class="tbmark" width="44" height="41" viewBox="0 0 128 120" aria-hidden="true"><defs><linearGradient id="tbgg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34E584"/><stop offset="1" stop-color="#0FA552"/></linearGradient><linearGradient id="tbcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14261E"/><stop offset="1" stop-color="#0A1611"/></linearGradient></defs><g stroke="#1FCB6B" stroke-width="3" fill="url(#tbcg)"><g transform="rotate(-16 34 46)"><rect x="17" y="12" width="34" height="48" rx="6"/></g><g transform="rotate(16 94 46)"><rect x="77" y="12" width="34" height="48" rx="6"/></g><rect x="46" y="4" width="36" height="52" rx="6"/></g><g fill="#1FCB6B"><path transform="translate(26 30) rotate(-16) scale(.62)" d="M10 0C10 0 0 9 0 15a5.5 5.5 0 0 0 9 4l-2 7h6l-2-7a5.5 5.5 0 0 0 9-4C20 9 10 0 10 0z"/><path transform="translate(55 22) scale(.9)" d="M10 19S0 12.5 0 6a5.5 5.5 0 0 1 10-3 5.5 5.5 0 0 1 10 3c0 6.5-10 13-10 13z"/><g transform="translate(86 30) rotate(16) scale(.62)"><circle cx="10" cy="5" r="5"/><circle cx="4" cy="14" r="5"/><circle cx="16" cy="14" r="5"/><path d="M8.5 14h3l1.5 10h-6z"/></g><path transform="translate(50 9) scale(.36)" d="M10 0C10 0 0 9 0 15a5.5 5.5 0 0 0 9 4l-2 7h6l-2-7a5.5 5.5 0 0 0 9-4C20 9 10 0 10 0z"/></g><path d="M26 44h58c13 0 22 8 22 19 0 6-3 11-7 14 6 3 10 9 10 16 0 13-10 23-25 23H26c-11 0-18-7-18-18V62c0-11 7-18 18-18z" fill="url(#tbgg)"/><path d="M26 44h58c13 0 22 8 22 19 0 6-3 11-7 14 6 3 10 9 10 16 0 13-10 23-25 23H26c-11 0-18-7-18-18V62c0-11 7-18 18-18z" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1.5"/><path d="M26 59h46M49 59v41" stroke="#fff" stroke-width="13" stroke-linecap="round" fill="none"/><circle cx="80" cy="95" r="8.5" fill="none" stroke="#fff" stroke-width="7"/></svg><b style="font-size:23px">Trade<span>Blacket</span></b></div>`;
  const showcase=['ecrown','rwings','ihalo','dtrophy'].map(id=>{const i=ITEM[id];return`<figure class="gx-item">${itemSvg(id)}<figcaption><b>${esc(i.n)}</b><span>${chip(11)}${fmt0(i.v)}</span></figcaption></figure>`}).join('');
  let code='';
  g.innerHTML=`<div class="gate" role="dialog" aria-modal="true" aria-label="Sign in to TradeBlacket">
    <div class="gate-l"><canvas id="gcv"></canvas>
      <div class="gx-top">${logo}<span class="gx-age">18+</span></div>
      <div class="gx-hero"><h1>Play with your Trade Empire Rodux.</h1>
        <p>Cases, battles, limited flips and casino games. Move Rodux and limiteds from your save in seconds, and take them back whenever you like.</p>
        <ul class="gx-feats">
          <li>${ic('cases',18,2)}<span><b>Every drop table shown</b>Odds on every case, before you open it</span></li>
          <li>${ic('shield',18,2)}<span><b>Provably fair flips</b>Seeds you can check after every result</span></li>
          <li>${ic('tag',18,2)}<span><b>Straight from your save</b>No need to open the game to deposit</span></li>
          <li>${ic('lock',18,2)}<span><b>Limits you control</b>Screen time, deposit caps and breaks</span></li>
        </ul></div>
      <div class="gx-items">${showcase}</div>
    </div>
    <div class="gate-r"><div class="gate-card">
      <div class="gate-mlogo">${logo}</div>
      <div class="lx-seg gseg" id="gseg"><button data-gt="up">Create account</button><button data-gt="in">Sign in</button><i></i></div>
      <div id="gbody"></div>
      ${window.TB_GATE===false?'<p class="guest">Just looking? <button id="guest">Browse without an account</button></p>':'<p class="guest">TradeBlacket is invite-only. Sign in with Roblox to join the waitlist.</p>'}
    </div></div>
  </div>`;
  const close=()=>{cancelAnimationFrame(raf);g.innerHTML=''};
  // Browsing without an account only exists while the site is open to everyone (SITE_WAITLIST=off).
  const gb=$('#guest',g);if(gb)gb.onclick=()=>{if(window.TB_GATE!==false)return;S.guest=true;save();close()};
  $$('[data-gt]',g).forEach(b=>b.onclick=()=>{mode=b.dataset.gt;s1()});
  // left-side chart
  (function anim(){
    const cv=$('#gcv',g);if(!cv||!cv.offsetWidth)return;const ctx=cv.getContext('2d'),d=Math.min(2,devicePixelRatio||1);let W,H;
    const size=()=>{W=cv.offsetWidth;H=cv.offsetHeight;cv.width=W*d;cv.height=H*d;ctx.setTransform(d,0,0,d,0,0)};size();
    const pts=[];let v=.6;for(let i=0;i<80;i++){v+=(rnd()-.48)*.03;v=Math.min(.8,Math.max(.4,v));pts.push(v)}
    let off=0;
    const f=()=>{if(!g.innerHTML)return;raf=requestAnimationFrame(f);if(cv.offsetWidth!==W)size();ctx.clearRect(0,0,W,H);
      ctx.strokeStyle='rgba(255,255,255,.035)';for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,H);ctx.stroke()}for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(W,y+.5);ctx.stroke()}
      const sg=W/70;off+=REDUCED?0:.4;if(off>sg){off-=sg;pts.shift();let n=pts[pts.length-1]+(rnd()-.47)*.03;pts.push(Math.min(.82,Math.max(.38,n)))}
      ctx.beginPath();pts.forEach((p,i)=>{const x=i*sg-off,y=(1-p)*H;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
      ctx.strokeStyle='rgba(231,199,127,.9)';ctx.lineWidth=1.6;ctx.stroke();ctx.lineTo(W+sg,H);ctx.lineTo(0,H);ctx.closePath();const gr=ctx.createLinearGradient(0,H*.2,0,H);gr.addColorStop(0,'rgba(231,199,127,.12)');gr.addColorStop(1,'rgba(231,199,127,0)');ctx.fillStyle=gr;ctx.fill()};
    f();
  })();
  const body=()=>$('#gbody',g);
  function s1(){
    $$('[data-gt]',g).forEach(b=>b.classList.toggle('on',b.dataset.gt===mode));$('#gseg',g).classList.toggle('r',mode==='in');
    body().innerHTML=`${stepper(1)}<h2>${mode==='up'?'Create your account':'Welcome back'}</h2><p class="muted gsub">${mode==='up'?'Sign up with your Roblox username. There is no password: you prove the account is yours with a short phrase in your Roblox profile.':'Sign in with your Roblox username and a fresh profile phrase.'}</p>
    <form id="gf" class="mstack"><label class="fld"><span>Roblox username</span><span class="gin">${ic('profile',17)}<input class="txt" id="un" autocomplete="username" maxlength="20" value="${esc(name)}" placeholder="e.g. TradeKing"></span></label>
    ${mode==='up'?`<details class="gcode"${code?' open':''}><summary>Have an access code?</summary><span class="gin">${ic('lock',16)}<input class="txt" id="gcd" maxlength="16" placeholder="TB-XXXXX-XXXXX" value="${esc(code)}" autocomplete="off" spellcheck="false"></span><small>Codes open slots straight away. You can also add one later.</small></details>`:''}
    ${mode==='up'?`<label class="check"><input type="checkbox" id="age"><span>I am 18 or older</span></label><label class="check"><input type="checkbox" id="rules"><span>I agree to the <button type="button" class="lnk" data-legal="tos">Terms of Service</button> and the <button type="button" class="lnk" data-legal="license">License Agreement</button></span></label>`:''}
    <div class="err" id="er"></div><button class="cta">Continue</button></form>`;
    const un=$('#un',g);un.focus();
    $('#gf',g).onsubmit=e=>{e.preventDefault();const v=un.value.trim(),er=$('#er',g);
      if(!/^[A-Za-z0-9_]{3,20}$/.test(v)){er.textContent='Roblox usernames are 3 to 20 letters, numbers or underscores.';return}
      if(mode==='up'&&!$('#age',g).checked){er.textContent='You need to be 18 or older to sign up.';return}
      if(mode==='up'&&!$('#rules',g).checked){er.textContent='Please agree to the Terms of Service and License Agreement to continue.';return}
      if($('#gcd',g))code=$('#gcd',g).value.trim();
      name=v;s2()};
  }
  let tok=null;
  async function s2(){
    let phrase='TB '+[pick(WORDS2),pick(WORDS2),pick(WORDS2)].join(' ')+' '+ri(10,99);
    if(typeof WAPI!=='undefined'&&WAPI.live){
      // Live: the server picks the phrase and later reads the About text from Roblox itself.
      body().innerHTML=`<div class="center"><div class="spin"></div><h2>Finding ${esc(name)}</h2></div>`;
      try{const r=await fetch('/api/auth/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:name})});const j=await r.json();
        if(!r.ok){s1();$('#er',g).textContent=j.error||'Something went wrong.';return}
        phrase=j.phrase;tok=j.token;name=j.username}
      catch{s1();$('#er',g).textContent='Could not reach TradeBlacket. Try again.';return}
    }
    body().innerHTML=`${stepper(2)}<h2>Add this to your bio</h2><p class="muted" style="margin:0 0 16px">This proves you own <b style="color:var(--fg)">${esc(name)}</b>.</p>
    <div class="phrase"><code id="ph">${esc(phrase)}</code><button type="button" id="cp">Copy</button></div>
    <ol class="how"><li>Open your Roblox profile and choose Edit next to About.</li><li>Paste the phrase anywhere in the About text and save.</li><li>Come back and press Verify. You can remove the phrase afterwards.</li></ol>
    <div class="mstack"><button class="cta" id="vf">Verify</button><button class="cta ghost" id="bk">Back</button></div>
    ${tok?'':`<p class="fine">Prototype: this check is simulated. The live site reads the profile's About text from Roblox on the server and matches the phrase exactly.</p>`}`;
    $('#cp',g).onclick=()=>{navigator.clipboard.writeText(phrase).then(()=>{$('#cp',g).textContent='Copied'},()=>{const r=document.createRange();r.selectNodeContents($('#ph',g));const s=getSelection();s.removeAllRanges();s.addRange(r);$('#cp',g).textContent='Selected'})};
    $('#bk',g).onclick=s1;$('#vf',g).onclick=s3;
  }
  async function s3(){
    body().innerHTML=`${stepper(3)}<div class="center"><div class="spin"></div><h2>Checking ${esc(name)}</h2><p class="muted">Looking for your phrase in the About section…</p></div>`;
    if(tok){
      let j={};try{const r=await fetch('/api/auth/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mode==='up'?{token:tok,acceptTos:LEGAL_V.tos,ref:TBDEV.ref()}:{token:tok,ref:TBDEV.ref()})});j=await r.json();if(!r.ok)throw 0}
      catch{if(!g.innerHTML)return;const msg=j.error||'Could not reach TradeBlacket. Try again.';if(/expired/i.test(msg)){s1();$('#er',g).textContent=msg;return}
        body().innerHTML=`<div class="center"><h2>Not yet</h2><p class="muted" style="margin:0 0 20px">${esc(msg)}</p><div class="mstack"><button class="cta" id="again">Verify again</button><button class="cta ghost" id="bk2">Back</button></div></div>`;
        $('#again',g).onclick=s3;$('#bk2',g).onclick=s1;return}
      if(j.isNew)TBDEV.clearRef();syncMe();
    }else await sleep(1600);
    if(!g.innerHTML)return;
    const fresh=mode==='up';
    S.user={name};S.guest=false;if(fresh){S.stats.joined=Date.now();bonus(500);S.legal={...(S.legal||{}),tos:LEGAL_V.tos}}save();drawWho();
    if(code&&typeof wlRedeem==='function')wlRedeem(code);
    body().innerHTML=`<div class="center"><div class="ok">${ic('check',30,2.4)}</div><h2>${fresh?'Account created':'Signed in'}</h2><p class="muted" style="margin:0 0 20px">${fresh?'You got a 500 Rodux welcome bonus to start with.':`Welcome back, ${esc(name)}.`}</p><button class="cta" id="enter">Enter TradeBlacket</button></div>`;
    $('#enter',g).onclick=()=>{close();go('home');if(fresh){confetti(innerWidth/2,innerHeight/3,110);addChat({sys:1,u:{name:'TradeBlacket'},text:`Welcome ${name}! Say hi in chat.`})}};
  }
  s1();
}

/* ---------- home ---------- */
const HOME={opened:48213+ri(0,900),battles:3912+ri(0,90),slide:0};
PAGES.home=el=>{
  const slides=[
    {bg:'linear-gradient(115deg,#0F3424,#1E5A3E 60%,#2B7A52)',h:'Stocks are open for trading',p:'Buy and sell shares in eight Trade Empire companies. Prices move every second and react to company news.',cta:'Open the market',go:'stocks',art:`<div style="width:280px">${sparkSVG(STK.list[0].c10.slice(-40).map(c=>c.c),'chart','#fff')}</div>`},
    {bg:'linear-gradient(115deg,#0E3A33,#14504A 60%,#1D6B5E)',h:'Blackjack tables now seat five',p:'Sit down next to other players, bet on the same timer and play your hand when the spotlight reaches you.',cta:'Take a seat',go:'blackjack',art:GART.blackjack.replace('width="112" height="108"','width="230" height="220"')},
    {bg:'linear-gradient(115deg,#0F2B52,#1F5FB8 60%,#3D8BFD)',h:'Call it before it happens',p:'Predictions are live: football, crypto and markets other players open. The pool sets the odds.',cta:'See open markets',go:'predictions',art:`<div style="width:280px">${sparkSVG(PX.BTC.h,'chart','#fff')}</div>`},
    {bg:'linear-gradient(115deg,#3E0F1A,#86203A 60%,#B4283F)',h:'Royal Treasury battles',p:'Four players, the same cases, one winner. The pot lands in your balance the second it ends.',cta:'Join a battle',go:'battles',art:`<div style="width:220px">${caseArt(CASE.royal)}</div>`}
  ];
  el.innerHTML=`
  <section class="promo" id="promo">${slides.map((s,i)=>`<div class="slide${i===HOME.slide?' on':''}" style="background:${s.bg}"><div><h2>${s.h}</h2><p>${s.p}</p><button class="cta inline" ${s.wallet?'data-wallet="deposit"':`data-go="${s.go}"`} style="background:#fff;color:#0B131C">${s.cta}</button></div><div class="art-r" aria-hidden="true">${s.art}</div></div>`).join('')}<div class="dots">${slides.map((_,i)=>`<button data-sl="${i}" class="${i===HOME.slide?'on':''}" aria-label="Slide ${i+1}"></button>`).join('')}</div></section>
  <div class="quick">
    <button data-go="case" data-p="daily">${ic('cases',20)}<span>Daily case<small>Free every 24 hours</small></span></button>
    <button data-go="stocks">${ic('stocks',20)}<span>Stocks<small>8 companies, live prices</small></span></button>
    <button data-go="market">${ic('market',20)}<span>Marketplace<small>${MK.list.length} items listed</small></span></button>
    <button data-go="upgrader">${ic('upgrader',20)}<span>Upgrader<small>Turn items into better ones</small></span></button>
  </div>
  <div class="sec-h"><h3 class="sec">${ic('dice',18)}Game modes</h3></div>
  <div class="modes">${GMODES.map(modeCard).join('')}</div>
  <div class="sec-h"><h3 class="sec">${ic('dice',18)}Originals</h3><span class="note">${ORIG.length} games</span></div>
  <div class="games all">${ORIG.map(gameCard).join('')}</div>
  <div class="sec-h"><h3 class="sec">${ic('slots',18)}Slots</h3><button class="more" data-go="slots">All slots</button></div>
  <div class="slot-lobby">${Object.entries(MACHINES).map(([k,M])=>`<button class="slot-card" data-go="slot" data-p="${k}" style="background:${M.bg}"><span class="sym">${['H4','W','S'].map(s=>machineSym(k,s)).join('')}</span><b>${M.n}</b><span>${M.d}</span></button>`).join('')}</div>
  <div class="sec-h"><h3 class="sec">${ic('cases',18)}Popular cases</h3><button class="more" data-go="cases">View all</button></div>
  <div class="crow">${SHOP.slice(0,6).map(caseCard).join('')}</div>
  <div class="sec-h"><h3 class="sec">${ic('predictions',18)}Open predictions</h3><button class="more" data-go="predictions">All markets</button></div>
  <div class="pm-grid" id="hp"></div>
  <div class="sec-h"><h3 class="sec">${ic('battles',18)}Live battles</h3><button class="more" data-go="battles">All battles</button></div>
  <div class="blist" id="hb"></div>
  <div class="lower">
    <section class="card"><div class="feed-h"><h3 class="sec">Live bets</h3><div class="tabs" id="ftabs"><button data-t="all" class="${feedTab==='all'?'on':''}">All</button><button data-t="big" class="${feedTab==='big'?'on':''}">Big wins</button><button data-t="me" class="${feedTab==='me'?'on':''}">Mine</button></div></div><div id="feed"></div></section>
    <section class="card lb"><h3 class="sec">Top multipliers today</h3><ol id="board"></ol></section>
  </div>
  <footer class="foot"><div><b style="color:var(--fg);font-size:15px">Trade<span style="color:var(--accent)">Blacket</span></b><p>The case and casino site for Trade Empire players. Only for players aged 18 and over.</p></div><nav><button data-go="news">News</button><button data-open="rules">House rules</button><button data-open="fair">Fairness</button><button data-go="docs">Docs</button><button data-go="support">Support</button><button data-go="settings">Responsible play</button><button data-legal="tos">Terms of Service</button><button data-legal="license">License Agreement</button><button data-legal="cds">Currency Deduction Service</button></nav></footer>`;
  const setSlide=i=>{HOME.slide=i;$$('.slide',el).forEach((s,k)=>s.classList.toggle('on',k===i));$$('.dots button',el).forEach((s,k)=>s.classList.toggle('on',k===i))};
  $$('.dots button',el).forEach(b=>b.onclick=()=>setSlide(+b.dataset.sl));
  $$('#ftabs button').forEach(b=>b.onclick=()=>{feedTab=b.dataset.t;$$('#ftabs button').forEach(x=>x.classList.toggle('on',x===b));drawFeed()});
  const drawHP=()=>{const h=$('#hp');if(h)h.innerHTML=PR.list.filter(m=>m.status==='open').sort((a,b)=>a.closes-b.closes).slice(0,3).map(pmCard).join('')};
  el.addEventListener('click',e=>{const p=e.target.closest('[data-pick]');if(p){const[m,i]=p.dataset.pick.split(':');openPick(m,+i)}});
  drawFeed();drawBoard();refreshLobby();drawHP();
  PR.redraw=drawHP;PR.tick=()=>{$$('[data-cl]').forEach(e=>{const m=PR.list.find(x=>x.id===e.dataset.cl);if(m&&m.status==='open')e.innerHTML=ic('trend',13,2)+left(m.closes-Date.now())})};
  const t=setInterval(()=>setSlide((HOME.slide+1)%slides.length),6500);
  cleanup=()=>{clearInterval(t);PR.redraw=null;PR.tick=null};
};

/* ---------- profile ---------- */
const FRAMES=[{k:'none',l:'None',lv:0},{k:'gold',l:'Gold',lv:3},{k:'neon',l:'Neon',lv:6},{k:'prism',l:'Prism',lv:10}];
const BANNERS=[{k:'aurora',l:'Aurora',lv:0},{k:'ocean',l:'Ocean',lv:0},{k:'sunset',l:'Sunset',lv:2},{k:'ember',l:'Ember',lv:4},{k:'matrix',l:'Grid',lv:8},{k:'royal',l:'Royal',lv:12}];
const BADGES=[
  ['First Win','Win any bet',()=>S.stats.wins>=1,'trend'],
  ['Unboxer','Open 10 cases',()=>S.stats.cases>=10,'cases'],
  ['Battle Champ','Win a case battle',()=>S.stats.battles>=1,'battles'],
  ['Alchemist','Win an upgrade',()=>S.stats.upgrades>=1,'upgrader'],
  ['Lucky Strike','Hit a 10× multiplier',()=>S.stats.bestMult>=10,'bolt'],
  ['Collector','Own 25 items at once',()=>S.inv.length>=25,'inventory'],
  ['Limited Hunter','Unbox a Limited',()=>S.stats.gotLimited,'star'],
  ['High Roller','Wager 10,000 Rodux',()=>S.stats.wagered>=1e4,'gem'],
  ['Veteran','Reach level 10',()=>lvl()>=10,'shield']
];
PAGES.profile=el=>{
  if(!S.user){el.innerHTML=`<div class="empty"><h3>Sign in to build your profile</h3><p>Pick an avatar, frame and banner, write a bio, and show off your best drops.</p><button class="cta inline" data-open="login">Sign in</button></div>`;return}
  let editing=false;
  function render(){
    const P=S.profile,L=lvl(),w=S.stats.wagered,lo=xpAt(L),hi=xpAt(L+1),pct=Math.max(2,(w-lo)/(hi-lo)*100),st=S.stats;
    const sc=P.showcase.map(u=>S.inv.find(x=>x.u===u)).filter(Boolean);
    const owned=[...new Set(S.inv.map(x=>x.id))].sort((a,b)=>ITEM[b].v-ITEM[a].v).slice(0,16);
    const joined=new Date(st.joined||Date.now()).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
    el.innerHTML=`
    <section class="prof">
      <div class="banner bn-${P.banner}"></div>
      <div class="prof-b"><span id="pavt">${avatar(me(),100)}</span><div class="grow"><h2>${esc(S.user.name)} <span class="lv${L>=30?' g':''}">Level ${L}</span><span class="verified">${ic('check',12,3)} Bio verified</span></h2><p id="pbio-out">${P.bio?esc(P.bio):'<span style="color:var(--dim)">No bio yet.</span>'}</p><p class="note" style="margin-top:4px">Joined ${joined}</p></div><button class="cta ${editing?'':'ghost '}inline" id="ed">${ic(editing?'check':'edit',16,2)} ${editing?'Done':'Edit profile'}</button></div>
      <div class="xp"><div class="xp-h"><span>Level ${L}</span><span class="num">${fmt0(w)} / ${fmt0(hi)} wagered for level ${L+1}</span></div><div class="xp-bar"><i style="width:${pct}%"></i></div></div>
    </section>
    ${editing?`<section class="card editor">
      <div class="fld"><span>Bio</span><textarea class="txt" id="pbio" maxlength="160" placeholder="What do you collect? What's your go-to game?">${esc(P.bio)}</textarea><span class="note" id="bcnt">${P.bio.length} / 160</span></div>
      <div class="fld"><span>Avatar color</span><input type="range" class="hue" id="phue" min="0" max="359" value="${P.hue}" aria-label="Avatar color"><span style="margin-top:8px">Avatar picture</span><div class="avpick" id="pav"><button type="button" data-av="" class="${!P.avItem?'on':''}" title="Your initial"><b>${esc(S.user.name[0].toUpperCase())}</b></button>${owned.map(id=>`<button type="button" data-av="${id}" class="${P.avItem===id?'on':''}" title="${esc(ITEM[id].n)}">${itemSvg(id)}</button>`).join('')}</div><span class="note">${owned.length?'Any item you own can be your avatar.':'Unbox items to use them as your avatar.'}</span></div>
      <div class="fld"><span>Frame</span><div class="swatches" id="pfr">${FRAMES.map(f=>`<button type="button" class="sw${P.frame===f.k?' on':''}" data-fr="${f.k}" data-lv="${f.lv}" title="${f.l}${L<f.lv?' · unlocks at level '+f.lv:''}" style="display:grid;place-items:center;background:var(--surface-2);--frame-bg:var(--surface-2)">${avatar({...me(),frame:f.k},22)}${L<f.lv?`<span class="lk">${ic('lock',14)}</span>`:''}</button>`).join('')}</div>
        <span style="margin-top:8px">Banner</span><div class="swatches" id="pbn">${BANNERS.map(b=>`<button type="button" class="sw bn-${b.k}${P.banner===b.k?' on':''}" data-bn="${b.k}" data-lv="${b.lv}" title="${b.l}${L<b.lv?' · unlocks at level '+b.lv:''}">${L<b.lv?`<span class="lk">${ic('lock',14)}</span>`:''}</button>`).join('')}</div><span class="note">Level up to unlock more frames and banners.</span></div>
    </section>`:''}
    <div class="pgrid">
      <div class="mstack" style="gap:12px">
        <section class="card"><div class="ph"><h3 class="sec">Showcase</h3><button class="more" data-go="inventory">Star items in your inventory</button></div>${sc.length?`<div class="igrid">${sc.map(x=>itemCard(x.id,{top:x.s?`<span class="ser">#${x.s}/500</span>`:''})).join('')}</div>`:`<p class="note">Star up to 3 items in your inventory to show them here.</p>`}</section>
        <section class="card"><h3 class="sec" style="margin-bottom:12px">Stats</h3><div class="tiles">
          ${[['Wagered',chip(14)+fmt0(st.wagered)],['Bets',fmt0(st.bets)],['Win rate',st.bets?Math.round(st.wins/st.bets*100)+'%':'—'],['Best multiplier',st.bestMult?st.bestMult.toFixed(2)+'×':'—'],['Cases opened',fmt0(st.cases)],['Battles won',fmt0(st.battles)],['Upgrades won',fmt0(st.upgrades)],['Inventory value',chip(14)+fmt0(invVal())]].map(([a,b])=>`<div class="stat"><span>${a}</span><b>${b}</b></div>`).join('')}
        </div>${st.bestDrop?`<div class="kv" style="margin-top:12px"><span>Best drop</span>${mini(st.bestDrop)}</div>`:''}</section>
        <section class="card"><h3 class="sec" style="margin-bottom:10px">Recent bets</h3><div>${(()=>{const r=FEED.filter(f=>f.me).slice(0,8);return r.length?feedHead+r.map(f=>feedRow(f)).join(''):'<p class="note">No bets yet this session.</p>'})()}</div></section>
      </div>
      <section class="card" style="align-self:start"><div class="ph"><h3 class="sec">Badges</h3><span class="note">${BADGES.filter(b=>b[2]()).length} of ${BADGES.length}</span></div><div class="badges">${BADGES.map(([n,d,f,i])=>`<div class="bdg${f()?'':' off'}"><i>${ic(i,18,2)}</i><div><b>${n}</b><span>${d}</span></div></div>`).join('')}</div></section>
    </div>`;
    $('#ed').onclick=()=>{editing=!editing;render()};
    if(!editing)return;
    const sync=()=>{save();drawWho();$('#pavt').innerHTML=avatar(me(),100)};
    $('#pbio').oninput=e=>{P.bio=e.target.value.slice(0,160);$('#bcnt').textContent=P.bio.length+' / 160';$('#pbio-out').textContent=P.bio;save()};
    $('#phue').oninput=e=>{P.hue=+e.target.value;sync();$$('#pfr .avt').forEach(a=>a.style.setProperty('--h',P.hue))};
    $$('#pav button').forEach(b=>b.onclick=()=>{P.avItem=b.dataset.av||null;sync();$$('#pav button').forEach(x=>x.classList.toggle('on',x===b))});
    $$('#pfr button').forEach(b=>b.onclick=()=>{if(L<+b.dataset.lv){toast(`Reach level ${b.dataset.lv} to unlock this frame.`);return}P.frame=b.dataset.fr;sync();$$('#pfr button').forEach(x=>x.classList.toggle('on',x===b))});
    $$('#pbn button').forEach(b=>b.onclick=()=>{if(L<+b.dataset.lv){toast(`Reach level ${b.dataset.lv} to unlock this banner.`);return}P.banner=b.dataset.bn;save();$('.banner',el).className='banner bn-'+P.banner;$$('#pbn button').forEach(x=>x.classList.toggle('on',x===b))});
  }
  render();
};

/* ---------- rewards ---------- */
const PROMO={TRADEBLACKET:250,WELCOME:100,EMPIRE:150};
const MIS=[['bets','Place 15 bets',15,150],['big','Hit a 5× or higher',1,200],['battle','Win a case battle',1,250]];
PAGES.rewards=el=>{
  const L=lvl(),w=S.stats.wagered,hi=xpAt(L+1),lo=xpAt(L),daily=DAILY+L*10;
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Rewards</div><h2>Rewards</h2><p>Bonus Rodux every day, missions that reset at midnight, and a payout on every level-up. Bonus Rodux has to be wagered once before you can withdraw it.</p></div></div>
  <div class="rgrid">
    <section class="card rcard"><h3>Daily Rodux</h3><p>Claim ${fmt0(daily)} Rodux. The amount grows by 10 with every level.</p><div class="cd" id="cdc"></div><button class="cta" id="clc"></button></section>
    <section class="card rcard"><h3>Daily case</h3><div style="display:flex;gap:14px;align-items:center"><div style="width:90px;flex:none">${caseArt(CASE.daily)}</div><p>One free case a day, with a shot at a ${esc(ITEM[CASE.daily.items[0].id].n)}.</p></div><div class="cd" id="cdd"></div><button class="cta blue" data-go="case" data-p="daily">Open daily case</button></section>
    <section class="card rcard"><h3>Level ${L}</h3><p>Every level pays out automatically. Level ${L+1} pays ${fmt0((L+1)*50)} Rodux. Higher levels unlock profile frames and banners.</p><div class="xp-bar"><i style="width:${Math.max(2,(w-lo)/(hi-lo)*100)}%"></i></div><div class="kv"><span>Still to wager</span><b>${fmt0(Math.max(0,hi-w))}</b></div></section>
    <section class="card rcard"><h3>Daily missions</h3><div class="mis" id="mis"></div></section>
    <section class="card rcard"><h3>Promo code</h3><p>Got a code from Trade Empire's socials? Redeem it here.</p><form id="pf" class="mstack"><input class="txt" id="pcode" placeholder="Enter code" maxlength="20" autocomplete="off" aria-label="Promo code"><div class="err" id="perr"></div><button class="cta ghost">Redeem</button></form><p class="note">Try TRADEBLACKET.</p></section>
    <section class="card rcard"><h3>Out of Rodux?</h3><p>If your balance drops under 1 Rodux, you can top up to 100 once an hour.</p><button class="cta ghost" id="rf"></button></section>
  </div>`;
  function misDraw(){
    $('#mis').innerHTML=MIS.map(([k,l,goal,rew])=>{const v=Math.min(goal,S.mis[k]||0),done=v>=goal,cl=S.mis.claimed.includes(k);
      return `<div class="mi"><b>${l}</b>${cl?`<span class="note">Claimed</span>`:done?`<button class="cta sm" data-mc="${k}">Claim ${rew}</button>`:`<span class="note num">${v} / ${goal}</span>`}<div class="bar"><i style="width:${v/goal*100}%"></i></div></div>`}).join('');
    $$('[data-mc]').forEach(b=>b.onclick=()=>{const m=MIS.find(x=>x[0]===b.dataset.mc);if(!S.user){openLogin();return}S.mis.claimed.push(m[0]);bonus(m[3]);save();toast(`Mission done. +${m[3]} Rodux`,'win');misDraw()});
  }
  const cdTxt=ms=>{const h=Math.floor(ms/36e5),m=Math.floor(ms%36e5/6e4),s=Math.floor(ms%6e4/1e3);return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`};
  function tick(){
    if(!el.isConnected)return;
    const l1=S.claim+DAY-Date.now(),l2=S.dailyCase+DAY-Date.now(),cl=$('#clc');
    $('#cdc').textContent=l1>0?`Next claim in ${cdTxt(l1)}`:'Ready to claim';cl.disabled=l1>0;cl.innerHTML=l1>0?'Claimed today':`Claim ${fmt0(daily)} Rodux`;
    $('#cdd').textContent=l2>0?`Ready again in ${cdTxt(l2)}`:'Ready to open';
    const rl=(S.refill||0)+36e5-Date.now(),rf=$('#rf');rf.disabled=S.bal>=1||rl>0;rf.textContent=S.bal>=1?'Balance is above 1 Rodux':rl>0?`Available in ${cdTxt(rl)}`:'Top up to 100 Rodux';
  }
  $('#clc').onclick=()=>{if(!S.user){openLogin();return}if(Date.now()<S.claim+DAY)return;S.claim=Date.now();save();bonus(daily);toast(`+${fmt0(daily)} bonus Rodux`,'gold');const b=$('#clc').getBoundingClientRect();confetti(b.left+b.width/2,b.top,70);tick()};
  $('#rf').onclick=()=>{if(S.bal<1){S.refill=Date.now();bonus(100);toast('Topped up to 100 Rodux.','win');tick()}};
  $('#pf').onsubmit=e=>{e.preventDefault();if(!S.user){openLogin();return}const c=$('#pcode').value.trim().toUpperCase(),er=$('#perr');
    if(!PROMO[c]){er.textContent='That code is not valid. Check the spelling and try again.';return}
    if(S.promo.includes(c)){er.textContent='You already redeemed this code.';return}
    S.promo.push(c);save();bonus(PROMO[c]);er.textContent='';$('#pcode').value='';toast(`Code redeemed. +${PROMO[c]} Rodux`,'gold');confetti(innerWidth/2,innerHeight/2,90)};
  misDraw();tick();const t=setInterval(tick,1000);
  cleanup=()=>clearInterval(t);
};

/* ---------- boot ---------- */
(function(){
  const h=location.hash.slice(1);
  go(PAGES[h]&&!['case','battle','slot','article'].includes(h)?h:'home');
  // invite-only unless the server says otherwise: nobody browses without signing in
  if(!S.user&&window.TB_GATE!==false&&S.guest){S.guest=false;save()}
  if(!S.user&&!S.guest)showGate('up');
})();
