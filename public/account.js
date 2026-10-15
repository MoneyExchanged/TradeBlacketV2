'use strict';
/* =========================================================
   Account: legal documents, responsible-play limits and screen time.

   Live: acceptance and limits are stored and enforced by the server (server.js, limits.js).
   The page mirrors them so it can explain a refusal before the server has to.
   Preview: the same rules run in the browser.
   ========================================================= */
const LEGAL_V={tos:LEGAL_DOCS.tos.v,cds:LEGAL_DOCS.cds.v,business:LEGAL_DOCS.business.v};
const DOCS=LEGAL_DOCS;
const LEG_ORDER=LEGAL_DOCS.order;
const PACKS={site:{t:'TradeBlacket agreements',lead:'Read each document, then sign once with your name and a drawn signature. You need to do this before you can play.'},cds:{t:'Currency Deduction Service',lead:'Deposits take Rodux and items from your Trade Empire save. Read how that works and sign before your first deposit.'},business:{t:'Business and Partner Program Agreement',lead:'This covers your membership, the Partner Program, your Monthly Wage of TradeBlacket and your Business Card. Read it and sign to continue.'}};

/* ---------- the documents ---------- */
// Paragraphs are separated by blank lines; lines starting "- " are list items.
const legalPara=p=>p.split('\n\n').map(par=>{const L=par.split('\n');return L.every(l=>l.startsWith('- '))?`<ul>${L.map(l=>`<li>${esc(l.slice(2))}</li>`).join('')}</ul>`:L.some(l=>l.startsWith('- '))?L.map(l=>l.startsWith('- ')?`<ul><li>${esc(l.slice(2))}</li></ul>`:`<p>${esc(l)}</p>`).join(''):`<p>${L.map(esc).join('<br>')}</p>`}).join('');
const docHtml=k=>{const d=DOCS[k];return`<div class="legal"><p class="note">Version ${esc(d.v)} · last updated ${esc(d.updated)}</p>${d.b.map(([h,p],i)=>`<h4 id="lg-${k}-${i+1}">${i+1}. ${esc(h)}</h4>${legalPara(p)}`).join('')}</div>`};
PAGES.legal=(el,doc)=>{
  const k=DOCS[doc]&&doc!=='order'&&doc!=='packs'&&doc!=='text'?doc:'tos';
  const st=WAPI.live&&WAPI.me&&WAPI.me.legal;
  el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / <button data-go="docs">Docs</button> / Legal</div><h2>${esc(DOCS[k].t)}</h2><p>${esc(DOCS[k].s)}</p></div></div>
  <div class="legal-wrap"><nav class="legal-nav">${LEG_ORDER.map(x=>`<button data-go="legal" data-p="${x}" class="${x===k?'on':''}">${esc(DOCS[x].t)}</button>`).join('')}<button data-go="settings">Responsible play</button></nav>
  <article class="card">${st?`<p class="lg-state ${signedNow(k)?'is-ok':''}">${signedNow(k)?'You have signed this version.':'You have not signed this version yet.'}${S.user?' <button class="lnk" data-go="prefs">Your signed agreements</button>':''}</p>`:''}${docHtml(k)}</article></div>`;
};
const packOfDoc=k=>Object.keys(DOCS.packs).find(p=>DOCS.packs[p].includes(k));
const signedNow=k=>{const p=packOfDoc(k);return p==='site'?accepted('tos'):accepted(p)};
document.addEventListener('click',e=>{const b=e.target.closest('[data-legal]');if(!b)return;e.preventDefault();const k=b.dataset.legal;
  if($('#gate').innerHTML||$('#modal').innerHTML||$('#signgate'))modal(`<h3>${esc(DOCS[k].t)}</h3>${docHtml(k)}`,{cls:'mid'});else go('legal',k)});

/* ---------- signing ---------- */
const accepted=k=>WAPI.live&&WAPI.me?!!(WAPI.me.legal&&WAPI.me.legal[k]):(S.legal||{})[k]===LEGAL_V[k];
// The scribble pad: draw with a mouse, trackpad, pen or finger. Returns {el, data(), clear()}.
function scribble(host){
  host.innerHTML=`<div class="sg-pad"><canvas aria-label="Signature pad: draw your signature" role="img"></canvas><span class="sg-x">✕</span><span class="sg-line"></span><span class="sg-hint">Sign here</span><button type="button" class="sg-clear">Clear</button></div>`;
  const pad=$('.sg-pad',host),cv=$('canvas',host),ctx=cv.getContext('2d');let W=0,H=0,dpr=1,strokes=0,ink=0,last=null,lastW=2.4,drawing=false,onchange=()=>{};
  const size=()=>{const r=cv.getBoundingClientRect();dpr=Math.min(3,devicePixelRatio||1);const img=strokes?cv.toDataURL():null;W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#14213D';if(img){const i=new Image();i.onload=()=>ctx.drawImage(i,0,0,W,H);i.src=img}};
  const pt=e=>{const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top,t:performance.now(),p:e.pressure&&e.pointerType==='pen'?e.pressure:.5}};
  cv.addEventListener('pointerdown',e=>{e.preventDefault();cv.setPointerCapture(e.pointerId);drawing=true;last=pt(e);lastW=2.4;strokes++;pad.classList.add('inked');ctx.beginPath();ctx.arc(last.x,last.y,1.2,0,7);ctx.fillStyle='#14213D';ctx.fill();onchange()});
  cv.addEventListener('pointermove',e=>{if(!drawing)return;e.preventDefault();const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];for(const ev of evs){const p=pt(ev),dx=p.x-last.x,dy=p.y-last.y,d=Math.hypot(dx,dy);if(d<.8)continue;
    const v=d/Math.max(1,p.t-last.t),w=Math.max(1.1,Math.min(3.6,(3.4-v*1.1)*(.6+p.p)));lastW=lastW*.6+w*.4;
    ctx.lineWidth=lastW;ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.quadraticCurveTo(last.x,last.y,(last.x+p.x)/2,(last.y+p.y)/2);ctx.lineTo(p.x,p.y);ctx.stroke();ink+=d;last=p}onchange()});
  const end=()=>{drawing=false;last=null};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);cv.addEventListener('lostpointercapture',end);
  const clear=()=>{ctx.clearRect(0,0,W,H);strokes=0;ink=0;pad.classList.remove('inked');onchange()};
  $('.sg-clear',host).onclick=clear;
  requestAnimationFrame(size);const ro=new ResizeObserver(()=>{if(Math.abs(cv.getBoundingClientRect().width-W)>2)size()});ro.observe(cv);
  // Export: the strokes on a transparent background, at most 600 px wide.
  const data=()=>{const sc=Math.min(1,600/W),o=document.createElement('canvas');o.width=Math.max(200,Math.round(W*sc));o.height=Math.max(60,Math.round(H*sc));o.getContext('2d').drawImage(cv,0,0,o.width,o.height);return{signature:o.toDataURL('image/png'),strokes,ink:Math.round(ink)}};
  return{data,clear,get ink(){return ink},get strokes(){return strokes},set onchange(f){onchange=f}};
}
// The signing sheet for a pack. Resolves true once signed.
function signSheet(pack,{blocking=false}={}){
  return new Promise(res=>{
    const P=PACKS[pack],list=DOCS.packs[pack],read=new Set();let idx=0,pad=null,done=false;
    const el=document.createElement('div');el.id='signgate';el.className='sg';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label',P.t);
    const today=new Date().toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'});
    el.innerHTML=`<div class="sg-sheet"><header class="sg-h"><div><p class="sg-eyebrow">Electronic signature</p><h2>${esc(P.t)}</h2><p>${esc(P.lead)}</p></div>${blocking?'':'<button class="ib sg-close" aria-label="Close">'+ic('x',18,2)+'</button>'}</header>
      <div class="sg-body"><nav class="sg-docs">${list.map((k,i)=>`<button data-sgd="${i}"><i></i><span>${esc(DOCS[k].t)}</span></button>`).join('')}</nav>
        <div class="sg-read"><div class="sg-doc" tabindex="0"></div><div class="sg-more"><span>Scroll to the end of each document</span><button class="cta ghost inline" id="sg-next">Next document</button></div></div></div>
      <footer class="sg-f"><div class="sg-who"><label class="fld"><span>Full name</span><input class="txt" id="sg-name" maxlength="60" autocomplete="name" placeholder="As you want it on the agreement" value="${esc(S.user?'':'')}"></label><p class="sg-meta">Signing as <b>${esc(S.user?S.user.name:'')}</b> on ${esc(today)}</p></div>
        <div class="sg-padwrap" id="sg-pad"></div>
        <div class="sg-go"><label class="check"><input type="checkbox" id="sg-ok"> I have read ${list.length>1?'these documents':'this document'}, I agree to ${list.length>1?'them':'it'}, and I am 18 or older. My electronic signature is as binding as my handwritten one.</label><div class="err" id="sg-e"></div><button class="cta" id="sg-sign" disabled>Sign ${list.length>1?'all '+list.length+' documents':'agreement'}</button></div></footer></div>`;
    document.body.appendChild(el);document.body.classList.add('sg-on');
    const R=el,docBox=$('.sg-doc',R);
    const close=ok=>{if(done)return;done=true;el.remove();document.body.classList.remove('sg-on');res(ok)};
    if(!blocking){$('.sg-close',R).onclick=()=>close(false);el.addEventListener('keydown',e=>{if(e.key==='Escape')close(false)})}
    const check=()=>{$('#sg-sign',R).disabled=!(read.size===list.length&&$('#sg-name',R).value.trim().length>=2&&pad&&pad.ink>=80&&$('#sg-ok',R).checked)};
    const markRead=()=>{if(docBox.scrollTop+docBox.clientHeight>=docBox.scrollHeight-24){read.add(idx);drawNav();check()}};
    const drawNav=()=>{$$('[data-sgd]',R).forEach(b=>{const i=+b.dataset.sgd;b.classList.toggle('on',i===idx);b.classList.toggle('read',read.has(i))});
      const nx=$('#sg-next',R);nx.hidden=idx>=list.length-1;$('.sg-more span',R).textContent=read.size===list.length?'All read. Sign below.':`${read.size} of ${list.length} read. Scroll to the end of each document.`};
    const show=i=>{idx=i;docBox.innerHTML=docHtml(list[i]);docBox.scrollTop=0;drawNav();setTimeout(markRead,60)};
    docBox.addEventListener('scroll',markRead);
    $$('[data-sgd]',R).forEach(b=>b.onclick=()=>show(+b.dataset.sgd));
    $('#sg-next',R).onclick=()=>show(Math.min(list.length-1,idx+1));
    pad=scribble($('#sg-pad',R));pad.onchange=check;$('#sg-name',R).oninput=check;$('#sg-ok',R).onchange=check;
    show(0);
    $('#sg-sign',R).onclick=async()=>{
      const btn=$('#sg-sign',R),e=$('#sg-e',R);e.textContent='';btn.disabled=true;btn.innerHTML='<div class="spin sm"></div>Signing';
      const d=pad.data(),body={docs:list,name:$('#sg-name',R).value.trim(),...d,versions:Object.fromEntries(list.map(k=>[k,DOCS[k].v]))};
      if(WAPI.live){const r=await api('/api/legal/sign',body);if(!r.ok){e.textContent=r.j.error||'Could not sign. Try again.';btn.innerHTML=`Sign ${list.length>1?'all '+list.length+' documents':'agreement'}`;check();return}await syncMe()}
      const keys=pack==='site'?['tos']:[pack];S.legal={...(S.legal||{})};keys.forEach(k=>S.legal[k]=LEGAL_V[k]);
      S.signatures=[{pack,name:body.name,at:Date.now(),img:d.signature},...(S.signatures||[])].slice(0,10);save();
      $('.sg-sheet',R).innerHTML=`<div class="sg-done">${ic('check',30,2.4)}<h2>Signed</h2><p>${list.length>1?`All ${list.length} documents are signed.`:'The agreement is signed.'} You can see and download your signed copies in Settings.</p></div>`;
      setTimeout(()=>close(true),1300);
    };
  });
}
// Called before any deposit. Resolves true once the Deduction Service is signed.
async function needCds(){if(accepted('cds'))return true;return signSheet('cds')}
let tosAsked=false;
async function needTos(){
  if(!S.user||accepted('tos')||tosAsked||$('#signgate'))return true;
  tosAsked=true;const ok=await signSheet('site',{blocking:WAPI.live});tosAsked=false;return ok;
}
// Signed in but the current agreements are not signed: ask straight away (live site).
function legalGate(){if(WAPI.live&&WAPI.me&&WAPI.me.legal&&!WAPI.me.legal.tos&&!$('#signgate')&&!(typeof swAway==='function'&&swAway()))needTos()}
WAPI.ready.then(()=>setTimeout(legalGate,400));setInterval(legalGate,5000);

/* ---------- your signed agreements (Settings) ---------- */
async function sigRecord(id){
  const r=await api('/api/legal/record/'+id);if(!r.ok)return toast(r.j.error,'loss');const s=r.j;
  const m=modal(`<span class="eyebrow">Signed agreement</span><h3>${esc(s.title)}</h3><div class="sg-paper"><img src="/api/legal/signature/${esc(s.id)}.png" alt="Drawn signature of ${esc(s.name)}"><div><b>${esc(s.name)}</b><span>${new Date(s.signedAt).toLocaleString()}</span></div></div>
    <dl class="sg-kv"><div><dt>Reference</dt><dd>${esc(s.id)}</dd></div><div><dt>Version</dt><dd>${esc(s.version)}</dd></div><div><dt>Document fingerprint (SHA-256)</dt><dd><code>${esc(s.docHash)}</code></dd></div><div><dt>Signature fingerprint</dt><dd><code>${esc(s.signatureHash)}</code></dd></div></dl>
    ${s.text?`<div class="legal-box">${docHtml(s.doc)}</div>`:'<p class="note">This version has since been replaced. The fingerprint above identifies the exact text you signed.</p>'}<button class="cta" id="sgdl">${ic('download',16,2)}Download a copy</button>`,{cls:'mid'});
  $('#sgdl',m.root).onclick=async()=>{const blob=await fetch('/api/legal/signature/'+s.id+'.png').then(r=>r.blob()),img=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(blob)});
    const html=`<!doctype html><meta charset="utf-8"><title>${esc(s.title)} – signed ${esc(s.id)}</title><style>body{font:15px/1.6 Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;color:#111}h1{font-size:24px}h4{margin:18px 0 4px}code{font-size:12px;word-break:break-all}.sig{border-top:1px solid #999;margin-top:32px;padding-top:12px}</style><h1>${esc(s.title)}</h1><p>Version ${esc(s.version)}</p>${docHtml(s.doc).replace(/<p class="note">.*?<\/p>/,'')}<div class="sig"><img src="${img}" style="height:80px"><p><b>${esc(s.name)}</b> (Roblox account ${esc(S.user?S.user.name:'')}) signed electronically on ${new Date(s.signedAt).toUTCString()}.</p><p>Reference ${esc(s.id)}<br>Document SHA-256 <code>${esc(s.docHash)}</code><br>Signature SHA-256 <code>${esc(s.signatureHash)}</code></p></div>`;
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));a.download=`TradeBlacket-${s.doc}-${s.id}.html`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)};
}
async function sigSection(el){
  const box=$('.st2',el);if(!box||!S.user)return;
  let rows=[];if(WAPI.live){const r=await api('/api/legal');if(!r.ok||!el.isConnected)return;rows=r.j.signatures}
  else rows=(S.signatures||[]).map((x,i)=>({id:'',title:PACKS[x.pack].t,name:x.name,signedAt:x.at,current:true,pack:x.pack}));
  const need=['site','cds',...(WAPI.me&&WAPI.me.business?['business']:[])].filter(p=>!(p==='site'?accepted('tos'):accepted(p)));
  box.insertAdjacentHTML('beforeend',`<section class="card glass st2-sec sg-sec"><h3>Signed agreements</h3><p class="note">Every document you signed, with the exact version and its fingerprint. Open one to see your signature or download a copy.</p>
    ${need.length?`<div class="sg-need">${need.map(p=>`<button class="cta ghost inline" data-sgp="${p}">Sign the ${esc(PACKS[p].t)}</button>`).join('')}</div>`:''}
    ${rows.length?`<div class="sg-list">${rows.map(s=>`<button class="sg-row" ${s.id?`data-sig="${esc(s.id)}"`:''}><span><b>${esc(s.title)}</b><small>Signed by ${esc(s.name)} · ${new Date(s.signedAt).toLocaleDateString()}${s.version?' · version '+esc(s.version):''}</small></span><i class="ac-pill ${s.current?'is-ok':''}">${s.current?'Current':'Replaced'}</i></button>`).join('')}</div>`:'<p class="note">Nothing signed yet.</p>'}</section>`);
  $$('[data-sig]',box).forEach(b=>b.onclick=()=>sigRecord(b.dataset.sig));
  $$('[data-sgp]',box).forEach(b=>b.onclick=async()=>{if(await signSheet(b.dataset.sgp))go('prefs')});
}

