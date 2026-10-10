const assert=require('node:assert/strict'),{assess,solve}=require('../search.js');
const {adj}=require('./bottleneck.cjs'),names=['white','red','blue','purple','yellow','orange','green'];
const board=['BRYRB...','YRBYR..','RBRRR.Y.','B...BB.','....YYYB','....RBY','.....YYR','......B'].join('').split('').map(c=>({'.':'white',R:'red',Y:'yellow',B:'blue'}[c]));
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
 const local=[1,1,1,2,2,2,4,4,4],graph=[[1],[0,2,3],[1,4],[1],[2,6],[6],[4,5,7],[6,8],[7]];
 const bypass=graph.map(g=>g.slice());bypass[0].push(6);bypass[6].push(0);
 assert.equal(oracle(local,graph),false);assert.equal(oracle(local,bypass),true);
 for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]){
  const permute=c=>[1,2,4].reduce((v,b,i)=>v|(c&b?bits[i]:0),0);
  const tiles=board.map(c=>names[permute(names.indexOf(c))]);
  const reason=assess(tiles,adj).reason;assert.equal(reason.type,'narrow-connection-capacity');
  assert.deepEqual(reason.connection,[19,27]);assert.equal(reason.required,3);assert.equal(reason.available,2);
  assert.deepEqual(solve(tiles,adj,{strategyOnly:true,batchGroups:6}).next(),{done:true,value:'unsolvable'});
  const miniature=local.map(c=>names[permute(c)]);
  assert.equal(assess(miniature,graph).unsolvable,true);assert.equal(assess(miniature,bypass).unsolvable,false);
  const g=solve(miniature,bypass,{strategyOnly:true,batchGroups:6});let s;while(!(s=g.next()).done){}assert.equal(s.value,'solved');
 }
 // Isolate the actual cut rule so earlier proofs cannot mask an error in it.
 const fs=require('node:fs'),vm=require('node:vm'),context={module:{exports:{}}};
 const source=fs.readFileSync(require.resolve('../search.js'),'utf8').replace('return {solve,assess};',
  'return {cut:(tiles,a)=>{const b=tiles.map(c=>masks[c]);return narrowConnectionReason(b,a,blobs(b,a));}};');
 vm.runInNewContext(source,context);const cut=context.module.exports.cut;
 let seed=5711,proofs=0;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let k=0;k<1500;k++){
  const b=local.slice();if(k%2)for(let i=b.length-1;i>0;i--){const j=rand(i+1);[b[i],b[j]]=[b[j],b[i]];}
  const a=k%2?b.map(()=>[]):graph.map(g=>g.slice());
  // Connected regions with exactly one inter-region edge.
  if(k%2)for(const [lo,hi] of [[0,4],[4,9]]){
   for(let i=lo;i<hi;i++)for(let j=i+1;j<hi;j++)if(j===i+1||rand(3)===0){a[i].push(j);a[j].push(i);}
  }
  if(k%2){const x=rand(4),y=4+rand(5);a[x].push(y);a[y].push(x);}else{
   for(let i=4;i<9;i++)for(let j=i+1;j<9;j++)if(!a[i].includes(j)&&rand(3)===0){a[i].push(j);a[j].push(i);}
  }
  if(cut(b.map(c=>names[c]),a)){assert.equal(oracle(b,a),false);proofs++;}
 }
 assert(proofs>100);console.log(`Passed narrow-connection screenshot, six permutations, independent proof/bypass and ${proofs} sound cut-capacity proofs on 1,500 balanced graphs.`);
}
