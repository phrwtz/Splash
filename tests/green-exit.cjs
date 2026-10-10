const assert=require('node:assert/strict'),{assess,solve}=require('../search.js');
const {adj}=require('./bottleneck.cjs'),names=['white','red','blue','purple','yellow','orange','green'];
const board=['...YYBY.','...BY.B','....Y.YO','RR..RYY','.RGBOBR.','...YRBR','...RBYPB','...BBPR'].join('').split('').map(c=>({'.':'white',R:'red',Y:'yellow',B:'blue',G:'green',O:'orange',P:'purple'}[c]));
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
 const local=[1,1,1,6,2,4,2,4],graph=[[1],[0,2],[1,3],[2,4],[3,5],[4,6],[5,7],[6]];
 const bypass=graph.map(g=>g.slice());bypass[4].push(7);bypass[7].push(4);
 assert.equal(oracle(local,graph),false);assert.equal(oracle(local,bypass),true);
 for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]){
  const permute=c=>[1,2,4].reduce((v,b,i)=>v|(c&b?bits[i]:0),0);
  const tiles=board.map(c=>names[permute(names.indexOf(c))]);
  const reason=assess(tiles,adj).reason;assert.equal(reason.type,'secondary-arm-capacity');
  assert.equal(reason.gate,32);assert.deepEqual(reason.tiles,[23,24,31]);assert.equal(reason.available,2);assert.equal(reason.required,3);
  for(const progressive of [false,true])assert.deepEqual(solve(tiles,adj,{progressive}).next(),{done:true,value:'unsolvable'});
  const miniature=local.map(c=>names[permute(c)]);
  assert.equal(assess(miniature,graph).unsolvable,true);assert.equal(assess(miniature,bypass).unsolvable,false);
  const g=solve(miniature,bypass,{progressive:true});let s;while(!(s=g.next()).done){}assert.equal(s.value,'solved');
 }
 // Independent balanced random graphs guard against false capacity proofs.
 let seed=3941,checked=0;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let k=0;k<1000;k++){
  const b=local.slice();if(k%2)for(let i=b.length-1;i>0;i--){const j=rand(i+1);[b[i],b[j]]=[b[j],b[i]];}
  const a=k%2?b.map(()=>[]):graph.map(g=>g.slice());
  for(let i=k%2?0:4;i<b.length;i++)for(let j=i+1;j<b.length;j++)if(!a[i].includes(j)&&rand(3)===0){a[i].push(j);a[j].push(i);}
  const result=assess(b.map(c=>names[c]),a);if(result.reason?.type==='secondary-arm-capacity'){assert.equal(oracle(b,a),false);checked++;}
 }
 assert(checked>100,'Exercise many distinct capacity proofs');
 console.log(`Passed green-exit screenshot with zero search/animation, six permutations, independent obstruction/bypass, and ${checked} capacity proofs on 1,000 balanced graphs.`);
}