/* ---------- cookie notice ---------- */
(function(){let seen=false;try{seen=localStorage.getItem('tb_cookie_ok')==='1'}catch{}if(seen)return;
  const b=document.createElement('div');b.className='ck';b.setAttribute('role','region');b.setAttribute('aria-label','Cookies');
  b.innerHTML=`<p>TradeBlacket only uses cookies it needs to keep you signed in and protect accounts. No ads, no tracking.</p><div><button class="lnk" data-legal="cookies">Cookie Policy</button><button class="cta inline" id="ckok">OK</button></div>`;
  document.body.appendChild(b);$('#ckok',b).onclick=()=>{try{localStorage.setItem('tb_cookie_ok','1')}catch{}b.remove()};
})();

/* ---------- limits ---------- */
const DAYMS=864e5,dayKey=t=>new Date(t).toISOString().slice(0,10),nextMidnight=()=>Date.parse(dayKey(Date.now())+'T00:00:00Z')+DAYMS;
const LIM_KEYS=[['dailyMinutes','Daily screen time','minutes a day','Playing and deposits stop for the rest of the day (UTC) once you reach it.'],
  ['reminderMinutes','Reality check','minutes','A reminder of how long you have been playing, every this many minutes.'],
  ['depositCap','Daily Rodux deposit limit','Rodux a day','The most Rodux you can deposit from Trade Empire each day.'],
  ['itemCap','Daily limited deposit limit','value a day','The most item value you can deposit from Trade Empire each day.'],
  ['maxBet','Largest single bet','Rodux','Any bet above this is refused.'],
  ['lossLimit','Daily loss limit','Rodux a day','Play stops for the day once your net losses reach this.']];
