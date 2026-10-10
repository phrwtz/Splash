// October 1 screenshot: one orange anchor still needs a funded clearing bridge.
const assert=require('node:assert/strict'),{assess,solve}=require('../search.js');
const {adj}=require('./bottleneck.cjs');
const names=['white','red','blue','purple','yellow','orange','green'];
const rows=['........','.RO....','BRGG....','.RY....','..RBR...',
 '.YBBBOY','..RBBRY.','..Y.YRB'];
const board=rows.join('').split('').map(c=>({'.':0,R:1,B:2,Y:4,O:5,G:6}[c]));
module.exports={board:board.map(c=>names[c]),adj};
if(require.main===module){
 assert.equal(board.length,60);assert.equal(board.filter(Boolean).length,26);
 for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]){
  const tiles=board.map(c=>names[[1,2,4].reduce((v,b,i)=>v|(c&b?bits[i]:0),0)]);
  const result=assess(tiles,adj);
  assert.equal(result.reason.type,'bridge-layout-conflict');
  assert.equal(result.reason.color,names[bits[0]|bits[2]]);
  assert(result.reason.tiles.includes(10));
  for(const lookaheadStates of [0,4000])
   assert.deepEqual(solve(tiles,adj,{lookaheadStates}).next(),{value:'unsolvable',done:true});
 }
 console.log('Passed single-anchor screenshot rejection without search or animation under all six color permutations.');
}
