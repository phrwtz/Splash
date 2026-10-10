const assert=require('node:assert/strict'),{solve,assess}=require('../search.js');
const {adj}=require('./bottleneck.cjs'),names=['white','red','blue','purple','yellow','orange','green'];
const board=['........','B......','.YB.....','YRB....','BYRYBY..','...R.YR','....BR..','...R...'].join('').split('').map(c=>({'.':'white',R:'red',Y:'yellow',B:'blue'}[c]));
const secondBoard=['..YBB...','.Y..B.R','..R..BYB','..YRRYB','..R...R.','.....Y.','........','.......'].join('').split('').map(c=>({'.':'white',R:'red',Y:'yellow',B:'blue'}[c]));
module.exports={board,secondBoard,adj};
if(require.main===module){
 assert.equal(board.filter(c=>c!=='white').length,18);assert.equal(assess(board,adj).unsolvable,false);
 for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]){
  const tiles=board.map(c=>names[[1,2,4].reduce((v,b,i)=>v|(names.indexOf(c)&b?bits[i]:0),0)]);
  const g=solve(tiles,adj,{strategyOnly:true,batchGroups:6});let s,proof=false;
  while(!(s=g.next()).done){assert.equal(s.value.type,'search','Impossible remainder must not animate');assert(!['verification','exploration'].includes(s.value.phase));if(s.value.proofResult==='unsolvable')proof=true;}
  assert.equal(s.value,'unsolvable');assert(proof);
 }
 // The second screenshot outgrew the old allowance and triggered widening.
 assert.equal(secondBoard.filter(c=>c!=='white').length,18);
 assert.equal(assess(secondBoard,adj).unsolvable,false);
 const old=solve(secondBoard,adj,{strategyOnly:true,batchGroups:6,proofStates:2048});
 for(;;){const step=old.next();assert(!step.done);if(step.value.proofResult){assert.equal(step.value.proofResult,'unknown');break;}}old.return();
 const validated=solve(secondBoard,adj,{strategyOnly:true,batchGroups:6});let validation,checks=0;
 while(!(validation=validated.next()).done){assert.equal(validation.value.type,'search');assert.equal(validation.value.phase,'endgame-check');checks=validation.value.positions;}
 assert.equal(validation.value,'unsolvable');assert(checks>2048&&checks<=16384);
 // An otherwise acceptable strategic clearance leads exactly to this board.
 // It must fail validation before the clearance batch is ever emitted.
 for(const remainder of [board,secondBoard]){
 const predecessor=remainder.slice();predecessor[0]='purple';predecessor[1]='yellow';
 assert.equal(assess(predecessor,adj).unsolvable,false);
 const g=solve(predecessor,adj,{strategyOnly:true,batchGroups:1,proofTiles:18});let rejected=false;
 for(let i=0;i<1000;i++){const s=g.next();assert(!s.done);assert.equal(s.value.type,'search');if(s.value.proofResult==='unsolvable'){rejected=true;break;}}
 assert(rejected);g.return();
 }
 // An exhausted proof is unknown; strategic planning remains available.
 const easy=['red','blue','yellow'];const simple=[[1],[0,2],[1]];
 const h=solve(easy,simple,{strategyOnly:true,batchGroups:6,proofStates:1});let s,unknown=false;
 while(!(s=h.next()).done){if(s.value.proofResult==='unknown')unknown=true;if(s.value.type==='forward')assert.equal(s.value.plan.kind,'clear-secondary');}
 assert(unknown);assert.equal(s.value,'solved');
 console.log('Passed both bounded 18-tile proofs, six color permutations, rejection before batch playback, and unknown-proof strategic fallback.');
}
