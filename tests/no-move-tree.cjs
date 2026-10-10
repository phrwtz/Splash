const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Fail immediately if any exact search is entered, even before it yields.
const source=fs.readFileSync(require.resolve('../search.js'),'utf8').replace('function* exact(b,budget=null) {',"function* exact(b,budget=null) { throw new Error('Entered exact search');");
const ctx={module:{exports:{}}};vm.runInNewContext(source,ctx);const {solve}=ctx.module.exports;
const tiles=['red','blue','yellow'],adj=[[1],[0,2],[1]],snapshot=tiles.slice();
const g=solve(tiles,adj,{moveTreeSearch:false,strategyStates:0,localStates:0,layoutLimit:0,planVariants:0,stopBeforeExhaustive:true});
let s,moves=0,passes=0;
while(!(s=g.next()).done){const e=s.value;assert(!['verification','exploration','section-endgame','endgame-check'].includes(e.phase));assert.notEqual(e.type,'exhaustive-required');if(e.strategyPass)passes++;if(e.type==='forward'){moves++;assert.equal(e.plan.kind,'clear-secondary');}}
assert.equal(s.value,'solved');assert.equal(moves,2);assert(passes);assert.deepEqual(tiles,snapshot);
for(const fixture of ['early-endgame','early-endgame-two']){
 const {board,adj}=require('./'+fixture+'.cjs'),original=board.slice();
 const g=solve(board,adj,{moveTreeSearch:false,strategyStates:1,sectionStates:1,localStates:0,layoutLimit:0,sectionRestarts:0,stopBeforeExhaustive:true});let widened=false;
 for(let i=0;i<100;i++){const s=g.next();assert(!s.done);const e=s.value;assert.equal(e.type,'search');assert(!['verification','exploration','section-endgame','endgame-check'].includes(e.phase));if(e.strategyPass>=3){widened=true;break;}}
 assert(widened);g.return();assert.deepEqual(board,original);
}
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
assert.equal((app.match(/strategyOnly: true, moveTreeSearch: false, batchGroups: 6/g)||[]).length,2,'Live and prefetched Auto Play must disable trees');
assert.match(app,/AUTO_PLAY_SEARCH_MS = 5 \* 60 \* 1000/);
console.log('Passed no exact search, strategic widening, legal completion, cancellation, live/prefetch policy, and five-minute deadline.');
