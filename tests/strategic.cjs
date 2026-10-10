const assert=require('node:assert/strict'),{solve,assess}=require('../search.js');
const names=['white','red','blue','purple','yellow','orange','green'];
function run(board,adj,options={},solver=solve){
 let current=board.map(c=>typeof c==='number'?names[c]:c),events=[],searches=[],step;
 const initial=current.slice(),g=solver(current,adj,options);
 const groups=b=>b.map((_,i)=>{const seen=new Set([i]),q=[i];for(const x of q)for(const y of adj[x])if(b[y]===b[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;});
 let lastPlan=0,lastStep=0;
 while(!(step=g.next()).done){const e=step.value;
  if(e.type==='search'){assert.equal(events.length,0,'All planning must precede committed playback');searches.push(e);continue;}
  assert.equal(e.type,'forward','No speculative moves may be undone');
  assert.deepEqual(e.before,current);const before=current.map(c=>names.indexOf(c));
  const a=e.sourceIndex,b=e.targetIndex,reach=groups(before);
  assert(before[a]&&before[b]&&!(before[a]&before[b]));assert(reach[a].some(i=>adj[i].some(j=>reach[b].includes(j))));
  const next=before.slice(),mixed=before[a]|before[b];next[a]=0;next[b]=mixed===7?0:mixed;
  assert.deepEqual(e.after,next.map(c=>names[c]));assert(e.plan.verified);
  if(e.plan.id===lastPlan)assert.equal(e.plan.step,lastStep+1);else{
   if(events.length)assert.equal(events.at(-1).plan.step,events.at(-1).plan.total);
   assert.equal(e.plan.id,lastPlan+1);assert.equal(e.plan.step,1);
  }
  lastPlan=e.plan.id;lastStep=e.plan.step;events.push(e);current=e.after;
 }
 if(step.value==='solved')assert(current.every(c=>c==='white'));
 else{assert.equal(step.value,'unsolvable');assert.deepEqual(current,initial);assert.equal(events.length,0);}
 return {result:step.value,events,searches};
}
module.exports={run};
// A purple chain has a yellow connection at either end. Clearing the far
// endpoint with the near yellow severs the remaining pair from both supplies.
const chain=[4,3,3,3,4,4],chainAdj=[[1],[0,2],[1,3],[2,4],[3,5],[4]];
for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]){
 const board=chain.map(c=>[1,2,4].reduce((v,b,i)=>v|(c&b?bits[i]:0),0));
 const r=run(board,chainAdj);assert.equal(r.result,'solved');assert.equal(r.events.length,3);
 assert.equal(r.events[0].plan.kind,'clear-secondary');
 assert.deepEqual(r.events[0].plan.cells,[1,2,3]);
 assert.notDeepEqual([r.events[0].sourceIndex,r.events[0].targetIndex].sort(),[0,3]);
 assert(r.events.every(e=>e.plan.id===1),'The objective must persist until all members clear');
 const assigned=r.events[0].plan.resources.map(r=>r.tile);assert.equal(new Set(assigned).size,3);
}
// The bridge must actually be built with its own donor before any clearing.
const bridge=[3,1,2,4,4],bridgeAdj=[[1],[0,2,3],[1],[1,4],[3]];
const bridgePlan=run(bridge,bridgeAdj);assert.equal(bridgePlan.result,'solved');
assert.equal(bridgePlan.events[0].plan.kind,'clear-secondary');
assert.deepEqual(bridgePlan.events.map(e=>e.plan.id),[1,1,1]);
assert.deepEqual([bridgePlan.events[0].sourceIndex,bridgePlan.events[0].targetIndex],[2,1]);
assert.equal(bridgePlan.events[0].after[0],'purple');assert.equal(bridgePlan.events[0].after[1],'purple');
assert.equal(bridgePlan.events[1].after[1],'purple','Keep the sole yellow contact until the remote purple clears');
assert.deepEqual(bridgePlan.events[0].plan.resources.map(r=>r.role),['mix','clear','clear']);
assert.equal(new Set(bridgePlan.events[0].plan.resources.map(r=>r.tile)).size,3);
// A four-tile batch has one donor contact and one clearing contact. Build
// from the far end, preserve each contact until its whole job is finished.
const batch=[1,1,1,1,2,2,2,2,4,4,4,4],batchAdj=batch.map(()=>[]);
const link=(a,b)=>{batchAdj[a].push(b);batchAdj[b].push(a);};
for(const base of [0,4,8])for(let i=base;i<base+3;i++)link(i,i+1);link(0,4);link(7,8);
const batchPlan=run(batch,batchAdj);assert.equal(batchPlan.result,'solved');
assert.equal(batchPlan.events.length,8);assert(batchPlan.events.every(e=>e.plan.id===1));
assert([4,5,6,7].every(i=>batchPlan.events[3].after[i]==='purple'));
assert(batchPlan.events.slice(0,7).every(e=>e.after[7]!=='white'));
assert.equal(new Set(batchPlan.events[0].plan.resources.map(r=>r.tile)).size,8);
// Separate jobs cannot spend one another's materials. Both complete before
// any playback; plan identifiers and step counts remain contiguous.
const independent=run([1,2,4,1,2,4],[[1],[0,2],[1],[4],[3,5],[4]]);
assert.equal(independent.result,'solved');assert.equal(new Set(independent.events.map(e=>e.plan.id)).size,2);
// Budget exhaustion in ANY bounded planning stage retains complete fallback.
for(const options of [{strategyStates:0},{localStates:0},{layoutLimit:0},{planVariants:0}]){
 delete require.cache[require.resolve('../search.js')];
 const r=run(bridge,bridgeAdj,options,require('../search.js').solve);assert.equal(r.result,'solved');
 assert(r.events.every(e=>e.plan.kind==='verified-continuation'));
}
// Stop during a plan, then resume from its exact board without replanning.
const resume=solve(bridge.map(c=>names[c]),bridgeAdj);let first;
do{first=resume.next();}while(first.value.type==='search');
resume.return();const resumed=solve(first.value.after,bridgeAdj),second=resumed.next();
assert.equal(second.value.type,'forward');assert.equal(second.value.plan.id,first.value.plan.id);
assert.equal(second.value.plan.step,first.value.plan.step+1);resumed.return();
// Neither a manual color edit nor changed links can use that cached plan.
const edited=first.value.after.slice();edited[3]='blue';
assert.equal(run(edited,bridgeAdj).result,'unsolvable');
const disconnected=bridgeAdj.map(()=>[]);
assert.equal(run(first.value.after,disconnected).result,'unsolvable');
// The gateway screenshot must be decided by bridge resource allocation,
// without falling through to move-level enumeration or playing any move.
const gateway=require('./gateway-strategy.cjs');
for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]){
 const tiles=gateway.board.map(c=>names[[1,2,4].reduce((v,b,i)=>v|(names.indexOf(c)&b?bits[i]:0),0)]);
 const proof=run(tiles,gateway.adj);assert.equal(proof.result,'unsolvable');
 assert(proof.searches.length>0);assert(proof.searches.every(e=>e.phase==='funding'));
 assert(proof.searches.length<200,'This is a bounded layout proof, not exhaustive board search');
}
// Existing strategic proof fixtures: failure is silent, never trial playback.
for(const name of ['single-anchor','single-gate']){
 const {board,adj}=require(`./${name}.cjs`);const r=run(board,adj);assert.equal(r.result,'unsolvable');
}
// Independent resource conflict and bypass: matching is not allowed to spend
// the same complement twice, but additional access must remain available.
const competition=[3,3,4,6,1,4],competitionAdj=[[2],[2],[0,1,3],[2,4,5],[3],[3]];
assert.equal(run(competition,competitionAdj).result,'unsolvable');
// True historical mistakes are the sole source of undo events.
const old=require('./bottleneck.cjs'),history=old.good.map(c=>names[c]);
const g=solve(old.after.map(c=>names[c]),old.adj,{history:[{tiles:history}]});
const undo=g.next();assert.equal(undo.value.type,'backtrack');assert.equal(undo.value.reason,'proved-unsolvable');
assert.deepEqual(undo.value.before,history);let step,forward=false;
while(!(step=g.next()).done){if(step.value.type==='forward'){forward=true;assert(step.value.plan.verified);}assert.notEqual(step.value.type,'backtrack');}
assert.equal(step.value,'solved');assert(forward);
// Closing a planning generator abandons work without modifying caller state.
const difficult=require('./purple-strategy.cjs'),snapshot=difficult.board.slice();
const cancel=solve(difficult.board,difficult.adj);assert.equal(cancel.next().value.type,'search');
cancel.return();assert.equal(cancel.next().done,true);assert.deepEqual(difficult.board,snapshot);
for(const key of ['strategyStates','localStates','layoutLimit','planVariants','bridgeStates'])assert.throws(()=>solve(['red'],[[]],{[key]:-1}).next(),RangeError);
console.log('Passed persistent whole-group plans, funded bridge construction, distinct supplies, silent fallback, history recovery, color permutations, and cancellation.');