// Local copy of limits.js, for the preview and for instant feedback.
function localLim(){
  S.lim=S.lim||{s:{},pending:{},day:'',seconds:0,net:0,last:0};const L=S.lim,t=Date.now();
  for(const[k,p]of Object.entries(L.pending))if(t>=p.at){L.s[k]=p.value;delete L.pending[k]}
  if(L.day!==dayKey(t)){L.day=dayKey(t);L.seconds=0;L.net=0}
  return L;
}
function localStatus(){
  const L=localLim(),s=L.s,t=Date.now();let lock=null;
  if((s.selfExcludedUntil||0)>t)lock={reason:'selfExclude',until:s.selfExcludedUntil};
  else if((s.coolOffUntil||0)>t)lock={reason:'coolOff',until:s.coolOffUntil};
  else if(s.dailyMinutes&&L.seconds>=s.dailyMinutes*60)lock={reason:'screenTime',until:nextMidnight()};
  else if(s.lossLimit&&-L.net>=s.lossLimit)lock={reason:'lossLimit',until:nextMidnight()};
  const set={};LIM_KEYS.forEach(([k])=>set[k]=s[k]||0);set.coolOffUntil=s.coolOffUntil||0;set.selfExcludedUntil=s.selfExcludedUntil||0;
  return{settings:set,pending:L.pending,usedSeconds:L.seconds,net:L.net,lock,depositedToday:0,itemsToday:0};
}
function localUpdate(p){
  const L=localLim(),s=L.s,t=Date.now();
  for(const[k]of LIM_KEYS){if(!(k in p))continue;const v=p[k]===''||p[k]==null?0:Math.floor(+p[k]);if(!Number.isFinite(v)||v<0)throw new Error('Enter a whole number, or leave it empty for no limit.');
    const cur=s[k]||0,stricter=k==='reminderMinutes'||(v>0&&(cur===0||v<cur));if(stricter||v===cur){s[k]=v;delete L.pending[k]}else L.pending[k]={value:v,at:t+DAYMS}}
  const C={'24h':DAYMS,'72h':3*DAYMS,'7d':7*DAYMS},X={'30d':30*DAYMS,'90d':90*DAYMS,'180d':180*DAYMS};
  if(p.coolOff)s.coolOffUntil=Math.max(s.coolOffUntil||0,t+C[p.coolOff]);
  if(p.selfExclude)s.selfExcludedUntil=Math.max(s.selfExcludedUntil||0,t+X[p.selfExclude]);
  save();return localStatus();
}
let LIM=null;
const limStatus=()=>LIM||(WAPI.live&&WAPI.me&&WAPI.me.limits)||localStatus();
async function drawLimits(){
  if(WAPI.live){if(!S.user)return;const r=await api('/api/limits');if(r.ok)LIM=r.j}else LIM=localStatus();
  drawLockBar();
}
async function saveLimits(patch){
  if(WAPI.live){const r=await api('/api/limits',patch);if(!r.ok)throw new Error(r.j.error||'Could not save.');LIM=r.j}
  else LIM=localUpdate(patch);
  drawLockBar();return LIM;
}
const LOCKTXT={selfExclude:'You excluded yourself',coolOff:'You are on a break',screenTime:'Daily screen time reached',lossLimit:'Daily loss limit reached'};
const until=t=>{const d=new Date(t);return d.toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})};
function drawLockBar(){
  let bar=$('#lockbar');const st=limStatus(),lk=S.user&&st&&st.lock;
  if(!lk){if(bar)bar.remove();document.body.classList.remove('locked');return}
  if(!bar){bar=document.createElement('div');bar.id='lockbar';bar.className='lockbar';bar.setAttribute('role','status');document.body.appendChild(bar)}
  document.body.classList.add('locked');
  bar.innerHTML=`${ic('shield',16,2)}<b>${LOCKTXT[lk.reason]}</b><span>Playing and deposits are paused until ${until(lk.until)}. Withdrawals stay open.</span><button data-go="settings">Details</button>`;
}
function lockReason(){const st=limStatus();return S.user&&st&&st.lock?`${LOCKTXT[st.lock.reason]}. Playing is paused until ${until(st.lock.until)}.`:null}

