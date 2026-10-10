const assert=require('node:assert/strict'),{solve}=require('../search.js');
const {adj}=require('./bottleneck.cjs'),names=['white','red','blue','purple','yellow','orange','green'];
const board=['........','....R..','...RYR..','..YRY..','...Y.RR.','..B.GBB','...Y.RY.','..BBBOB'].join('').split('').map(c=>({'.':'white',R:'red',Y:'yellow',B:'blue',G:'green',O:'orange'}[c]));
module.exports={board,adj};
if(require.main===module){
 for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]){
  const tiles=board.map(c=>names[[1,2,4].reduce((v,b,i)=>v|(names.indexOf(c)&b?bits[i]:0),0)]);
  const snapshot=tiles.slice(),g=solve(tiles,adj,{progressive:true});let s,last;
  while(!(s=g.next()).done){assert.equal(s.value.type,'search','Short dead branches must never animate');last=s.value;assert(last.positions<10000,'This proof must remain bounded');}
  assert.equal(s.value,'unsolvable');assert.deepEqual(tiles,snapshot);
 }
 console.log('Passed rapid-retraction screenshot: bounded silent proof, no forward or undo events, all six color permutations.');
}
