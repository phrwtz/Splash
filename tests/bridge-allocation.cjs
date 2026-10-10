const assert=require('node:assert/strict');
const names=['white','red','blue','purple','yellow','orange','green'];
// Independent game oracle: only legal transfers and exhaustive enumeration.
function oracle(b,adj,memo=new Map()){
 const key=b.join('');if(memo.has(key))return memo.get(key);if(b.every(c=>!c))return true;
 const reach=i=>{const seen=new Set([i]),q=[i];for(const x of q)for(const y of adj[x])if(b[y]===b[i]&&!seen.has(y)){seen.add(y);q.push(y);}return q;};
 for(let i=0;i<b.length;i++)for(let j=0;j<b.length;j++)if(b[i]&&b[j]&&!(b[i]&b[j])&&reach(i).some(x=>reach(j).some(y=>adj[x].includes(y)))){
  const next=b.slice();next[i]=0;next[j]=(b[i]|b[j])===7?0:b[i]|b[j];
  if(oracle(next,adj,memo)){memo.set(key,true);return true;}
 }
 memo.set(key,false);return false;
}
let seed=428701,fundingProofs=0,fundingRuns=0,solvable=0;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let trial=0;trial<500;trial++){
 const b=trial%2?[3,3,6,1,1,2,4,4,4]:[6,6,3,1,1,1,2,4,4],adj=b.map(()=>[]);
 for(let i=0;i<b.length;i++)for(let j=0;j<i;j++)if(random()<.29){adj[i].push(j);adj[j].push(i);}
 const expected=oracle(b,adj);if(expected)solvable++;
 // Fresh module: no earlier verified continuation may bypass this proof.
 delete require.cache[require.resolve('../search.js')];const {solve}=require('../search.js');
 const g=solve(b.map(c=>names[c]),adj,{strategyStates:0});let s,phases=[],forwards=0;
 while(!(s=g.next()).done){if(s.value.type==='search')phases.push(s.value.phase);else{assert.equal(s.value.type,'forward');assert(s.value.plan.verified);forwards++;}}
 if(phases.includes('funding'))fundingRuns++;
 assert.equal(s.value==='solved',expected,JSON.stringify({b,adj}));
 if(!expected){assert.equal(forwards,0);if(phases.length&&phases.every(p=>p==='funding'))fundingProofs++;}
}
assert(solvable>0);assert(fundingRuns>0);
console.log(`Passed 500 independent shared bridge/secondary allocation checks (${solvable} solvable, ${fundingRuns} funding checks).`);
