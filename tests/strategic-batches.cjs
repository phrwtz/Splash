const assert=require('node:assert/strict'),{solve,assess}=require('../search.js');
const board=[],adj=[];
for(let i=0;i<7;i++){const n=board.length;board.push('red','blue','yellow');adj.push([n+1],[n,n+2],[n+1]);}
const g=solve(board,adj,{strategyOnly:true,batchGroups:6});let s,current=board.slice(),batches=[],forward=0,plannedAfterPlayback=false;
while(!(s=g.next()).done){const e=s.value;
 assert(!['verification','exploration'].includes(e.phase));assert.notEqual(e.type,'exhaustive-required');
 if(e.type==='search'){if(forward)plannedAfterPlayback=true;continue;}
 if(e.type==='batch-ready'){batches.push(e);continue;}
 assert.equal(e.type,'forward');assert.deepEqual(e.before,current);assert.equal(e.plan.kind,'clear-secondary');
 assert(e.plan.verified);current=e.after;forward++;
 if(forward===12){assert.equal(current.filter(c=>c!=='white').length,3);assert.equal(assess(current,adj).unsolvable,false);assert.equal(e.plan.continuationVerified,false);}
}
assert.equal(s.value,'solved');assert.deepEqual(batches.map(b=>b.groupsCleared),[6,1]);assert.deepEqual(batches.map(b=>b.complete),[false,true]);assert(plannedAfterPlayback);assert.equal(forward,14);
// Stop partway through an approved batch; resume on the actual position.
let h=solve(board,adj,{strategyOnly:true,batchGroups:6}),e;
do{e=h.next();}while(e.value.type!=='forward');h.return();
const resumed=solve(e.value.after,adj,{strategyOnly:true,batchGroups:6,history:[{tiles:e.value.before}]});
let before=e.value.after;
while(!(s=resumed.next()).done){if(s.value.type==='forward'){assert.deepEqual(s.value.before,before);before=s.value.after;}}
assert.equal(s.value,'solved');assert(before.every(c=>c==='white'));
for(const fixture of ['green-exit','eight-pocket']){const f=require(`./${fixture}.cjs`);assert.deepEqual(solve(f.board,f.adj,{strategyOnly:true,batchGroups:6}).next(),{done:true,value:'unsolvable'});}
console.log('Passed six-group partial playback, checked remainder, return to planning, mid-batch Stop/resume, and structural rejection.');
