'use strict';
/* =========================================================
   Provably fair numbers. When signed in, every game number (rnd()) comes from the server's committed
   stream: HMAC-SHA256(serverSeed, clientSeed:nonce:cursor), 64 numbers per nonce. The server seed is
   shown only as a hash until it is rotated; then anyone can recompute every number.
   This browser keeps a short log of the rounds it used so they can be checked after a rotation.
   ========================================================= */
const FAIR={state:null,q:[],busy:false,live:false,log:[]};
const FAIR_KEEP=400;
function fairLogLoad(){try{FAIR.log=JSON.parse(localStorage.getItem('tb_fairlog_'+(WAPI.me&&WAPI.me.robloxId))||'[]')}catch{FAIR.log=[]}}
let fairSaveT=0;function fairLogSave(){clearTimeout(fairSaveT);fairSaveT=setTimeout(()=>{try{localStorage.setItem('tb_fairlog_'+(WAPI.me&&WAPI.me.robloxId),JSON.stringify(FAIR.log.slice(-FAIR_KEEP)))}catch{}},400)}
// Take the next number. Returns undefined when the stream is empty (rnd() then uses the browser's own).
FQ.next=()=>{
  if(!FAIR.live)return undefined;
  let r=FAIR.q[0];while(r&&r.i>=r.floats.length){FAIR.q.shift();r=FAIR.q[0]}
  if(!r){fairFill(8);return undefined}
  const v=r.floats[r.i++];
  let L=FAIR.log[FAIR.log.length-1];
  if(!L||L.n!==r.nonce||L.h!==r.hash){L={n:r.nonce,h:r.hash,c:r.client,first:+v.toFixed(10),used:0,g:typeof cur!=='undefined'?cur:'',t:Date.now()};FAIR.log.push(L);if(FAIR.log.length>FAIR_KEEP*1.5)FAIR.log=FAIR.log.slice(-FAIR_KEEP)}
  L.used++;fairLogSave();
  if(FAIR.q.reduce((a,x)=>a+x.floats.length-x.i,0)<160)fairFill(4);
  return v;
};
async function fairFill(rounds){
  if(FAIR.busy||!FAIR.live)return;FAIR.busy=true;
  try{const r=await api('/api/fair/batch',{rounds});if(r.ok){for(const x of r.j.rounds)FAIR.q.push({nonce:x.nonce,floats:x.floats,i:0,hash:r.j.serverSeedHash,client:r.j.clientSeed});
    if(FAIR.state){FAIR.state.serverSeedHash=r.j.serverSeedHash;FAIR.state.clientSeed=r.j.clientSeed;FAIR.state.nonce=r.j.rounds[r.j.rounds.length-1].nonce+1}
    if(r.j.rotated){FAIR.state=null;fairState()}}}
  catch{}finally{FAIR.busy=false}
}
async function fairState(){if(!WAPI.live||!WAPI.me)return null;const r=await api('/api/fair');if(r.ok)FAIR.state=r.j;return FAIR.state}
// Turn on once signed in; off when signed out.
WAPI.ready.then(async()=>{if(WAPI.live&&WAPI.me){FAIR.live=true;fairLogLoad();await fairFill(8)}});
setInterval(()=>{const on=!!(WAPI.live&&WAPI.me);if(on&&!FAIR.live){FAIR.live=true;fairLogLoad();fairFill(8)}else if(!on&&FAIR.live){FAIR.live=false;FAIR.q=[]}},3000);

// The same maths in the browser, for the verifier.
async function fairFloats(serverSeed,clientSeed,nonce,count=64){
  const enc=new TextEncoder(),key=await crypto.subtle.importKey('raw',enc.encode(serverSeed),{name:'HMAC',hash:'SHA-256'},false,['sign']);const out=[];
  for(let c=0;out.length<count&&c<8;c++){const d=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(`${clientSeed}:${nonce}:${c}`)));for(let i=0;i<32&&out.length<count;i+=4)out.push(d[i]/256+d[i+1]/65536+d[i+2]/16777216+d[i+3]/4294967296)}
  return out;
}
async function sha256hex(s){return[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('')}
// Check the rounds this browser used against a revealed seed. Returns {checked, matched, numbers}.
async function fairCheck(rev){
  const mine=FAIR.log.filter(l=>l.h===rev.serverSeedHash);let matched=0,numbers=0;
  for(const l of mine){const f=await fairFloats(rev.serverSeed,l.c,l.n,1);if(Math.abs(f[0]-l.first)<1e-9)matched++;numbers+=l.used}
  return{checked:mine.length,matched,numbers,hashOk:(await sha256hex(rev.serverSeed))===rev.serverSeedHash};
}
// What a number means in each game (the same conversions the games use).
const FAIR_GAMES=[
  ['Dice','roll = floor(n × 10001) / 100, a number from 0.00 to 100.00',n=>(Math.floor(n*10001)/100).toFixed(2)],
  ['Crash and Limbo','multiplier = max(1, floor(99 / (1 − n)) / 100)',n=>Math.max(1,Math.floor(99/(1-n))/100).toFixed(2)+'×'],
  ['Coinflip','heads when n < 0.5, tails otherwise',n=>n<.5?'Heads':'Tails'],
  ['Roulette','slot = floor(n × 15), 0 is green',n=>Math.floor(n*15)],
  ['Cups','the ball goes under cup floor(n × 3) + 1',n=>'Cup '+(Math.floor(n*3)+1)],
  ['Plinko','one number per row: left when n < 0.5, right otherwise',n=>n<.5?'Left':'Right'],
  ['Blackjack','card rank = floor(n × 13) (A, 2–10, J, Q, K), then suit = floor(n × 4) from the next number',n=>['A','2','3','4','5','6','7','8','9','10','J','Q','K'][Math.floor(n*13)]],
  ['Mines and Towers','each mine sits on tile floor(n × tiles), drawing again when a tile is taken',n=>'Tile '+(Math.floor(n*25)+1)+' of 25'],
  ['Wheel','segment = floor(n × number of segments)',n=>'Segment '+(Math.floor(n*30)+1)+' of 30'],
  ['Cases','walk the item list adding each drop chance until it passes n',n=>'Item at '+(n*100).toFixed(4)+'%'],
];
