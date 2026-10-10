const assert=require('node:assert/strict'),{assess,solve}=require('../search.js');
const {adj}=require('./bottleneck.cjs'),names=['white','red','blue','purple','yellow','orange','green'];
const board=['........','.....Y.','..B...Y.','..R..Y.','.BR...R.','.BRBBR.','B.YBY.Y.','RBRYRY.'].join('').split('').map(c=>({'.':'white',R:'red',Y:'yellow',B:'blue'}[c]));
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
 const local=[4,4,4,1,1,2,2,2,1],graph=[[1],[0,2],[1,3],[2,4],[3,6],[6,7,8],[4,5],[5],[5]];
 const bypass=graph.map(g=>g.slice());bypass[6].push(8);bypass[8].push(6);
 assert.equal(oracle(local,graph),false);assert.equal(oracle(local,bypass),true);
 for(const bits of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]){
  const permute=c=>[1,2,4].reduce((v,b,i)=>v|(c&b?bits[i]:0),0);
  const tiles=board.map(c=>names[permute(names.indexOf(c))]);
  const reason=assess(tiles,adj).reason;assert.equal(reason.type,'primary-gate-ordering');
  assert.deepEqual(reason.tiles,[13,21,28]);assert.equal(reason.gate,36);
  assert.deepEqual(solve(tiles,adj,{strategyOnly:true,batchGroups:6}).next(),{done:true,value:'unsolvable'});
  const miniature=local.map(c=>names[permute(c)]);
  assert.equal(assess(miniature,graph).unsolvable,true);assert.equal(assess(miniature,bypass).unsolvable,false);
  const g=solve(miniature,bypass,{strategyOnly:true,batchGroups:6});let s;while(!(s=g.next()).done){}assert.equal(s.value,'solved');
 }
 // A secondary bridge extending outside the checked cells can receive a
 // local primary without consuming its local contact; this escape is legal.
 const outsideBridge=[2,4,3,5,4,2,1,6,1];
 const outsideGraph=[[3,4],[2,3],[1,3,4],[0,1,2],[0,2,5],[4,7,8],[8],[5],[5,6]];
 assert.equal(oracle(outsideBridge,outsideGraph),true);
 assert.equal(assess(outsideBridge.map(c=>names[c]),outsideGraph).unsolvable,false);
 // Exercise the real local rule independently of earlier proof priorities.
 const fs=require('node:fs'),vm=require('node:vm'),context={module:{exports:{}}};
 const source=fs.readFileSync(require.resolve('../search.js'),'utf8').replace('return {solve,assess};',
 'return {gate:(tiles,a)=>{const b=tiles.map(c=>masks[c]),bs=blobs(b,a);return primaryGateOrderingReason(b,a,bs,secondaryRegions(b,a,bs));}};');
 vm.runInNewContext(source,context);const gate=context.module.exports.gate;
 let seed=8181,proofs=0;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let k=0;k<600;k++){
  const b=local.slice();if(k%2)for(let i=8;i>0;i--){const j=rand(i+1);[b[i],b[j]]=[b[j],b[i]];}
  const a=k%2?b.map(()=>[]):graph.map(g=>g.slice());
  for(let i=k%2?0:3;i<9;i++)for(let j=i+1;j<9;j++)if(!a[i].includes(j)&&rand(6)===0){a[i].push(j);a[j].push(i);}
  if(gate(b.map(c=>names[c]),a)){assert.equal(oracle(b,a),false);proofs++;}
 }
 assert(proofs>30);console.log(`Passed top-yellow screenshot, six permutations, independent ordering obstruction/solvable contact, and ${proofs} sound local proofs on 600 balanced graphs.`);
}