/* ---------- hooks into play ---------- */
// Every bet goes through take(). Refuse it while paused, above the bet limit, or before the terms are accepted.
{const base=take;take=function(a){
  if(!S.user)return base(a);
  const why=lockReason();if(why){toast(why,'loss');drawLockBar();return false}
  const mb=limStatus().settings.maxBet;if(mb&&a>mb){toast(`That's above your largest-bet limit of ${fmt0(mb)} Rodux. You can change it under Responsible play.`,'loss');return false}
  if(!accepted('tos')){needTos();return false}
  return base(a);
}}
// Track the day's net result for the loss limit.
{const base=settle;settle=function(game,bet,mult,payout,o){
  const L=localLim();L.net=Math.round(L.net+(payout-bet));save();
  const r=base(game,bet,mult,payout,o);
  if(!WAPI.live){LIM=localStatus();if(LIM.lock)drawLockBar()}
  return r;
}}
// Screen time: count a minute for every minute the tab is open and visible while signed in.
let remindAt=0;
setInterval(async()=>{
  if(!S.user||document.hidden)return;
  const L=localLim();L.seconds+=60;L.last=Date.now();save();
  if(WAPI.live){const r=await api('/api/limits/heartbeat',{seconds:60,net:L.net});if(r.ok)LIM=r.j}else LIM=localStatus();
  const st=limStatus(),rm=st.settings.reminderMinutes,used=Math.floor(st.usedSeconds/60);
  if(rm&&used>=remindAt+rm&&used>0){remindAt=used-(used%rm);toast(`Reality check: you've played for ${used} minute${used===1?'':'s'} today.`,'gold')}
  drawLockBar();
},60000);
addEventListener('load',()=>setTimeout(()=>{drawLimits();if(WAPI.live&&WAPI.me)needTos()},1500));

