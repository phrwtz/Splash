// Optional bounded runs of historical screenshots. "unknown" is reported as
// inconclusive, never counted as a solution or an impossibility proof.
const assert=require('node:assert/strict'),{solve}=require('../search.js');
function verifyFixture(board,adj,{milliseconds=2000,expected}={}){
 const snapshot=board.slice(),start=Date.now(),search=solve(board,adj);let step,events=0,last=null;
 while(!(step=search.next()).done){const e=step.value;
  if(e.type==='search'){
   assert.equal(events,0,'Planning cannot interrupt a committed continuation');last=e;
   if(Date.now()-start>=milliseconds){search.return();assert.deepEqual(board,snapshot);
    console.log(JSON.stringify({result:'unknown',elapsedMs:Date.now()-start,positions:e.positions,plansTried:e.plansTried,visibleMoves:0}));return 'unknown';}
  }else{assert.equal(e.type,'forward');assert(e.plan.verified);events++;}
 }
 assert.deepEqual(board,snapshot);if(expected)assert.equal(step.value,expected);
 if(step.value==='unsolvable')assert.equal(events,0);
 console.log(JSON.stringify({result:step.value,elapsedMs:Date.now()-start,positions:last?.positions||0,plansTried:last?.plansTried||0,visibleMoves:events}));
 return step.value;
}
module.exports={verifyFixture};
if(require.main===module)for(const fixture of ['purple-strategy','yellow-bridge','batch-clear','green-bridge','pocket-priority']){
 console.log(fixture);const {board,adj}=require(`./${fixture}.cjs`);verifyFixture(board,adj);
}
