const assert=require('node:assert/strict');
const api=require('../search.js'),{solve}=api;
const rows=['BBYBYBYR','BRBYBBR','RBYBRYYY','BYYRBYB','BYBBRRBB','RRRBBYY','YYYRYRRR','RRRYRYR'];
const board=rows.join('').split('').map(c=>({R:'red',B:'blue',Y:'yellow'}[c]));
const {adj}=require('./oct13-board.cjs');
const options={moveTreeSearch:true,strategyStates:0,sectionStates:0,bridgeStates:0,failedCacheEntries:128};
let g=solve(board,adj,options),s,last;
while(!(s=g.next()).done){last=s.value;if(last.proofStats?.failedEvictions>0&&last.proofProgress?.total)break;}
assert(!s.done);assert(last.proofProgress.completed<=last.proofProgress.total);assert(last.proofProgress.depth>0);assert.equal(last.proofProgress.total,888);assert(last.proofStats.failedEvictions>0);g.return();
const snapshot=structuredClone(api.exportProofCache());assert(snapshot.keys.length>0);
const fs=require('node:fs'),vm=require('node:vm'),ctx={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(require.resolve('../search.js'),'utf8'),ctx);
const worker=ctx.module.exports;worker.restoreProofCache(snapshot);
const resume=worker.solve(board,adj,options);
assert.equal(resume.next().value.phase,'verification','Offline proof resumes without an Auto Play search');resume.return();
let restored=worker.solve(board,adj,options);while(!(s=restored.next()).done){if(s.value.proofStats){assert.equal(s.value.proofStats.retainedFailures,snapshot.keys.length);break;}}assert(!s.done);restored.return();
g=solve(board,adj,options);while(!(s=g.next()).done){if(s.value.proofStats){assert(s.value.proofStats.retainedFailures>0);break;}}assert(!s.done);g.return();
// Graph identity is required before any retained proof can be reused.
const other=adj.map(()=>[]);g=solve(board,other,options);while(!(s=g.next()).done){if(s.value.proofStats)assert.equal(s.value.proofStats.retainedFailures,0);}assert.equal(s.value,'unsolvable');
// A concluded run must release retained proof memory.
g=solve(board,adj,options);while(!(s=g.next()).done){if(s.value.proofStats){assert.equal(s.value.proofStats.retainedFailures,0);break;}}g.return();
console.log('Passed branch progress, bounded-cache eviction reporting, Stop/Start proof retention, graph isolation, and completed-search cleanup.');
