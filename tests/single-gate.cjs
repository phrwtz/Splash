const assert=require('node:assert/strict'),{assess,solve}=require('../search.js');
const {adj}=require('./bottleneck.cjs');
const names=['white','red','blue','purple','yellow','orange','green'];
const board=['...YYRB.','..BYYB.','.RRRYBY.','RBYBYY.','RRBBR...','BBR....','YYBYBRR.','YBRR...']
 .join('').split('').map(c=>({'.':0,R:1,B:2,Y:4}[c]));
module.exports={board:board.map(c=>names[c]),adj};
if(require.main===module){
 for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]){
  const tiles=board.map(c=>names[[1,2,4].reduce((v,b,i)=>v|(c&b?bits[i]:0),0)]);
  const result=assess(tiles,adj);
  assert.equal(result.reason.type,'single-gate-shortage');
  assert.deepEqual(result.reason.tiles,[50,51]);assert.equal(result.reason.gate,49);
  assert.deepEqual(solve(tiles,adj).next(),{value:'unsolvable',done:true});
 }
 console.log('Passed immediate single-gate shortage under every primary-color permutation.');
}
