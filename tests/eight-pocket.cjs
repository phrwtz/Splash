const assert=require('node:assert/strict'),{assess,solve}=require('../search.js');
const {adj}=require('./bottleneck.cjs'),names=['white','red','blue','purple','yellow','orange','green'];
const rows=['.....BB.','.....RY','Y....OPP','B.....R','BY...RB.','BYRBRY.','.YRBYPY.','..YRY..'];
const board=rows.join('').split('').map(c=>({'.':'white',R:'red',B:'blue',Y:'yellow',P:'purple',O:'orange'}[c]));
module.exports={board,adj};
function oracle(b,a,memo=new Map()){
 const key=b.join('');if(memo.has(key))return memo.get(key);if(b.every(c=>!c))return true;
 const blob=i=>{const q=[i],seen=new Set(q);for(const x of q)for(const y of a[x])if(b[y]===b[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;};
 for(let i=0;i<b.length;i++)for(let j=0;j<b.length;j++)if(b[i]&&b[j]&&!(b[i]&b[j])&&blob(i).some(x=>blob(j).some(y=>a[x].includes(y)))){
  const next=b.slice();next[i]=0;next[j]=(b[i]|b[j])===7?0:b[i]|b[j];
  if(oracle(next,a,memo)){memo.set(key,true);return true;}
 }memo.set(key,false);return false;
}
if(require.main===module){
 const local=[2,2,1,4,5,3,3,1,2,4,4,4];
 const graph=[[1,2],[0,2,3],[0,1,3,4,5],[1,2,5,6],[2,5],[2,3,4,6,7],[3,5,7],[5,6,8],[7,9],[8,10],[9,11],[10]];
 const bypass=graph.map(g=>g.slice());bypass[3].push(9);bypass[9].push(3);
 assert.equal(oracle(local,graph),false);assert.equal(oracle(local,bypass),true);
 for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]){
  const permute=c=>[1,2,4].reduce((v,b,i)=>v|(c&b?bits[i]:0),0);
  const tiles=board.map(c=>names[permute(names.indexOf(c))]);
  const result=assess(tiles,adj);assert.equal(result.reason.type,'pocket-supply-conflict');
  assert.equal(result.reason.exit,36);assert.deepEqual(result.reason.tiles,[5,6,13,14,20,21,22,29]);
  for(const progressive of [false,true])assert.deepEqual(solve(tiles,adj,{progressive}).next(),{done:true,value:'unsolvable'});
  const miniature=local.map(c=>names[permute(c)]);
  assert.equal(assess(miniature,graph).unsolvable,true);
  assert.equal(assess(miniature,bypass).unsolvable,false);
  const g=solve(miniature,bypass,{progressive:true});let s;while(!(s=g.next()).done){}assert.equal(s.value,'solved');
 }
 console.log('Passed eight-tile screenshot proof with no search/animation, six color permutations, independent oracle, and solvable bypass.');
}
