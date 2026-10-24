// Independent exhaustive oracle: the new rejection rule must never remove a
// solvable board. Production exports and behavior remain unchanged for tests.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../search.js'),'utf8')
 .replace('return {solve,assess,exportProofCache,restoreProofCache}','return {solve,beamSolve,resourcePolicyStream,resourceNoise,assess,exportProofCache,restoreProofCache}')
 .replace('const root=Array(14).fill(0);','globalThis.resourceForTest=b=>resourceViable(b,colorGroups(b));const root=Array(14).fill(0);');
const names=['white','red','blue','purple','yellow','orange','green'];
function oracle(b,adj,cache){const key=b.join('');if(cache.has(key))return cache.get(key);if(b.every(c=>!c))return true;const gs=[],seen=new Set();for(let i=0;i<b.length;i++){if(!b[i]||seen.has(i))continue;const q=[i];seen.add(i);for(const x of q)for(const y of adj[x])if(b[y]===b[i]&&!seen.has(y)){seen.add(y);q.push(y);}gs.push(q);}for(let a=0;a<gs.length;a++)for(let d=a+1;d<gs.length;d++){const g=gs[a],h=gs[d];if((b[g[0]]&b[h[0]])||!g.some(x=>adj[x].some(y=>h.includes(y))))continue;for(const x of g)for(const y of h)for(const [i,j] of [[x,y],[y,x]]){const next=b.slice();next[i]=0;next[j]=(b[i]|b[j])===7?0:b[i]|b[j];if(oracle(next,adj,cache)){cache.set(key,true);return true;}}}cache.set(key,false);return false;}
const pack=(b,indices)=>{const p=Array(14).fill(0);indices.forEach((i,j)=>{if(b[j])p[b[j]*2+(i<30?0:1)]|=1<<(i%30);});return p;};
let checked=0,rejected=0;
for(const small of [Array.from({length:6},(_,i)=>[i-1,i+1].filter(j=>j>=0&&j<6)),Array.from({length:6},(_,i)=>[(i+1)%6,(i+5)%6]),[[1,2,3,4,5],[0],[0],[0],[0],[0]]]){
 const ctx={module:{exports:{}}};vm.runInNewContext(source,ctx);const indices=[0,1,29,30,58,59],adj=Array.from({length:60},()=>[]);indices.forEach((i,k)=>{adj[i]=small[k].map(j=>indices[j]);});
 const setup=ctx.module.exports.beamSolve(Array(60).fill('white'),adj,{adaptiveTail:true,resourceMatching:true,width:8});setup.next();const cache=new Map();
 for(let code=0;code<117649;code++){let v=code;const b=[];for(let i=0;i<6;i++){b.push(v%7);v=Math.floor(v/7);}const counts=[1,2,4].map(bit=>b.reduce((n,c)=>n+!!(c&bit),0));if(counts[0]!==counts[1]||counts[0]!==counts[2])continue;
 const feasible=ctx.resourceForTest(pack(b,indices));if(!feasible){rejected++;assert.equal(oracle(b,small,cache),false,`unsafe rejection: ${JSON.stringify({b,small})}`);}checked++;
 }setup.return();
}
assert(rejected>0);
// Independent BigInt arithmetic verifies native 64-bit hashing across both
// 30-bit words, without using the production multiply/shift helpers.
const ctx={module:{exports:{}}};vm.runInNewContext(source,ctx);const {resourcePolicyStream,resourceNoise}=ctx.module.exports,stream=resourcePolicyStream(),policy=stream(),mask=(1n<<64n)-1n;
assert.equal((BigInt(policy.seedHi)<<32n)|BigInt(policy.seedLo),9414635314647932302n);assert.notEqual(stream().seedLo,policy.seedLo);
function mix(x){x^=x>>30n;x=x*0xbf58476d1ce4e5b9n&mask;x^=x>>27n;x=x*0x94d049bb133111ebn&mask;return x^(x>>31n);}
let rng=12345;for(let t=0;t<1000;t++){const b=Array.from({length:60},()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng%7;});const p=pack(b,Array.from({length:60},(_,i)=>i));let h=17n;for(let c=1;c<7;c++)h=mix(h^(BigInt(p[c*2])|(BigInt(p[c*2+1])<<30n)));h=mix(h^((BigInt(policy.seedHi)<<32n)|BigInt(policy.seedLo)));assert.equal(resourceNoise(p,policy),Math.fround(Number(h>>11n)/9007199254740992));}
console.log(`PASS: resource matching safely checked ${checked} exhaustive mixed boards (${rejected} rejected), including bit indices 29/30/58/59; native policy/hash parity passed 1,000 independent cases.`);

// The new turn is cooperative and cancellable before any partial playback.
const board=require('./oct24-timeout-boards.json')[0].tiles,cells=[];
for(let r=0;r<8;r++)for(let c=0;c<(r%2?7:8);c++)cells.push([r,c]);
const adj=cells.map(([r,c])=>cells.flatMap(([s,d],i)=>((2*c+r%2)-(2*d+s%2))**2+3*(r-s)**2===4?[i]:[]));
const run=ctx.module.exports.solve(board,adj,{hybrid:true,quickPlanMs:0,resourceAfterMs:0});
for(let i=0;i<100;i++){const step=run.next();assert.equal(step.done,false);assert.equal(step.value.type,'search');}
assert.equal(run.return().done,true);assert.equal(run.next().done,true);
for(const options of [{resourceAfterMs:-1},{resourceWarmupMs:Infinity}])assert.throws(()=>ctx.module.exports.solve(board,adj,{hybrid:true,...options}).next(),/nonnegative and finite/);
console.log('PASS: donor-aware turn yields cooperatively, cancels without partial playback, and validates its computation budgets.');

// Charge the bounded donor turn separately: its work must not retire the
// original frontier early. Stub lanes and a fake clock make this independent
// of CPU speed and browser scheduling.
let clock=0;const closed=new Set(),scheduleContext={module:{exports:{}},Date:{now:()=>clock}};
const stub=lane=>(function*(){try{for(;;){clock++;yield {type:'search',lane};}}finally{closed.add(lane);}})();
scheduleContext.stubSearch=(tiles,adj,options)=>stub(options.bridgePlanning?'bridge':options.moveTreeSearch?'diagnostic':'legacy');
scheduleContext.stubBeam=(tiles,adj,options)=>stub(options?.resourceMatching?'resource':options?.adaptive?'adaptive':'original');
const start=source.indexOf('  function* hybridSolve('),end=source.indexOf('  // Restart strategic',start);
const schedulingSource=source.slice(0,start)+source.slice(start,end).replaceAll('solveAttempt(','globalThis.stubSearch(').replaceAll('beamSolve(','globalThis.stubBeam(')+source.slice(end);
vm.runInNewContext(schedulingSource,scheduleContext);
const scheduling=scheduleContext.module.exports.solve(['red'],[[]],{hybrid:true,quickPlanMs:0,resourceAfterMs:0,resourceWarmupMs:8,adaptiveAfterMs:5});
for(let i=0;i<8;i++)assert.equal(scheduling.next().value.lane,'resource');
assert.equal(scheduling.next().value.lane,'original','donor computation must not consume the original initial budget');
let switched=false;for(let i=0;i<1000&&!switched;i++){const event=scheduling.next().value;switched=!!event.message?.includes('adaptive color priorities');}
assert(switched);assert(!closed.has('resource'),'retain donor frontier across the adaptive transition');
scheduling.return();assert(closed.has('resource'));assert(closed.has('original'));
console.log('PASS: the bounded donor turn preserves the original computation budget and retained frontier through adaptive activation.');
