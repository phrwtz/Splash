const assert=require('node:assert/strict'),{solve}=require('../search.js');
const board=['purple','red','blue','yellow','yellow'],adj=[[1],[0,2,3],[1],[1,4],[3]];
// A cached exact solution cannot bypass strategic-only policy.
let g=solve(board,adj,{strategyStates:0}),s;while(!(s=g.next()).done){}assert.equal(s.value,'solved');
g=solve(board,adj,{strategyOnly:true,stopBeforeExhaustive:true,strategyStates:0,localStates:0,layoutLimit:0,planVariants:0});
let passes=0,moves=0;
while(!(s=g.next()).done){const e=s.value;
 assert.notEqual(e.type,'exhaustive-required');assert(!['verification','exploration'].includes(e.phase));
 if(e.strategyPass)passes++;
 if(e.type==='forward'){moves++;assert.equal(e.plan.kind,'clear-secondary');assert(e.plan.verified);}
}
assert.equal(s.value,'solved');assert(passes>0);assert.equal(moves,3);
// Unknown strategic runs keep yielding cooperatively and can be cancelled.
const fixture=require('./purple-strategy.cjs');
g=solve(fixture.board,fixture.adj,{strategyOnly:true,strategyStates:16,localStates:8,layoutLimit:2,planVariants:1});
let widened=false;
for(let i=0;i<300;i++){s=g.next();assert(!s.done);assert.equal(s.value.type,'search');assert(!['verification','exploration'].includes(s.value.phase));if(s.value.strategyPass>=3){widened=true;break;}}
assert(widened);g.return();
for(const name of ['green-exit','eight-pocket']){const f=require(`./${name}.cjs`);assert.deepEqual(solve(f.board,f.adj,{strategyOnly:true}).next(),{done:true,value:'unsolvable'});}
console.log('Passed strategy-only widening to a verified solution, rejection of exact cached paths, cooperative cancellation, and structural proofs.');
