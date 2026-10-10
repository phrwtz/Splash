const assert=require('node:assert/strict');
const {assess,solve}=require('../search.js');
const names=['white','red','blue','purple','yellow','orange','green'];
// Independent exhaustive legal-move oracle, with no strategic pruning.
function oracle(b,a,memo=new Map()){
 const key=b.join('');if(memo.has(key))return memo.get(key);if(b.every(c=>!c))return true;
 const reach=i=>{const seen=new Set([i]),q=[i];for(const x of q)for(const y of a[x])if(b[y]===b[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;};
 for(let i=0;i<b.length;i++)for(let j=0;j<b.length;j++)if(b[i]&&b[j]&&!(b[i]&b[j])&&reach(i).some(x=>reach(j).some(y=>a[x].includes(y)))){
  const next=b.slice();next[i]=0;next[j]=(b[i]|b[j])===7?0:b[i]|b[j];
  if(oracle(next,a,memo)){memo.set(key,true);return true;}
 }
 memo.set(key,false);return false;
}
const board=[6,3,5,1,2,4,1,2,4,1,2,4];
const adj=[[7,11],[8],[3],[2,7,8,10],[6],[7],[4,9],[0,3,5,11],[1,3,10,11],[6,11],[3,8],[0,7,8,9]];
const bypass=adj.map(a=>a.slice());bypass[4].push(2);bypass[2].push(4);
assert.equal(oracle(board,adj),false);assert.equal(oracle(board,bypass),true);
for(const perm of [[1,2,4],[1,4,2],[2,1,4],[2,4,1],[4,1,2],[4,2,1]]){
 const tiles=board.map(c=>names[[1,2,4].reduce((v,bit,i)=>v|(c&bit?perm[i]:0),0)]);
 // Earlier pocket proofs can now detect the same resource obstruction.
 assert(['shared-complement-shortage','pocket-supply-conflict'].includes(assess(tiles,adj).reason.type));
 assert.deepEqual(solve(tiles,adj).next(),{done:true,value:'unsolvable'});
 assert.equal(assess(tiles,bypass).unsolvable,false);
 let step;const search=solve(tiles,bypass);while(!(step=search.next()).done){}
 assert.equal(step.value,'solved');
}
// A donor may travel through a reserved member of its original blob.
const transfer=[1,5,0,3,2,6,0,4,1,0,2,4];
const transferAdj=[[1,3,4,8],[0,9,10,11],[3,4,7,9,11],[0,2,7,10],[0,2,5,6,10],[4,6],[4,5,7,8,10],[2,3,6],[0,6,10],[1,2],[1,3,4,6,8,11],[1,2,10]];
assert.equal(oracle(transfer,transferAdj),true);
assert.equal(assess(transfer.map(c=>names[c]),transferAdj).unsolvable,false);
console.log('Passed future bridge obligations, solvable bypass under all colors, and transfer through a reserved blob cell.');

let seed=95713,strategicRejections=0;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let trial=0;trial<300;trial++){
 const b=[6,6,1,1,1,1,2,2,4,4],a=b.map(()=>[]);
 for(let i=0;i<b.length;i++)for(let j=0;j<i;j++)if(random()<.27){a[i].push(j);a[j].push(i);}
 const expected=oracle(b,a),verdict=assess(b.map(c=>names[c]),a);
 if(verdict.reason?.type==='bridge-layout-conflict')strategicRejections++;
 if(verdict.unsolvable)assert.equal(expected,false,JSON.stringify({b,a,verdict}));
 let step;const search=solve(b.map(c=>names[c]),a);while(!(step=search.next()).done){}
 assert.equal(step.value==='solved',expected,JSON.stringify({b,a}));
}
console.log(`Passed 300 independent mixed-graph strategy comparisons (${strategicRejections} bridge-layout proofs).`);

// Two reds share one blue gate. A second yellow in the linked donor blob
// supplies a real bypass, so the single-donor rule must not reject it.
const gateBoard=[1,1,2,4,2,4],gateAdj=[[1,2],[0],[0,3],[2,4],[3,5],[4]];
const gateBypass=gateAdj.map(a=>a.slice());gateBypass[3].push(5);gateBypass[5].push(3);
assert.equal(oracle(gateBoard,gateAdj),false);
assert.equal(assess(gateBoard.map(c=>names[c]),gateAdj).unsolvable,true);
assert.equal(oracle(gateBoard,gateBypass),true);
assert.equal(assess(gateBoard.map(c=>names[c]),gateBypass).unsolvable,false);
let gateStep;const gateSearch=solve(gateBoard.map(c=>names[c]),gateBypass);
while(!(gateStep=gateSearch.next()).done){}
assert.equal(gateStep.value,'solved');
console.log('Passed independent single-gate obstruction and solvable two-donor bypass.');
