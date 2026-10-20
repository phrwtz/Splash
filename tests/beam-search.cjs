const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../search.js'),'utf8');
function fresh(){const context={module:{exports:{}}};vm.runInNewContext(source,context);return context.module.exports;}
function replay(tiles,adj){const original=tiles.slice(),g=fresh().solve(tiles,adj,{hybrid:true,quickPlanMs:0,diagnosticSearch:false});let b=tiles.slice(),step,count=0,beam=false;try{while(!(step=g.next()).done){const e=step.value;beam||=e.phase==='beam-planning';if(e.type==='search')continue;assert.equal(e.type,'forward');assert(e.plan.continuationVerified);assert.deepEqual(Array.from(e.before),b);b=Array.from(e.after);count++;}assert.equal(step.value,'solved');assert(b.every(c=>c==='white'));assert.deepEqual(tiles,original);return {count,beam};}finally{g.return();}}
assert.deepEqual(replay(['red','blue','yellow'],[[1],[0,2],[1]]),{count:2,beam:true});
assert.equal(replay(['purple','yellow'],[[1],[0]]).count,1);
const b=Array(60).fill('white'),adj=Array.from({length:60},()=>[]);b[29]='red';b[30]='blue';b[59]='yellow';adj[29]=[30];adj[30]=[29,59];adj[59]=[30];assert.equal(replay(b,adj).count,2);
// Every generator checkpoint remains cancellable without exposing partial moves.
const cancel=fresh().solve(['red'],[[]],{hybrid:true,quickPlanMs:0,diagnosticSearch:false});assert.equal(cancel.next().value.phase,'beam-planning');assert(cancel.return().done);
const solved=fresh().solve(['white'],[[]],{hybrid:true,quickPlanMs:0});const end=solved.next();assert.equal(end.value,'solved');assert.equal(end.done,true);
console.log('PASS: primary mixing, secondary clearances, bit 29/30/59 boundaries, cooperative cancellation, and immutable inputs.');

// A bounded planner exhausting its options must not terminate the portfolio.
const exhaustedSource=source.replace('const legacyAttempt=variant=>solveAttempt(',"const legacyAttempt=variant=>(function*(){return 'unknown';})(");
const ctx={module:{exports:{}}};vm.runInNewContext(exhaustedSource,ctx);
const continued=ctx.module.exports.solve(['red','blue','yellow'],[[1],[0,2],[1]],{hybrid:true,diagnosticSearch:false});let next,transfers=0;while(!(next=continued.next()).done)if(next.value.type==='forward')transfers++;assert.equal(next.value,'solved');assert.equal(transfers,2);
console.log('PASS: an exhausted strategic lane leaves beam planning active.');

// Match the native offline ranking exactly, using BigInt only as a test oracle.
const hashContext={module:{exports:{}}};vm.runInNewContext(source.replace('return {solve,assess,exportProofCache,restoreProofCache}','return {solve,beamNoise,assess,exportProofCache,restoreProofCache}'),hashContext);
function reference(b,seed){const mask=(1n<<64n)-1n,mix=x=>x&mask;let h=0x9e3779b97f4a7c15n;for(let c=1;c<7;c++){let x=mix(BigInt(b[c*2])+(BigInt(b[c*2+1])<<30n)+h);x=mix((x^(x>>30n))*0xbf58476d1ce4e5b9n);x=mix((x^(x>>27n))*0x94d049bb133111ebn);h^=x^(x>>31n);}let x=h^mix(BigInt(seed)*0x9e3779b97f4a7c15n);x^=x>>33n;x=mix(x*0xff51afd7ed558ccdn);x^=x>>33n;return Number(x%1000000n)/1000000-.5;}
let random=971;for(let t=0;t<500;t++){const b=Array.from({length:14},()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random&0x3fffffff;});for(const seed of [1,2,3,4,57])assert.equal(hashContext.module.exports.beamNoise(b,seed),reference(b,seed));}console.log('PASS: exact offline 64-bit ranking parity for 2,500 boards/seeds.');

// Cancellation closes the nested portfolio once both retry lanes have started.
const raceContext={module:{exports:{}}};vm.runInNewContext(source.replace('return {solve,assess,exportProofCache,restoreProofCache}','return {solve,beamSolve,assess,exportProofCache,restoreProofCache}'),raceContext);
const race=raceContext.module.exports.beamSolve(['red'],[[]]),widths=new Set();
for(let i=0;i<2000&&widths.size<3;i++){const e=race.next();assert(!e.done);assert.equal(e.value.type,'search');const m=e.value.message?.match(/beam (\d+)/);if(m)widths.add(Number(m[1]));}
assert.deepEqual([...widths].sort((a,b)=>a-b),[64,256,512]);assert(race.return().done);assert(race.next().done);console.log('PASS: cooperative standard, wide, and varied retries cancel without partial playback.');