/* ---------- Responsible play page ---------- */
PAGES.settings=el=>{
  if(!S.user){el.innerHTML=`<div class="empty"><h3>Responsible play</h3><p>Sign in to set limits on your time, deposits and bets.</p><button class="cta inline" data-open="login">Sign in</button></div>`;return}
  const draw=()=>{
    const st=limStatus(),s=st.settings,P=st.pending||{},used=Math.floor(st.usedSeconds/60),lk=st.lock;
    el.innerHTML=`<div class="page-h"><div><div class="crumb"><button data-go="home">Home</button> / Account</div><h2>Responsible play</h2><p>Set limits that keep TradeBlacket fun. Stricter limits start now. Raising or removing a limit waits 24 hours, so a decision made with a clear head sticks. Withdrawals are never limited.</p></div></div>
    ${lk?`<div class="card lockcard">${ic('shield',20,2)}<div><b>${LOCKTXT[lk.reason]}</b><span>Playing and deposits are paused until ${until(lk.until)}. You can still withdraw Rodux and items.</span></div></div>`:''}
    <div class="fl-stats"><div class="stat"><span>Played today</span><b>${used} min${s.dailyMinutes?` <small>of ${s.dailyMinutes}</small>`:''}</b></div><div class="stat"><span>Net today</span><b class="${st.net>=0?'w':'l'}">${st.net>=0?'+':'−'}${fmt0(Math.abs(st.net))}</b></div>${WAPI.live?`<div class="stat"><span>Deposited today</span><b>${chip(13)}${fmt0(st.depositedToday)}</b></div>`:''}</div>
    <div class="set-grid">
      <form class="card set-card" id="limf"><h3>Limits</h3><p class="note">Leave a box empty for no limit.</p>
        ${LIM_KEYS.map(([k,l,u,d])=>`<label class="fld set-row"><span>${l}</span><div class="set-in"><input class="txt" name="${k}" type="number" min="0" step="1" inputmode="numeric" placeholder="No limit" value="${s[k]||''}"><em>${u}</em></div><small>${d}${P[k]?` <b class="pend">Changes to ${P[k].value||'no limit'} on ${until(P[k].at)}</b>`:''}</small></label>`).join('')}
        <div class="err" id="lime"></div><button class="cta">Save limits</button></form>
      <div class="mstack">
        <div class="card set-card"><h3>Take a break</h3><p class="note">Stops playing and deposits for the time you choose. It cannot be ended early.</p>
          <div class="brk">${[['24h','24 hours'],['72h','3 days'],['7d','7 days']].map(([v,l])=>`<button class="cta ghost sm" data-cool="${v}">${l}</button>`).join('')}</div>
          ${s.coolOffUntil>Date.now()?`<p class="note">On a break until ${until(s.coolOffUntil)}.</p>`:''}</div>
        <div class="card set-card"><h3>Self-exclusion</h3><p class="note">A longer break for when you need real distance. You can still sign in to withdraw. It cannot be ended early.</p>
          <div class="brk">${[['30d','30 days'],['90d','90 days'],['180d','180 days']].map(([v,l])=>`<button class="cta ghost sm" data-excl="${v}">${l}</button>`).join('')}</div>
          ${s.selfExcludedUntil>Date.now()?`<p class="note">Excluded until ${until(s.selfExcludedUntil)}.</p>`:''}</div>
        <div class="card set-card"><h3>Need to talk?</h3><p class="note">If playing stops feeling like a game, take a break and talk to someone you trust. Rodux and items have no real-world value, and nothing on TradeBlacket is worth stress.</p></div>
      </div>
    </div>`;
    $('#limf').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),p={};LIM_KEYS.forEach(([k])=>p[k]=f.get(k));
      try{await saveLimits(p);toast('Limits saved.','win');draw()}catch(er){$('#lime').textContent=er.message}};
    $$('[data-cool],[data-excl]',el).forEach(b=>b.onclick=()=>{
      const cool=b.dataset.cool,label=b.textContent;
      const m=modal(`<h3>${cool?'Take a break':'Exclude yourself'} for ${label}?</h3><p>Playing and deposits stop until ${until(Date.now()+({'24h':1,'72h':3,'7d':7,'30d':30,'90d':90,'180d':180})[cool||b.dataset.excl]*DAYMS)}. This cannot be undone early. Withdrawals stay open.</p><div class="mstack"><button class="cta red" id="bk1">Start ${label} ${cool?'break':'exclusion'}</button><button class="cta ghost" id="bk0">Cancel</button></div>`);
      $('#bk0',m.root).onclick=m.close;
      $('#bk1',m.root).onclick=async()=>{try{await saveLimits(cool?{coolOff:cool}:{selfExclude:b.dataset.excl});m.close();toast('Done. Take care of yourself.');draw()}catch(er){toast(er.message,'loss')}};
    });
  };
  draw();drawLimits().then(()=>{if(el.isConnected&&cur==='settings')draw()});
};
